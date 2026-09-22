package projectinterface

import (
	"fmt"
	"path/filepath"
	"strings"
)

func (s *Service) validateEditorEntries(project *EditorProject, merged map[string]any) {
	if s.files == nil {
		return
	}
	files := s.files.GetFileList()
	root := filepath.Dir(project.EntryPath)
	for _, task := range objectArray(merged["task"]) {
		name, _ := task["name"].(string)
		entry, _ := task["entry"].(string)
		if entry == "" {
			continue
		}
		location := EditorIndexItem{File: project.EntryPath, Pointer: "/task"}
		for _, def := range project.Definitions {
			if def.Kind == "task" && def.Name == name && def.Effective {
				location = def
				break
			}
		}
		for _, resource := range objectArray(merged["resource"]) {
			rn, _ := resource["name"].(string)
			for _, controller := range objectArray(merged["controller"]) {
				cn, _ := controller["name"].(string)
				if !optionApplicable(task, cn, rn) || !optionApplicable(resource, cn, rn) {
					continue
				}
				roots := append(stringSlice(resource["path"]), stringSlice(controller["attach_resource_path"])...)
				found := false
				for _, file := range files {
					included := false
					for _, path := range roots {
						if !filepath.IsAbs(path) {
							path = filepath.Join(root, path)
						}
						if isWithin(filepath.Join(path, "pipeline"), file.FilePath) {
							included = true
							break
						}
					}
					if !included {
						continue
					}
					for _, node := range file.Nodes {
						if node.Label == entry {
							found = true
							break
						}
					}
					if found {
						break
					}
				}
				if !found {
					project.Diagnostics = append(project.Diagnostics, editorDiagnostic(location.File, location.Pointer+"/entry", "warning", fmt.Sprintf("在资源 %s / 控制器 %s 的磁盘索引中未找到入口 %s；动态创建或未索引节点需运行验证", rn, cn, entry)))
				}
			}
		}
	}
}
func validateEditorOptions(project *EditorProject, merged map[string]any) {
	for name, raw := range objectMap(merged["option"]) {
		opt := objectMap(raw)
		file, pointer := project.EntryPath, "/option/"+escapePointer(name)
		for _, d := range project.Definitions {
			if d.Kind == "option" && d.Name == name && d.Effective {
				file, pointer = d.File, d.Pointer
				break
			}
		}
		for _, field := range []string{"cases", "inputs", "hotkeys"} {
			project.Diagnostics = append(project.Diagnostics, duplicateNameDiagnostics(file, pointer+"/"+field, objectArray(opt[field]))...)
		}
		if opt["type"] == "checkbox" && opt["default_case"] != nil {
			if err := ValidateCheckboxOptions(map[string]any{name: raw}, map[string]any{name: opt["default_case"]}); err != nil {
				project.Diagnostics = append(project.Diagnostics, editorDiagnostic(file, pointer+"/default_case", "error", err.Error()))
			}
		}
	}
	// A translation present in one language does not make it present in every language.
	for _, doc := range project.Documents {
		if doc.Kind != "language" || !doc.Imported {
			continue
		}
		data, err := parseEditorDocument(doc.Content)
		if err != nil {
			continue
		}
		seen := map[string]bool{}
		for _, ref := range project.References {
			if ref.Kind != "translation" || !ref.Effective || seen[ref.Name] {
				continue
			}
			seen[ref.Name] = true
			if _, ok := data[ref.Name]; !ok {
				project.Diagnostics = append(project.Diagnostics, editorDiagnostic(doc.Path, "/"+escapePointer(ref.Name), "warning", "缺少翻译: "+ref.Name))
			}
		}
	}
	// Remap merged option diagnostics to the original definition file.
	for i := range project.Diagnostics {
		d := &project.Diagnostics[i]
		if d.File != project.EntryPath || !strings.HasPrefix(d.Pointer, "/option/") {
			continue
		}
		for _, def := range project.Definitions {
			if def.Kind == "option" && def.Effective && (d.Pointer == def.Pointer || strings.HasPrefix(d.Pointer, def.Pointer+"/")) {
				d.File = def.File
				break
			}
		}
	}
}
