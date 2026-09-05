package diagnostics

import (
	"bytes"
	"fmt"
	"sort"
	"strings"
	"unicode/utf8"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/protocol"
	"github.com/tailscale/hujson"
)

// Keep the source of each field when bundles override individual node fields.
type resourceReferenceField struct {
	file  resourceHealthBundlePipelineFile
	value *hujson.Value
	path  string
}

type resourceReferenceNode map[string]resourceReferenceField

func (s *Service) checkBundlePipelineReferences(ctx resourceHealthChecklistContext) []protocol.Diagnostic {
	nodes := make(map[string]resourceReferenceNode)
	diagnostics := make([]protocol.Diagnostic, 0)
	seen := make(map[string]bool)
	appendUnique := func(items []protocol.Diagnostic) {
		for _, d := range items {
			key := d.Code + "\x00" + d.SourcePath + "\x00" + d.FieldPath
			if !seen[key] {
				diagnostics = append(diagnostics, d)
				seen[key] = true
			}
		}
	}
	for _, resolution := range ctx.resolutions {
		for _, file := range ctx.bundleFiles {
			if file.parsed == nil || resolvedPathKey(file.bundlePath) != resolvedPathKey(resolution.ResolvedPath) {
				continue
			}
			root, ok := file.parsed.Value.(*hujson.Object)
			if !ok {
				continue
			}
			for _, member := range root.Members {
				name := resourceHealthObjectMemberName(member)
				if name == "" || strings.HasPrefix(name, "$") {
					continue
				}
				body, ok := member.Value.Value.(*hujson.Object)
				if !ok {
					continue
				}
				if nodes[name] == nil {
					nodes[name] = make(resourceReferenceNode)
				}
				for i := range body.Members {
					field := &body.Members[i]
					key := resourceHealthObjectMemberName(*field)
					nodes[name][key] = resourceReferenceField{file: file, value: &field.Value, path: key}
				}
			}
		}
		// MaaFW validates next/on_error after each bundle, so later bundles cannot
		// supply a missing node for an earlier bundle's load.
		for _, name := range resourceReferenceNodeNames(nodes) {
			for _, key := range []string{"next", "on_error"} {
				for _, ref := range resourceReferenceItems(nodes[name][key]) {
					target, ok := resourceReferenceString(ref.value)
					anchor := false
					if !ok {
						anchorField := resourceReferenceChild(ref, "anchor")
						if anchorField.value != nil {
							literal, isLiteral := anchorField.value.Value.(hujson.Literal)
							anchor = isLiteral && string(literal) == "true"
						}
						ref = resourceReferenceChild(ref, "name")
						target, ok = resourceReferenceString(ref.value)
					}
					if !ok {
						continue
					}
					for strings.HasPrefix(target, "[") {
						end := strings.Index(target, "]")
						if end < 0 {
							break
						}
						anchor = anchor || target[1:end] == "Anchor"
						target = target[end+1:]
					}
					if anchor {
						continue
					}
					if _, exists := nodes[target]; !exists {
						appendUnique([]protocol.Diagnostic{resourceReferenceDiagnostic(ref, name,
							"error", "debug.resource.pipeline_node_missing",
							fmt.Sprintf("节点「%s」的 %s 引用了不存在的节点「%s」。", name, ref.path, target),
							"补充目标节点或修正引用名称（区分大小写）；跨文件引用需要目标文件位于已加载的资源包内，MPE 外部节点记录不能代替实际节点定义。", target)})
					}
				}
			}
		}
	}
	// Images are lazy-loaded at recognition time and can come from any selected bundle.
	for _, name := range resourceReferenceNodeNames(nodes) {
		node := nodes[name]
		reco := node["recognition"]
		if kind, ok := resourceReferenceString(reco.value); ok {
			if kind == "TemplateMatch" || kind == "FeatureMatch" {
				appendUnique(checkResourceTemplateField(ctx, name, node["template"]))
			}
		} else {
			appendUnique(checkResourceRecognitionTemplates(ctx, name, reco))
		}
	}
	return diagnostics
}

func resourceReferenceNodeNames(nodes map[string]resourceReferenceNode) []string {
	names := make([]string, 0, len(nodes))
	for name := range nodes {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

func resourceReferenceString(value *hujson.Value) (string, bool) {
	if value == nil {
		return "", false
	}
	literal, ok := value.Value.(hujson.Literal)
	if !ok || literal.Kind() != '"' {
		return "", false
	}
	return literal.String(), true
}

func resourceReferenceChild(field resourceReferenceField, key string) resourceReferenceField {
	if field.value == nil {
		return resourceReferenceField{}
	}
	object, ok := field.value.Value.(*hujson.Object)
	if !ok {
		return resourceReferenceField{}
	}
	for i := range object.Members {
		member := &object.Members[i]
		if resourceHealthObjectMemberName(*member) == key {
			return resourceReferenceField{file: field.file, value: &member.Value, path: field.path + "." + key}
		}
	}
	return resourceReferenceField{}
}

func resourceReferenceItems(field resourceReferenceField) []resourceReferenceField {
	if field.value == nil {
		return nil
	}
	array, ok := field.value.Value.(*hujson.Array)
	if !ok {
		return []resourceReferenceField{field}
	}
	items := make([]resourceReferenceField, 0, len(array.Elements))
	for i := range array.Elements {
		items = append(items, resourceReferenceField{file: field.file, value: &array.Elements[i], path: fmt.Sprintf("%s[%d]", field.path, i)})
	}
	return items
}

func resourceReferenceDiagnostic(field resourceReferenceField, name, severity, code, message, suggestion, target string) protocol.Diagnostic {
	offset := field.value.StartOffset
	if offset > len(field.file.source) {
		offset = len(field.file.source)
	}
	prefix := field.file.source[:offset]
	line := bytes.Count(prefix, []byte("\n")) + 1
	column := utf8.RuneCount(prefix[bytes.LastIndexByte(prefix, '\n')+1:]) + 1
	return withResourceHealthMeta(protocol.Diagnostic{
		Severity: severity, Code: code, Message: message,
		SourcePath: field.file.sourcePath,
		FieldPath:  fmt.Sprintf("%s.%s", name, field.path),
		Data: map[string]interface{}{
			"bundlePath": field.file.bundlePath, "relativePath": field.file.relativePath,
			"nodeName": name, "runtimeName": name, "target": target,
			"line": line, "column": column,
		},
	}, resourceHealthCategoryLoading, suggestion)
}
