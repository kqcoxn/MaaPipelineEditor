package projectinterface

import (
	"encoding/json"
	"fmt"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/google/uuid"
)

func (s *ProjectSnapshot) Localize(requested string) *ProjectSnapshot {
	localized := &ProjectSnapshot{
		ProjectID: s.ProjectID, EntryPath: s.EntryPath, ProjectRoot: s.ProjectRoot, InterfaceRoot: s.InterfaceRoot,
		Revision: s.Revision, Document: cloneMap(s.Document), Provenance: s.Provenance,
		Diagnostics: append([]Diagnostic(nil), s.Diagnostics...), Sources: append([]string(nil), s.Sources...), documents: s.documents,
	}
	languages := stringMap(s.Document["languages"])
	language := chooseLanguage(requested, languages)
	localized.Language = language
	translations := map[string]any{}
	if languagePath := languages[language]; languagePath != "" {
		path := filepath.Clean(filepath.Join(s.InterfaceRoot, languagePath))
		if resolved, err := filepath.EvalSymlinks(path); err == nil {
			if doc := s.documents[resolved]; doc != nil {
				translations = doc.Data
			}
		}
	}
	localized.Document = localizeDocument(localized.Document, translations, &localized.Diagnostics, s.EntryPath)
	return localized
}

func (s *ProjectSnapshot) ResolveContext(req ContextRequest) (*RuntimePlan, error) {
	if strings.TrimSpace(req.Revision) != "" && req.Revision != s.Revision {
		return nil, fmt.Errorf("PI revision 已变化，请刷新后重试")
	}
	localized := s.Localize(req.Language)
	controllers := objectArray(localized.Document["controller"])
	controller := findNamed(controllers, req.ControllerName)
	if controller == nil && len(controllers) > 0 {
		controller = controllers[0]
	}
	if controller == nil {
		return nil, fmt.Errorf("PI 未声明 Controller")
	}
	controllerName, _ := controller["name"].(string)

	resources := compatibleResources(objectArray(localized.Document["resource"]), controllerName)
	resource := findNamed(resources, req.ResourceName)
	if resource == nil && len(resources) > 0 {
		resource = resources[0]
	}
	if resource == nil {
		return nil, fmt.Errorf("当前 PI Controller 没有兼容 Resource")
	}
	resourceName, _ := resource["name"].(string)

	paths, err := resolveRuntimePaths(s.InterfaceRoot, resource, controller)
	if err != nil {
		return nil, err
	}
	controllerType, _ := controller["type"].(string)
	values, activeOptions, overrides, diagnostics := resolveOptions(localized.Document, controllerName, controllerType, resourceName, req.OptionValues)
	if hasErrorDiagnostics(diagnostics) {
		return nil, &loadError{Diagnostics: diagnostics}
	}

	agents, err := resolveAgents(localized.Document["agent"])
	if err != nil {
		return nil, err
	}
	for index := range agents {
		agents[index].Enabled = true
		if enabled, ok := req.AgentEnabled[agents[index].ID]; ok {
			agents[index].Enabled = enabled
		}
		if override, ok := req.AgentOverrides[agents[index].ID]; ok && strings.TrimSpace(override.ChildExec) != "" {
			agents[index].ChildExec = strings.TrimSpace(override.ChildExec)
			agents[index].ChildArgs = append([]string(nil), override.ChildArgs...)
		}
	}
	version, _ := localized.Document["version"].(string)
	return &RuntimePlan{
		ContextID: uuid.NewString(), ProjectID: s.ProjectID, Revision: s.Revision,
		Language: localized.Language, ProjectRoot: s.ProjectRoot, InterfaceRoot: s.InterfaceRoot, ProjectVersion: version,
		ControllerName: controllerName, ResourceName: resourceName,
		Controller: cloneMap(controller), Resource: cloneMap(resource), ResourcePaths: paths,
		Options: activeOptions, OptionValues: values, PipelineOverrides: overrides, Agents: agents,
	}, nil
}

