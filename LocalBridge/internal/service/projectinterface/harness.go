package projectinterface

import (
	"fmt"
	"path/filepath"
	"strconv"
	"strings"
)

type HarnessRequest struct {
	EditorRequest
	Mode           string         `json:"mode"`
	Kind           string         `json:"kind"`
	Names          []string       `json:"names"`
	PipelineDrafts []EditorChange `json:"pipelineDrafts"`
	Configuration  ContextRequest `json:"configuration"`
}
type HarnessNode struct {
	Name    string         `json:"name"`
	File    string         `json:"file"`
	Pointer string         `json:"pointer"`
	Version string         `json:"version"`
	Layer   int            `json:"layer"`
	Value   map[string]any `json:"value"`
	Draft   bool           `json:"draft"`
}
type HarnessReply struct {
	Project        *EditorProject    `json:"project"`
	Mode           string            `json:"mode"`
	Versions       map[string]string `json:"versions"`
	Nodes          []HarnessNode     `json:"nodes"`
	ResourcePaths  []string          `json:"resourcePaths"`
	Events         []HarnessOverride `json:"events,omitempty"`
	Values         map[string]any    `json:"values,omitempty"`
	Diagnostics    []Diagnostic      `json:"diagnostics"`
	IncludedDrafts []string          `json:"includedDrafts"`
	Limit          string            `json:"limit"`
}

// HarnessQuery only builds data snapshots; it does not register a runtime context.
func (s *Service) HarnessQuery(req HarnessRequest, resolve bool) (*HarnessReply, error) {
	s.refreshMu.Lock()
	defer s.refreshMu.Unlock()
	if req.Mode == "" {
		req.Mode = "draft"
	}
	if req.Mode != "disk" && req.Mode != "draft" {
		return nil, fmt.Errorf("未知数据源")
	}
	if req.Mode == "disk" {
		req.Changes = nil
		req.PipelineDrafts = nil
	}
	project, err := s.readEditor(req.EditorRequest)
	if err != nil {
		return nil, err
	}
	result := &HarnessReply{Project: project, Mode: req.Mode, Versions: map[string]string{}, Nodes: []HarnessNode{}, Diagnostics: append([]Diagnostic{}, project.Diagnostics...), IncludedDrafts: []string{}, Limit: "仅静态 PI 配置解析；不包含框架默认值、类型归一化或实际执行路径"}
	for _, doc := range project.Documents {
		result.Versions[doc.Path] = doc.Version
	}
	for _, change := range req.Changes {
		path, e := editorPath(filepath.Dir(project.EntryPath), change.Path)
		if e != nil {
			return nil, e
		}
		if result.Versions[path] != change.Version {
			return nil, fmt.Errorf("PI 来源版本已变化: %s", path)
		}
		result.IncludedDrafts = append(result.IncludedDrafts, path)
	}
	for _, doc := range project.Documents {
		if doc.Error != "" {
			return result, nil
		}
	}
	snapshot := project.snapshot
	if req.Kind == "nodes" || resolve || req.Kind == "validate" {
		resources := objectArray(snapshot.Document["resource"])
		if req.Configuration.ResourceName != "" {
			r := findNamed(resources, req.Configuration.ResourceName)
			if r == nil {
				return nil, fmt.Errorf("资源不存在")
			}
			resources = []map[string]any{r}
		}
		controller := findNamed(objectArray(snapshot.Document["controller"]), req.Configuration.ControllerName)
		for _, r := range resources {
			paths, err := resolveRuntimePaths(snapshot.InterfaceRoot, r, controller)
			if err != nil {
				return nil, err
			}
			for _, path := range paths {
				if !containsString(result.ResourcePaths, path) {
					result.ResourcePaths = append(result.ResourcePaths, path)
				}
			}
		}
		if req.Kind == "validate" && req.Configuration.ControllerName == "" {
			for _, c := range objectArray(snapshot.Document["controller"]) {
				paths, err := resolveRuntimePaths(snapshot.InterfaceRoot, nil, c)
				if err != nil {
					return nil, err
				}
				for _, path := range paths {
					if !containsString(result.ResourcePaths, path) {
						result.ResourcePaths = append(result.ResourcePaths, path)
					}
				}
			}
		}
		if err := readHarnessNodes(result, req); err != nil {
			return nil, err
		}
		known := map[string]bool{}
		for _, n := range result.Nodes {
			known[n.Name] = true
		}
		if req.Kind == "validate" {
			for _, r := range harnessNodeReferences(project) {
				if r.Effective && !known[r.Name] && !strings.Contains(r.Name, "[") && !strings.Contains(r.Name, "{") {
					result.Diagnostics = append(result.Diagnostics, editorDiagnostic(r.File, r.Pointer, "error", "Pipeline 目标不存在: "+r.Name))
				}
			}
		}
	}
	for path, version := range req.Versions {
		if result.Versions[path] != version {
			return nil, fmt.Errorf("来源版本已变化: %s", path)
		}
	}
	project.References = append(project.References, harnessNodeReferences(project)...)
	if !resolve {
		return result, nil
	}
	c := req.Configuration
	if c.TaskName == "" || c.ControllerName == "" || c.ResourceName == "" {
		return nil, fmt.Errorf("请明确选择任务、控制器和资源；可先查询项目摘要")
	}
	if hasErrorDiagnostics(project.Diagnostics) {
		return result, nil
	}
	c.Revision = ""
	trace := &optionTrace{}
	plan, err := snapshot.ResolveContext(c, trace)
	if err != nil {
		return nil, err
	}
	result.Values = plan.OptionValues
	result.Diagnostics = append(result.Diagnostics, plan.Diagnostics...)
	for _, event := range trace.Events {
		// Translate merged array positions back to the original definition identity.
		prefix := ""
		kind, name := "option", event.Option
		if name != "" {
			prefix = "/option/" + escapePointer(name)
		} else {
			kind = "task"
			name = c.TaskName
			for i, t := range objectArray(snapshot.Document["task"]) {
				if t["name"] == name {
					prefix = fmt.Sprintf("/task/%d", i)
					break
				}
			}
		}
		for _, d := range project.Definitions {
			if d.Kind == kind && d.Name == name && d.Effective {
				event.File = d.File
				event.Version = result.Versions[d.File]
				event.Pointer = d.Pointer + strings.TrimPrefix(event.Pointer, prefix)
				break
			}
		}
		if event.Raw != nil {
			if source := snapshot.documents[event.File]; source != nil {
				event.Raw = harnessValueAt(source.Data, event.Pointer)
			}
		}
		if hasErrorDiagnostics(plan.Diagnostics) && event.Active {
			event.Active = false
			event.Resolved = nil
			event.Reason = "配置校验失败，覆盖未应用"
		}
		result.Events = append(result.Events, event)
	}
	return result, nil
}

