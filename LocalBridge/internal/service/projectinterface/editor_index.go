package projectinterface

import (
	"fmt"
	"sort"
	"strings"
)

func indexEditor(project *EditorProject) {
	effective := map[string]int{}
	for _, doc := range project.Documents {
		data, err := parseEditorDocument(doc.Content)
		if err != nil {
			continue
		}
		add := func(kind, name, pointer string) {
			item := EditorIndexItem{Kind: kind, Name: name, File: doc.Path, Pointer: pointer, Effective: doc.Imported}
			key := kind + ":" + name
			if doc.Kind == "language" {
				key += ":" + doc.Path
			}
			if prev, exists := effective[key]; exists && doc.Imported {
				if kind == "option" {
					project.Definitions[prev].Effective = false
				} else {
					item.Effective = false
				}
			}
			project.Definitions = append(project.Definitions, item)
			if item.Effective {
				effective[key] = len(project.Definitions) - 1
			}
		}
		if doc.Kind == "language" {
			for key := range data {
				add("translation", key, "/"+escapePointer(key))
			}
			continue
		}
		for _, kind := range []string{"task", "controller", "resource", "group", "preset"} {
			for i, item := range objectArray(data[kind]) {
				name, _ := item["name"].(string)
				add(kind, name, fmt.Sprintf("/%s/%d", kind, i))
			}
		}
		for name := range objectMap(data["option"]) {
			add("option", name, "/option/"+escapePointer(name))
		}
		var walk func(any, string)
		ref := func(kind, name, pointer string) {
			project.References = append(project.References, EditorIndexItem{Kind: kind, Name: name, File: doc.Path, Pointer: pointer, Effective: doc.Imported})
		}
		walk = func(value any, pointer string) {
			switch value := value.(type) {
			case map[string]any:
				for key, child := range value {
					p := pointer + "/" + escapePointer(key)
					if key == "pipeline_override" {
						continue
					}
					kind := key
					if key == "global_option" {
						kind = "option"
					}
					if kind == "option" || kind == "group" || kind == "controller" || kind == "resource" {
						for i, v := range anySlice(child) {
							if name, ok := v.(string); ok {
								ref(kind, name, fmt.Sprintf("%s/%d", p, i))
							}
						}
					}
					// Presets reference tasks by name and options as object keys.
					if strings.HasPrefix(pointer, "/preset/") && key == "name" && strings.Contains(pointer, "/task/") {
						if name, ok := child.(string); ok {
							ref("task", name, p)
						}
					}
					if strings.HasPrefix(pointer, "/preset/") && key == "option" {
						for name := range objectMap(child) {
							ref("option", name, p+"/"+escapePointer(name))
						}
					}
					walk(child, p)
				}
			case []any:
				for i, v := range value {
					walk(v, fmt.Sprintf("%s/%d", pointer, i))
				}
			case string:
				if strings.HasPrefix(value, "$") {
					ref("translation", strings.TrimPrefix(value, "$"), pointer)
				}
			}
		}
		walk(data, "")
	}
}
func validateEditorReferences(project *EditorProject, merged map[string]any) {
	known := map[string]bool{}
	for _, d := range project.Definitions {
		if d.Effective {
			known[d.Kind+":"+d.Name] = true
		}
	}
	for _, r := range project.References {
		if r.Effective && !known[r.Kind+":"+r.Name] {
			severity := "error"
			if r.Kind == "translation" {
				severity = "warning"
			}
			project.Diagnostics = append(project.Diagnostics, editorDiagnostic(r.File, r.Pointer, severity, "引用不存在: "+r.Kind+" · "+r.Name))
		}
	}
	options := objectMap(merged["option"])
	visiting, done := map[string]bool{}, map[string]bool{}
	var visit func(string)
	visit = func(name string) {
		if visiting[name] {
			project.Diagnostics = append(project.Diagnostics, editorDiagnostic(project.EntryPath, "/option/"+escapePointer(name), "error", "嵌套选项循环: "+name))
			return
		}
		if done[name] {
			return
		}
		visiting[name] = true
		opt := objectMap(options[name])
		for _, child := range stringSlice(opt["option"]) {
			visit(child)
		}
		cases := objectArray(opt["cases"])
		caseNames := namesOf(cases)
		for _, c := range cases {
			for _, child := range stringSlice(c["option"]) {
				visit(child)
			}
		}
		defaults := stringSlice(opt["default_case"])
		if v, ok := opt["default_case"].(string); ok {
			defaults = []string{v}
		}
		for _, v := range defaults {
			if !caseNames[v] {
				project.Diagnostics = append(project.Diagnostics, editorDiagnostic(project.EntryPath, "/option/"+escapePointer(name)+"/default_case", "error", "默认分支不存在: "+v))
			}
		}
		visiting[name] = false
		done[name] = true
	}
	names := make([]string, 0, len(options))
	for name := range options {
		names = append(names, name)
	}
	sort.Strings(names)
	for _, name := range names {
		visit(name)
	}
}