func chooseLanguage(requested string, languages map[string]string) string {
	requested = strings.ReplaceAll(strings.ToLower(strings.TrimSpace(requested)), "-", "_")
	if requested == "" {
		requested = "zh_cn"
	}
	if len(languages) == 0 {
		return requested
	}
	if _, ok := languages[requested]; ok {
		return requested
	}
	if _, ok := languages["zh_cn"]; ok {
		return "zh_cn"
	}
	keys := make([]string, 0, len(languages))
	for key := range languages {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys[0]
}

var i18nFields = map[string]bool{"label": true, "icon": true, "description": true, "title": true, "contact": true, "license": true, "welcome": true}

func localizeDocument(document map[string]any, translations map[string]any, diagnostics *[]Diagnostic, file string) map[string]any {
	result := cloneMap(document)
	localizeFields(result, translations, diagnostics, file, "")
	return result
}

func localizeFields(value any, translations map[string]any, diagnostics *[]Diagnostic, file, pointer string) {
	switch typed := value.(type) {
	case []any:
		for index, item := range typed {
			localizeFields(item, translations, diagnostics, file, fmt.Sprintf("%s/%d", pointer, index))
		}
	case map[string]any:
		for key, item := range typed {
			childPointer := pointer + "/" + escapePointer(key)
			if i18nFields[key] {
				if text, ok := item.(string); ok && strings.HasPrefix(text, "$") {
					translationKey := strings.TrimPrefix(text, "$")
					if translated, ok := translations[translationKey].(string); ok {
						typed[key] = translated
					} else {
						*diagnostics = append(*diagnostics, Diagnostic{Severity: "warning", Category: "reference", Code: "pi.i18n.missing", Message: "缺少国际化文本: " + text, File: file, Pointer: childPointer})
					}
				}
			}
			localizeFields(typed[key], translations, diagnostics, file, childPointer)
		}
	}
}

func compatibleResources(resources []map[string]any, controller string) []map[string]any {
	result := make([]map[string]any, 0, len(resources))
	for _, resource := range resources {
		allowed := stringSlice(resource["controller"])
		if len(allowed) == 0 || containsString(allowed, controller) {
			result = append(result, resource)
		}
	}
	return result
}

func resolveRuntimePaths(root string, resource, controller map[string]any) ([]string, error) {
	values := append(stringSlice(resource["path"]), stringSlice(controller["attach_resource_path"])...)
	result := make([]string, 0, len(values))
	for _, value := range values {
		path := value
		if !filepath.IsAbs(path) {
			path = filepath.Join(root, path)
		}
		resolved, err := filepath.EvalSymlinks(path)
		if err != nil {
			return nil, fmt.Errorf("解析资源路径 %s 失败: %w", value, err)
		}
		result = append(result, filepath.Clean(resolved))
	}
	return result, nil
}

func resolveAgents(value any) ([]AgentPlan, error) {
	var items []map[string]any
	if item, ok := value.(map[string]any); ok {
		items = []map[string]any{item}
	} else {
		items = objectArray(value)
	}
	result := make([]AgentPlan, 0, len(items))
	for index, item := range items {
		exec, _ := item["child_exec"].(string)
		exec = strings.TrimSpace(exec)
		if exec == "" {
			return nil, fmt.Errorf("agent[%d] 缺少 child_exec", index)
		}
		identifier, _ := item["identifier"].(string)
		result = append(result, AgentPlan{Index: index, ID: fmt.Sprintf("pi-agent-%d", index+1), ChildExec: exec, ChildArgs: stringSlice(item["child_args"]), Identifier: strings.TrimSpace(identifier)})
	}
	return result, nil
}

func resolveOptions(doc map[string]any, controllerName, controllerType, resourceName string, provided map[string]any) (map[string]any, map[string]any, []map[string]any, []Diagnostic) {
	definitions := objectMap(doc["option"])
	values := map[string]any{}
	for key, value := range provided {
		values[key] = value
	}
	active := map[string]any{}
	var overrides []map[string]any
	var diagnostics []Diagnostic
	resource := findNamed(objectArray(doc["resource"]), resourceName)
	controller := findNamed(objectArray(doc["controller"]), controllerName)
	references := append([]string{}, stringSlice(doc["global_option"])...)
	if resource != nil {
		references = append(references, stringSlice(resource["option"])...)
	}
	if controller != nil {
		references = append(references, stringSlice(controller["option"])...)
	}
	stack := map[string]bool{}
	for _, name := range references {
		resolveOption(name, definitions, controllerName, controllerType, resourceName, values, active, &overrides, &diagnostics, stack)
	}
	return values, active, overrides, diagnostics
}

func resolveOption(name string, definitions map[string]any, controllerName, controllerType, resourceName string, values, active map[string]any, overrides *[]map[string]any, diagnostics *[]Diagnostic, stack map[string]bool) {
	if stack[name] {
		*diagnostics = append(*diagnostics, Diagnostic{Severity: "error", Category: "runtime", Code: "pi.option.cycle", Message: "Option 递归引用形成环: " + name, Pointer: "/option/" + escapePointer(name)})
		return
	}
	definition, ok := definitions[name].(map[string]any)
	if !ok {
		*diagnostics = append(*diagnostics, Diagnostic{Severity: "error", Category: "reference", Code: "pi.option.missing", Message: "引用了不存在的 Option: " + name})
		return
	}
	if !optionApplicable(definition, controllerName, resourceName) {
		return
	}
	stack[name] = true
	defer delete(stack, name)
	active[name] = cloneMap(definition)
	typeName, _ := definition["type"].(string)
	if typeName == "" {
		typeName = "select"
	}
	value, exists := values[name]
	if !exists {
		value = defaultOptionValue(typeName, definition)
		values[name] = value
	}

	switch typeName {
	case "select", "switch":
		selected, _ := value.(string)
		if selected == "" {
			return
		}
		if selectedCase := findNamed(objectArray(definition["cases"]), selected); selectedCase != nil {
			appendPipelineOverride(overrides, selectedCase["pipeline_override"], nil)
			for _, nested := range stringSlice(selectedCase["option"]) {
				resolveOption(nested, definitions, controllerName, controllerType, resourceName, values, active, overrides, diagnostics, stack)
			}
		}
	case "checkbox":
		selected := toStringValues(value)
		for _, item := range objectArray(definition["cases"]) {
			caseName, _ := item["name"].(string)
			if !containsString(selected, caseName) {
				continue
			}
			appendPipelineOverride(overrides, item["pipeline_override"], nil)
			for _, nested := range stringSlice(item["option"]) {
				resolveOption(nested, definitions, controllerName, controllerType, resourceName, values, active, overrides, diagnostics, stack)
			}
		}
	case "input":
		replacements := resolveInputReplacements(definition, value, diagnostics, name)
		values[name] = replacements
		appendPipelineOverride(overrides, definition["pipeline_override"], replacements)
	case "hotkey":
		replacements := resolveHotkeyReplacements(definition, value, controllerType, diagnostics, name)
		appendPipelineOverride(overrides, definition["pipeline_override"], replacements)
	}
}

func resolveInputReplacements(definition map[string]any, value any, diagnostics *[]Diagnostic, optionName string) map[string]any {
	provided, _ := value.(map[string]any)
	result := map[string]any{}
	for _, field := range objectArray(definition["inputs"]) {
		name, _ := field["name"].(string)
		raw, exists := provided[name]
		if !exists {
			raw = field["default"]
		}
		typeName, _ := field["pipeline_type"].(string)
		converted, err := convertInputValue(raw, typeName)
		if err != nil {
			*diagnostics = append(*diagnostics, Diagnostic{Severity: "error", Category: "runtime", Code: "pi.option.input_invalid", Message: fmt.Sprintf("Option %s 的输入 %s 无法转换为 %s: %v", optionName, name, typeName, err), Pointer: "/option/" + escapePointer(optionName) + "/inputs"})
			continue
		}
		result[name] = converted
	}
	return result
}

func convertInputValue(value any, typeName string) (any, error) {
	switch strings.ToLower(strings.TrimSpace(typeName)) {
	case "", "string":
		if text, ok := value.(string); ok {
			return text, nil
		}
		return fmt.Sprint(value), nil
	case "int":
		switch typed := value.(type) {
		case float64:
			if typed != float64(int64(typed)) {
				return nil, fmt.Errorf("不是整数")
			}
			return int64(typed), nil
		case string:
			return strconv.ParseInt(strings.TrimSpace(typed), 10, 64)
		default:
			return nil, fmt.Errorf("值类型不支持")
		}
	case "bool":
		if typed, ok := value.(bool); ok {
			return typed, nil
		}
		if typed, ok := value.(string); ok {
			return strconv.ParseBool(strings.TrimSpace(typed))
		}
		return nil, fmt.Errorf("值类型不支持")
	default:
		return nil, fmt.Errorf("未知 pipeline_type")
	}
}

func resolveHotkeyReplacements(definition map[string]any, value any, controllerType string, diagnostics *[]Diagnostic, optionName string) map[string]any {
	provided, _ := value.(map[string]any)
	result := map[string]any{}
	for _, field := range objectArray(definition["hotkeys"]) {
		name, _ := field["name"].(string)
		gesture, _ := provided[name].(string)
		if strings.TrimSpace(gesture) == "" {
			gesture, _ = field["default"].(string)
		}
		parts := strings.Split(gesture, "+")
		keys := make([]string, 0, len(parts))
		for _, part := range parts {
			if key := strings.TrimSpace(part); key != "" {
				keys = append(keys, key)
			}
		}
		primary, modifiers := "", []string{}
		if len(keys) > 0 {
			primary, modifiers = keys[len(keys)-1], keys[:len(keys)-1]
		}
		primaryCode, ok := virtualKeyCode(controllerType, primary)
		if !ok {
			*diagnostics = append(*diagnostics, Diagnostic{Severity: "error", Category: "platform", Code: "pi.hotkey.unsupported", Message: fmt.Sprintf("Option %s 的快捷键 %s 无法映射到 %s 控制器", optionName, gesture, controllerType), Pointer: "/option/" + escapePointer(optionName)})
		}
		result[name] = primaryCode
		result[name+".primary"] = primaryCode
		for index := 0; index < 2; index++ {
			code := 0
			if index < len(modifiers) {
				var modifierOK bool
				code, modifierOK = virtualKeyCode(controllerType, modifiers[index])
				if !modifierOK {
					*diagnostics = append(*diagnostics, Diagnostic{Severity: "error", Category: "platform", Code: "pi.hotkey.unsupported", Message: fmt.Sprintf("Option %s 的修饰键 %s 无法映射到 %s 控制器", optionName, modifiers[index], controllerType), Pointer: "/option/" + escapePointer(optionName)})
				}
			}
			result[fmt.Sprintf("%s.modifier%d", name, index+1)] = code
		}
	}
	return result
}

func virtualKeyCode(controllerType, key string) (int, bool) {
	key = strings.ToUpper(strings.TrimSpace(key))
	if key == "" {
		return 0, true
	}
	if key == "CONTROL" {
		key = "CTRL"
	} else if key == "ESCAPE" {
		key = "ESC"
	}
	if len(key) == 1 {
		char := key[0]
		switch strings.ToLower(controllerType) {
		case "win32":
			if (char >= 'A' && char <= 'Z') || (char >= '0' && char <= '9') {
				return int(char), true
			}
		case "adb":
			if char >= 'A' && char <= 'Z' {
				return 29 + int(char-'A'), true
			}
			if char >= '0' && char <= '9' {
				return 7 + int(char-'0'), true
			}
		case "wlroots", "linux", "kwin":
			if code, ok := linuxLetterCodes[char]; ok {
				return code, true
			}
			if char >= '1' && char <= '9' {
				return 2 + int(char-'1'), true
			}
			if char == '0' {
				return 11, true
			}
		case "macos", "playcover":
			if code, ok := macKeyCodes[key]; ok {
				return code, true
			}
		}
	}
	if strings.HasPrefix(key, "F") {
		var number int
		if _, err := fmt.Sscanf(key, "F%d", &number); err == nil && number >= 1 && number <= 24 {
			switch strings.ToLower(controllerType) {
			case "win32":
				return 0x6F + number, true
			case "adb":
				return 130 + number, true
			case "wlroots", "linux", "kwin":
				return 58 + number, true
			}
		}
	}
	var table map[string]int
	switch strings.ToLower(controllerType) {
	case "win32":
		table = map[string]int{"CTRL": 0x11, "SHIFT": 0x10, "ALT": 0x12, "ENTER": 0x0D, "ESC": 0x1B, "SPACE": 0x20, "TAB": 0x09, "BACKSPACE": 0x08, "DELETE": 0x2E, "UP": 0x26, "DOWN": 0x28, "LEFT": 0x25, "RIGHT": 0x27}
	case "adb":
		table = map[string]int{"CTRL": 113, "SHIFT": 59, "ALT": 57, "ENTER": 66, "ESC": 111, "SPACE": 62, "TAB": 61, "BACKSPACE": 67, "DELETE": 112, "UP": 19, "DOWN": 20, "LEFT": 21, "RIGHT": 22}
	case "wlroots", "linux", "kwin":
		table = map[string]int{"CTRL": 29, "SHIFT": 42, "ALT": 56, "ENTER": 28, "ESC": 1, "SPACE": 57, "TAB": 15, "BACKSPACE": 14, "DELETE": 111, "UP": 103, "DOWN": 108, "LEFT": 105, "RIGHT": 106}
	case "macos", "playcover":
		table = macKeyCodes
	default:
		return 0, false
	}
	code, ok := table[key]
	return code, ok
}

var linuxLetterCodes = map[byte]int{'A': 30, 'B': 48, 'C': 46, 'D': 32, 'E': 18, 'F': 33, 'G': 34, 'H': 35, 'I': 23, 'J': 36, 'K': 37, 'L': 38, 'M': 50, 'N': 49, 'O': 24, 'P': 25, 'Q': 16, 'R': 19, 'S': 31, 'T': 20, 'U': 22, 'V': 47, 'W': 17, 'X': 45, 'Y': 21, 'Z': 44}
var macKeyCodes = map[string]int{"A": 0, "S": 1, "D": 2, "F": 3, "H": 4, "G": 5, "Z": 6, "X": 7, "C": 8, "V": 9, "B": 11, "Q": 12, "W": 13, "E": 14, "R": 15, "Y": 16, "T": 17, "1": 18, "2": 19, "3": 20, "4": 21, "6": 22, "5": 23, "9": 25, "7": 26, "8": 28, "0": 29, "O": 31, "U": 32, "I": 34, "P": 35, "ENTER": 36, "L": 37, "J": 38, "K": 40, "N": 45, "M": 46, "TAB": 48, "SPACE": 49, "BACKSPACE": 51, "ESC": 53, "SHIFT": 56, "ALT": 58, "CTRL": 59, "DELETE": 117, "LEFT": 123, "RIGHT": 124, "DOWN": 125, "UP": 126}

func defaultOptionValue(typeName string, definition map[string]any) any {
	switch typeName {
	case "checkbox":
		if value, ok := definition["default_case"].([]any); ok {
			return value
		}
		return []any{}
	case "input":
		result := map[string]any{}
		for _, input := range objectArray(definition["inputs"]) {
			name, _ := input["name"].(string)
			value, _ := input["default"].(string)
			result[name] = value
		}
		return result
	case "hotkey":
		result := map[string]any{}
		for _, input := range objectArray(definition["hotkeys"]) {
			name, _ := input["name"].(string)
			value, _ := input["default"].(string)
			result[name] = value
		}
		return result
	default:
		if value, ok := definition["default_case"].(string); ok {
			return value
		}
		cases := objectArray(definition["cases"])
		if len(cases) > 0 {
			if value, ok := cases[0]["name"].(string); ok {
				return value
			}
		}
		return ""
	}
}

func appendPipelineOverride(target *[]map[string]any, value any, replacements map[string]any) {
	override, ok := value.(map[string]any)
	if !ok {
		return
	}
	keys := make([]string, 0, len(override))
	for key := range override {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, runtimeName := range keys {
		pipeline, ok := override[runtimeName].(map[string]any)
		if !ok {
			continue
		}
		processed := replaceTemplates(cloneMap(pipeline), replacements).(map[string]any)
		*target = append(*target, map[string]any{"runtimeName": runtimeName, "pipeline": processed})
	}
}

func replaceTemplates(value any, replacements map[string]any) any {
	if len(replacements) == 0 {
		return value
	}
	switch typed := value.(type) {
	case string:
		for key, replacement := range replacements {
			placeholder := "{" + key + "}"
			if typed == placeholder {
				return replacement
			}
			typed = strings.ReplaceAll(typed, placeholder, fmt.Sprint(replacement))
		}
		return typed
	case []any:
		for index, item := range typed {
			typed[index] = replaceTemplates(item, replacements)
		}
		return typed
	case map[string]any:
		for key, item := range typed {
			typed[key] = replaceTemplates(item, replacements)
		}
		return typed
	default:
		return value
	}
}

func findNamed(items []map[string]any, name string) map[string]any {
	for _, item := range items {
		if itemName, _ := item["name"].(string); itemName == name {
			return item
		}
	}
	return nil
}
func optionApplicable(option map[string]any, controller, resource string) bool {
	controllers := stringSlice(option["controller"])
	resources := stringSlice(option["resource"])
	return (len(controllers) == 0 || containsString(controllers, controller)) && (len(resources) == 0 || containsString(resources, resource))
}
func containsString(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}
func toStringValues(value any) []string {
	if strings, ok := value.([]string); ok {
		return strings
	}
	return stringSlice(value)
}

func compactJSON(value any) string { raw, _ := json.Marshal(value); return string(raw) }
