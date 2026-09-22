package projectinterface

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

func TestHarnessDraftsAndVersions(t *testing.T) {
	s, root := editorFixture(t)
	pipeline := filepath.Join(root, "resource", "pipeline")
	if err := os.MkdirAll(pipeline, 0755); err != nil {
		t.Fatal(err)
	}
	mustWrite(t, filepath.Join(pipeline, "main.json"), `{"Start":{"action":"DoNothing"}}`)
	base, err := s.HarnessQuery(HarnessRequest{Kind: "validate"}, false)
	if err != nil {
		t.Fatal(err)
	}
	doc := editorDoc(t, base.Project, "tasks/a.json")
	content := strings.Replace(doc.Content, `"label":"$label"`, `"label":"草稿标题"`, 1)
	request := HarnessRequest{EditorRequest: EditorRequest{Changes: []EditorChange{{Path: doc.Path, Version: doc.Version, Content: content}}}, Kind: "nodes", Names: []string{"Start"}}
	got, err := s.HarnessQuery(request, false)
	if err != nil {
		t.Fatal(err)
	}
	if editorDoc(t, got.Project, "tasks/a.json").Content != content || len(got.IncludedDrafts) != 1 || len(got.Nodes) != 1 {
		t.Fatal(got)
	}
	request.Mode = "disk"
	got, err = s.HarnessQuery(request, false)
	if err != nil {
		t.Fatal(err)
	}
	if editorDoc(t, got.Project, "tasks/a.json").Content != doc.Content {
		t.Fatal("disk query included drafts")
	}
	request.Mode = "draft"
	request.Changes[0].Version = "stale"
	if _, err = s.HarnessQuery(request, false); err == nil {
		t.Fatal("stale draft accepted")
	}
	request.Changes[0].Version = doc.Version
	request.Changes[0].Content = "{"
	got, err = s.HarnessQuery(request, true)
	if err != nil {
		t.Fatal(err)
	}
	if !hasErrorDiagnostics(got.Diagnostics) || len(got.Events) != 0 {
		t.Fatal("invalid draft silently fell back")
	}
}

func TestHarnessTraceMatchesRuntimeWithoutRegisteringContext(t *testing.T) {
	s, root := editorFixture(t)
	pipeline := filepath.Join(root, "resource", "pipeline")
	_ = os.MkdirAll(pipeline, 0755)
	mustWrite(t, filepath.Join(pipeline, "main.json"), `{"Start":{"action":"DoNothing"}}`)
	mainPath := filepath.Join(root, "interface.json")
	mainRaw, _ := os.ReadFile(mainPath)
	mustWrite(t, mainPath, strings.Replace(string(mainRaw), `"resource":[{"name":"base","path":["resource"]}]`, `"resource":[{"name":"base","path":["resource"]},{"name":"other","path":["resource"]}]`, 1))
	path := filepath.Join(root, "tasks", "a.json")
	mustWrite(t, path, `{"task":[{"name":"A","entry":"Start","option":["shared","input","inactive"],"pipeline_override":{"Start":{"timeout":5}}}],"option":{"shared":{"type":"checkbox","cases":[{"name":"a","pipeline_override":{"Start":{"timeout":5}}},{"name":"b","pipeline_override":{"Start":{"timeout":9}}}]},"input":{"type":"input","inputs":[{"name":"n","default":"4","pipeline_type":"int"}],"pipeline_override":{"Start":{"rate_limit":"{n}"}}},"inactive":{"type":"select","resource":["other"],"cases":[{"name":"x","option":["input"],"pipeline_override":{"Start":{"timeout":99}}}]}}}`)
	req := ContextRequest{TaskName: "A", ControllerName: "adb", ResourceName: "base", OptionValues: map[string]any{"task": map[string]any{"shared": []any{"b", "a"}}}}
	// Use the same source snapshot to compare trace on/off, independently of loader diagnostics.
	p, err := s.ReadEditor(EditorRequest{})
	if err != nil {
		t.Fatal(err)
	}
	plain, err := p.snapshot.ResolveContext(req)
	if err != nil {
		t.Fatal(err)
	}
	trace := &optionTrace{}
	traced, err := p.snapshot.ResolveContext(req, trace)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(plain.PipelineOverrides, traced.PipelineOverrides) {
		t.Fatal("trace changed runtime semantics")
	}
	var active []any
	var inactive bool
	for _, e := range trace.Events {
		if e.Active && e.Resolved != nil {
			active = append(active, e.Resolved)
		}
		if !e.Active && e.Option == "inactive" {
			inactive = true
		}
	}
	if len(active) != 4 || !inactive {
		t.Fatalf("unexpected events: %+v", trace.Events)
	}
	bytes, _ := json.Marshal(active)
	if !strings.Contains(string(bytes), `"rate_limit":4`) {
		t.Fatal(string(bytes))
	}
	before := len(s.contexts)
	result, err := s.HarnessQuery(HarnessRequest{Configuration: req}, true)
	if err != nil {
		t.Fatal(err)
	}
	if len(s.contexts) != before {
		t.Fatal("query registered execution context")
	}
	if len(result.Events) == 0 {
		t.Fatalf("no trace events: %+v", result.Diagnostics)
	}
	for _, event := range result.Events {
		if event.File == "" || event.Version == "" {
			t.Fatal("trace has no source", event)
		}
	}
	raw, _ := os.ReadFile(path)
	if strings.Contains(string(raw), `"rate_limit":4`) {
		t.Fatal("query wrote evaluated input")
	}
}

func TestHarnessReferencesAndPipelineOverlay(t *testing.T) {
	s, root := editorFixture(t)
	pipeline := filepath.Join(root, "resource", "pipeline")
	_ = os.MkdirAll(pipeline, 0755)
	file := filepath.Join(pipeline, "nodes.json")
	mustWrite(t, file, `{"Start":{"timeout":1}}`)
	got, err := s.HarnessQuery(HarnessRequest{Kind: "nodes", PipelineDrafts: []EditorChange{{Path: file, Content: `{"Start":{"timeout":2}}`}}}, false)
	if err != nil {
		t.Fatal(err)
	}
	if len(got.Nodes) != 1 || got.Nodes[0].Value["timeout"] != float64(2) || !got.Nodes[0].Draft {
		t.Fatal(got.Nodes)
	}
	var entries int
	for _, r := range got.Project.References {
		if r.Kind == "pipeline" && r.Name == "Start" {
			entries++
		}
	}
	if entries != 2 {
		t.Fatal(got.Project.References)
	}
	raw, _ := os.ReadFile(file)
	if string(raw) != `{"Start":{"timeout":1}}` {
		t.Fatal("disk mutated")
	}
}

func TestHarnessTraceRetainsAllNodesAndPretaskExclusion(t *testing.T) {
	trace := &optionTrace{scope: "task"}
	raw := map[string]any{"A": map[string]any{"timeout": 1}, "B": map[string]any{"timeout": 2}}
	traceEvent([]*optionTrace{trace}, "choice", "/option/choice/pipeline_override", raw, nil, true, "")
	value := trace.Events[0].Resolved.(map[string]any)
	if len(value) != 2 {
		t.Fatal("lost an override target", value)
	}
	trace.scope = "pretask"
	traceEvent([]*optionTrace{trace}, "choice", "/option/choice/pipeline_override", raw, nil, true, "")
	event := trace.Events[1]
	if event.Active || event.Resolved != nil || event.Reason == "" {
		t.Fatal(event)
	}
}