func harnessNodeReferences(project *EditorProject) []EditorIndexItem {
	refs := []EditorIndexItem{}
	for _, doc := range project.Documents {
		data, err := parseEditorDocument(doc.Content)
		if err != nil || doc.Kind == "language" {
			continue
		}
		for i, t := range objectArray(data["task"]) {
			if n, ok := t["entry"].(string); ok {
				refs = append(refs, EditorIndexItem{Kind: "pipeline", Name: n, File: doc.Path, Pointer: fmt.Sprintf("/task/%d/entry", i), Effective: doc.Imported})
			}
		}
		var walk func(any, string)
		walk = func(v any, p string) {
			switch x := v.(type) {
			case map[string]any:
				for k, child := range x {
					q := p + "/" + escapePointer(k)
					if k == "pipeline_override" {
						for n := range objectMap(child) {
							refs = append(refs, EditorIndexItem{Kind: "pipeline", Name: n, File: doc.Path, Pointer: q + "/" + escapePointer(n), Effective: doc.Imported})
						}
					} else {
						walk(child, q)
					}
				}
			case []any:
				for i, child := range x {
					walk(child, fmt.Sprintf("%s/%d", p, i))
				}
			}
		}
		walk(data, "")
	}
	for i := range refs {
		best := ""
		for _, d := range project.Definitions {
			if d.File == refs[i].File && strings.HasPrefix(refs[i].Pointer, d.Pointer+"/") && len(d.Pointer) > len(best) {
				best = d.Pointer
				refs[i].Effective = d.Effective
			}
		}
	}
	return refs
}

func harnessValueAt(value any, pointer string) any {
	for _, part := range strings.Split(strings.TrimPrefix(pointer, "/"), "/") {
		part = strings.ReplaceAll(strings.ReplaceAll(part, "~1", "/"), "~0", "~")
		switch v := value.(type) {
		case map[string]any:
			value = v[part]
		case []any:
			i, err := strconv.Atoi(part)
			if err != nil || i < 0 || i >= len(v) {
				return nil
			}
			value = v[i]
		default:
			return nil
		}
	}
	return value
}
