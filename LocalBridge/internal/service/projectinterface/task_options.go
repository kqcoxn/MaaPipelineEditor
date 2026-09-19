package projectinterface

// Each PI scope has its own values, including when the same option is used by
// more than one scope. Only active branches contribute to the runtime override.
func resolveTaskOptions(doc map[string]any, req ContextRequest, controllerName, controllerType, resourceName string) (map[string]any, []OptionGroup, map[string]any, []map[string]any, []Diagnostic) {
	task := findNamed(objectArray(doc["task"]), req.TaskName)
	var diagnostics []Diagnostic
	if req.TaskName != "" {
		if task == nil {
			diagnostics = append(diagnostics, Diagnostic{Severity: "error", Category: "reference", Code: "pi.task.missing", Message: "任务不存在: " + req.TaskName})
		} else if !optionApplicable(task, controllerName, resourceName) {
			diagnostics = append(diagnostics, Diagnostic{Severity: "error", Category: "runtime", Code: "pi.task.unavailable", Message: "任务不适用于当前控制器或资源: " + req.TaskName})
		}
	}
	definitions := objectMap(doc["option"])
	controller := findNamed(objectArray(doc["controller"]), controllerName)
	resource := findNamed(objectArray(doc["resource"]), resourceName)
	values := map[string]any{}
	groups := []OptionGroup{}
	var overrides []map[string]any
	pretaskRefs := []string{}
	for _, program := range applicablePrograms(doc, controllerName, resourceName) {
		for _, ref := range stringSlice(program["option"]) {
			if !containsString(pretaskRefs, ref) {
				pretaskRefs = append(pretaskRefs, ref)
			}
		}
	}
	appendPipelineOverride(&overrides, task["pipeline_override"], nil)
	for _, scope := range []struct {
		name string
		refs []string
	}{
		{"global", stringSlice(doc["global_option"])},
		{"resource", stringSlice(resource["option"])},
		{"controller", stringSlice(controller["option"])},
		{"task", stringSlice(task["option"])},
		{"pretask", pretaskRefs},
	} {
		if scope.name == "pretask" && req.Purpose != "interface" {
			continue
		}
		provided := objectMap(req.OptionValues[scope.name])
		current, active, scopeOverrides, scopeDiagnostics := resolveOptions(definitions, scope.refs, controllerName, controllerType, resourceName, provided)
		for i := range scopeDiagnostics {
			scopeDiagnostics[i].Data = map[string]any{"scope": scope.name}
		}
		if scope.name != "pretask" {
			overrides = append(overrides, scopeOverrides...)
		}
		diagnostics = append(diagnostics, scopeDiagnostics...)
		for _, validate := range []func(map[string]any, map[string]any) error{ValidateDebugPasswords, ValidateCheckboxOptions} {
			if err := validate(active, current); err != nil {
				diagnostics = append(diagnostics, Diagnostic{Severity: "error", Category: "runtime", Code: "pi.option.invalid", Message: err.Error(), Data: map[string]any{"scope": scope.name}})
			}
		}
		// Keep editable input text even if type conversion fails. Converted values
		// have already been used in the override, never round-trip them into inputs.
		for name, raw := range active {
			definition := objectMap(raw)
			if definition["type"] == "input" {
				fields := objectMap(defaultOptionValue("input", definition))
				for key, value := range objectMap(provided[name]) {
					fields[key] = value
				}
				current[name] = fields
			}
		}
		values[scope.name] = current
		groups = append(groups, OptionGroup{Scope: scope.name, Nodes: optionTree(scope.refs, active, current, map[string]bool{})})
	}
	return task, groups, values, overrides, diagnostics
}

func optionTree(names []string, active, values map[string]any, stack map[string]bool) []OptionNode {
	nodes := []OptionNode{}
	for _, name := range names {
		definition := objectMap(active[name])
		if definition == nil || stack[name] {
			continue
		}
		stack[name] = true
		selected := toStringValues(values[name])
		if single, ok := values[name].(string); ok {
			selected = []string{single}
		}
		var children []string
		for _, item := range objectArray(definition["cases"]) {
			caseName, _ := item["name"].(string)
			if containsString(selected, caseName) {
				children = append(children, stringSlice(item["option"])...)
			}
		}
		nodes = append(nodes, OptionNode{Name: name, Definition: cloneMap(definition), Children: optionTree(children, active, values, stack)})
		delete(stack, name)
	}
	return nodes
}
