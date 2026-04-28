package interfaceimport

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/protocol"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/runutil"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/utils"
)

type Service struct {
	root string
}

func NewService(root string) *Service {
	return &Service{root: root}
}

func (s *Service) Import(path string) (protocol.InterfaceImportResult, error) {
	interfacePath, err := s.resolveInterfacePath(path)
	if err != nil {
		return protocol.InterfaceImportResult{}, err
	}

	pi, err := s.loadMergedInterface(interfacePath, map[string]bool{})
	if err != nil {
		return protocol.InterfaceImportResult{}, err
	}
	if pi.InterfaceVersion != 2 {
		return protocol.InterfaceImportResult{}, fmt.Errorf("仅支持 ProjectInterface v2，当前为: %d", pi.InterfaceVersion)
	}

	controller := selectController(pi.Controllers)
	resource := selectResource(pi.Resources, controller)
	task := selectTask(pi.Tasks, controller, resource)
	agentProfiles, agentDiagnostics := importAgents(pi.Agents, filepath.Dir(interfacePath), pi, controller, resource)

	resourcePaths := resourcePathsFor(resource, controller)
	entry := protocol.NodeTarget{}
	entryName := ""
	if task != nil {
		entry.RuntimeName = strings.TrimSpace(task.Entry)
		entryName = entry.RuntimeName
	}

	profileName := firstNonEmpty(pi.Label, pi.Name, filepath.Base(filepath.Dir(interfacePath)))
	controllerType := "adb"
	if controller != nil {
		controllerType = normalizeControllerType(controller.Type)
	}

	optionValues := defaultOptionValues(pi.Options)
	selections := protocol.InterfaceImportSelections{
		ControllerName: nameOfController(controller),
		ResourceName:   nameOfResource(resource),
		TaskName:       nameOfTask(task),
		OptionValues:   optionValues,
	}
	overrides := buildOverrides(pi, selections)

	diagnostics := make([]protocol.Diagnostic, 0, len(agentDiagnostics)+2)
	diagnostics = append(diagnostics, agentDiagnostics...)
	if resource == nil {
		diagnostics = append(diagnostics, protocol.Diagnostic{
			Severity: "warning",
			Code:     "debug.interface.resource_missing",
			Message:  "interface.json 未声明 resource",
		})
	}
	if task == nil {
		diagnostics = append(diagnostics, protocol.Diagnostic{
			Severity: "warning",
			Code:     "debug.interface.task_missing",
			Message:  "interface.json 未声明 task，已导入 profile 但未设置入口",
		})
	}

	return protocol.InterfaceImportResult{
		Profile: protocol.RunProfile{
			ID:   "interface-" + uuid.NewString(),
			Name: profileName,
			Interfaces: []protocol.ProfileInterface{{
				ID:      "default",
				Path:    interfacePath,
				Enabled: true,
			}},
			ResourcePaths: resourcePaths,
			Controller: protocol.ControllerProfile{
				Type:    controllerType,
				Options: map[string]interface{}{},
			},
			Agents:     agentProfiles,
			Entry:      entry,
			SavePolicy: "sandbox",
			MaaOptions: map[string]interface{}{
				"debugMode":   true,
				"saveDraw":    true,
				"saveOnError": true,
				"drawQuality": 80,
			},
		},
		EntryName:   entryName,
		Diagnostics: diagnostics,
		Selections:  selections,
		Controllers: exportControllers(pi.Controllers),
		Resources:   exportResources(pi.Resources),
		Tasks:       exportTasks(pi.Tasks),
		Presets:     exportPresets(pi.Presets),
		Options:     exportOptions(pi.Options),
		Overrides:   overrides,
	}, nil
}

func (s *Service) resolveInterfacePath(path string) (string, error) {
	raw := strings.TrimSpace(path)
	if raw == "" {
		return "", fmt.Errorf("缺少 interface.json 路径")
	}
	candidate := filepath.Clean(raw)
	if !filepath.IsAbs(candidate) {
		if strings.TrimSpace(s.root) == "" {
			return "", fmt.Errorf("相对路径需要项目根目录")
		}
		candidate = filepath.Join(s.root, candidate)
	}
	abs, err := filepath.Abs(candidate)
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(s.root) != "" && !runutil.IsPathWithin(abs, s.root) {
		return "", fmt.Errorf("interface.json 必须位于项目根目录内: %s", abs)
	}
	info, err := os.Stat(abs)
	if err != nil {
		return "", err
	}
	if info.IsDir() {
		abs = filepath.Join(abs, "interface.json")
	}
	return abs, nil
}

func (s *Service) loadMergedInterface(path string, visited map[string]bool) (projectInterface, error) {
	abs, err := filepath.Abs(path)
	if err != nil {
		return projectInterface{}, err
	}
	if visited[abs] {
		return projectInterface{}, nil
	}
	visited[abs] = true

	data, err := os.ReadFile(abs)
	if err != nil {
		return projectInterface{}, fmt.Errorf("读取 interface.json 失败: %w", err)
	}

	var pi projectInterface
	if err := utils.ParseJSONC(data, &pi); err != nil {
		return projectInterface{}, fmt.Errorf("解析 interface.json 失败: %w", err)
	}
	pi.BaseDir = filepath.Dir(abs)
	pi.markBaseDir()

	merged := projectInterface{InterfaceVersion: pi.InterfaceVersion, BaseDir: pi.BaseDir}
	for _, item := range pi.Imports {
		importPath := resolvePIPath(pi.BaseDir, item)
		imported, err := s.loadMergedInterface(importPath, visited)
		if err != nil {
			return projectInterface{}, err
		}
		mergeProjectInterface(&merged, imported)
	}
	mergeProjectInterface(&merged, pi)
	return merged, nil
}

type projectInterface struct {
	InterfaceVersion int                 `json:"interface_version"`
	Name             string              `json:"name"`
	Label            string              `json:"label"`
	Version          string              `json:"version"`
	Imports          []string            `json:"import"`
	GlobalOptions    []string            `json:"global_option"`
	Resources        []piResource        `json:"resource"`
	Controllers      []piController      `json:"controller"`
	Tasks            []piTask            `json:"task"`
	Options          map[string]piOption `json:"option"`
	Presets          []piPreset          `json:"preset"`
	Agents           json.RawMessage     `json:"agent"`
	BaseDir          string              `json:"-"`
}

type piResource struct {
	Name        string      `json:"name"`
	Label       string      `json:"label"`
	Paths       stringSlice `json:"path"`
	Controllers stringSlice `json:"controller"`
	Options     []string    `json:"option"`
	BaseDir     string      `json:"-"`
}

type piController struct {
	Name                string                 `json:"name"`
	Label               string                 `json:"label"`
	Type                string                 `json:"type"`
	AttachResourcePaths stringSlice            `json:"attach_resource_path"`
	Options             []string               `json:"option"`
	BaseDir             string                 `json:"-"`
	Raw                 map[string]interface{} `json:"-"`
}

type piTask struct {
	Name             string                 `json:"name"`
	Label            string                 `json:"label"`
	Entry            string                 `json:"entry"`
	DefaultCheck     bool                   `json:"default_check"`
	Resources        stringSlice            `json:"resource"`
	Controllers      stringSlice            `json:"controller"`
	Options          []string               `json:"option"`
	PipelineOverride map[string]interface{} `json:"pipeline_override"`
}

type piOption struct {
	Type             string                 `json:"type"`
	Label            string                 `json:"label"`
	Controllers      stringSlice            `json:"controller"`
	Resources        stringSlice            `json:"resource"`
	Cases            []piOptionCase         `json:"cases"`
	Inputs           []piOptionInput        `json:"inputs"`
	PipelineOverride map[string]interface{} `json:"pipeline_override"`
	DefaultCase      json.RawMessage        `json:"default_case"`
}

type piOptionCase struct {
	Name             string                 `json:"name"`
	Label            string                 `json:"label"`
	Options          []string               `json:"option"`
	PipelineOverride map[string]interface{} `json:"pipeline_override"`
}

type piOptionInput struct {
	Name         string `json:"name"`
	Label        string `json:"label"`
	Default      string `json:"default"`
	PipelineType string `json:"pipeline_type"`
	Verify       string `json:"verify"`
	PatternMsg   string `json:"pattern_msg"`
}

type piPreset struct {
	Name  string         `json:"name"`
	Label string         `json:"label"`
	Tasks []piPresetTask `json:"task"`
}

type piPresetTask struct {
	Name    string                 `json:"name"`
	Enabled *bool                  `json:"enabled"`
	Option  map[string]interface{} `json:"option"`
}

type piAgent struct {
	ChildExec  string   `json:"child_exec"`
	ChildArgs  []string `json:"child_args"`
	Identifier string   `json:"identifier"`
}

type stringSlice []string

func (s *stringSlice) UnmarshalJSON(data []byte) error {
	if string(data) == "null" {
		*s = nil
		return nil
	}
	var values []string
	if err := json.Unmarshal(data, &values); err == nil {
		*s = values
		return nil
	}
	var single string
	if err := json.Unmarshal(data, &single); err != nil {
		return err
	}
	*s = []string{single}
	return nil
}

func (pi *projectInterface) markBaseDir() {
	for i := range pi.Resources {
		pi.Resources[i].BaseDir = pi.BaseDir
	}
	for i := range pi.Controllers {
		pi.Controllers[i].BaseDir = pi.BaseDir
		pi.Controllers[i].Raw = rawMap(pi.Controllers[i])
	}
}

func mergeProjectInterface(dst *projectInterface, src projectInterface) {
	if src.InterfaceVersion != 0 {
		dst.InterfaceVersion = src.InterfaceVersion
	}
	if src.Name != "" {
		dst.Name = src.Name
	}
	if src.Label != "" {
		dst.Label = src.Label
	}
	if src.Version != "" {
		dst.Version = src.Version
	}
	dst.GlobalOptions = appendUnique(dst.GlobalOptions, src.GlobalOptions...)
	dst.Resources = mergeResources(dst.Resources, src.Resources)
	dst.Controllers = mergeControllers(dst.Controllers, src.Controllers)
	dst.Tasks = mergeTasks(dst.Tasks, src.Tasks)
	if dst.Options == nil {
		dst.Options = map[string]piOption{}
	}
	for key, option := range src.Options {
		dst.Options[key] = option
	}
	dst.Presets = mergePresets(dst.Presets, src.Presets)
	if len(src.Agents) > 0 && string(src.Agents) != "null" {
		dst.Agents = src.Agents
	}
}

func mergeResources(dst []piResource, src []piResource) []piResource {
	index := namedResourceIndex(dst)
	for _, item := range src {
		if item.Name == "" {
			dst = append(dst, item)
			continue
		}
		if existing, ok := index[item.Name]; ok {
			dst[existing] = item
		} else {
			index[item.Name] = len(dst)
			dst = append(dst, item)
		}
	}
	return dst
}

func mergeControllers(dst []piController, src []piController) []piController {
	index := namedControllerIndex(dst)
	for _, item := range src {
		if item.Name == "" {
			dst = append(dst, item)
			continue
		}
		if existing, ok := index[item.Name]; ok {
			dst[existing] = item
		} else {
			index[item.Name] = len(dst)
			dst = append(dst, item)
		}
	}
	return dst
}

func mergeTasks(dst []piTask, src []piTask) []piTask {
	index := namedTaskIndex(dst)
	for _, item := range src {
		if item.Name == "" {
			dst = append(dst, item)
			continue
		}
		if existing, ok := index[item.Name]; ok {
			dst[existing] = item
		} else {
			index[item.Name] = len(dst)
			dst = append(dst, item)
		}
	}
	return dst
}

func mergePresets(dst []piPreset, src []piPreset) []piPreset {
	index := namedPresetIndex(dst)
	for _, item := range src {
		if item.Name == "" {
			dst = append(dst, item)
			continue
		}
		if existing, ok := index[item.Name]; ok {
			dst[existing] = item
		} else {
			index[item.Name] = len(dst)
			dst = append(dst, item)
		}
	}
	return dst
}

func selectController(controllers []piController) *piController {
	if len(controllers) == 0 {
		return nil
	}
	return &controllers[0]
}

func selectResource(resources []piResource, controller *piController) *piResource {
	if len(resources) == 0 {
		return nil
	}
	for i := range resources {
		if supportsController(resources[i].Controllers, nameOfController(controller)) {
			return &resources[i]
		}
	}
	return &resources[0]
}

func selectTask(tasks []piTask, controller *piController, resource *piResource) *piTask {
	if len(tasks) == 0 {
		return nil
	}
	controllerName := nameOfController(controller)
	resourceName := nameOfResource(resource)
	for i := range tasks {
		if tasks[i].DefaultCheck &&
			supportsController(tasks[i].Controllers, controllerName) &&
			supportsResource(tasks[i].Resources, resourceName) {
			return &tasks[i]
		}
	}
	for i := range tasks {
		if supportsController(tasks[i].Controllers, controllerName) &&
			supportsResource(tasks[i].Resources, resourceName) {
			return &tasks[i]
		}
	}
	return &tasks[0]
}

func resourcePathsFor(resource *piResource, controller *piController) []string {
	paths := make([]string, 0)
	if resource != nil {
		for _, item := range resource.Paths {
			paths = append(paths, resolvePIPath(resource.BaseDir, item))
		}
	}
	if controller != nil {
		for _, item := range controller.AttachResourcePaths {
			paths = append(paths, resolvePIPath(controller.BaseDir, item))
		}
	}
	return paths
}

func importAgents(raw json.RawMessage, baseDir string, pi projectInterface, controller *piController, resource *piResource) ([]protocol.AgentProfile, []protocol.Diagnostic) {
	if len(raw) == 0 || string(raw) == "null" {
		return nil, nil
	}

	var agents []piAgent
	if raw[0] == '[' {
		if err := json.Unmarshal(raw, &agents); err != nil {
			return nil, []protocol.Diagnostic{{
				Severity: "warning",
				Code:     "debug.interface.agent_parse_failed",
				Message:  "agent 配置解析失败: " + err.Error(),
			}}
		}
	} else {
		var agent piAgent
		if err := json.Unmarshal(raw, &agent); err != nil {
			return nil, []protocol.Diagnostic{{
				Severity: "warning",
				Code:     "debug.interface.agent_parse_failed",
				Message:  "agent 配置解析失败: " + err.Error(),
			}}
		}
		agents = []piAgent{agent}
	}

	profiles := make([]protocol.AgentProfile, 0, len(agents))
	diagnostics := make([]protocol.Diagnostic, 0)
	for index, agent := range agents {
		identifier := strings.TrimSpace(agent.Identifier)
		env := piEnvironment(pi, controller, resource)
		if identifier != "" {
			env["PI_AGENT_IDENTIFIER"] = identifier
			env["MAA_AGENT_IDENTIFIER"] = identifier
		}
		profiles = append(profiles, protocol.AgentProfile{
			ID:         fmt.Sprintf("agent-%d", index+1),
			Enabled:    identifier != "",
			Transport:  "identifier",
			LaunchMode: "manual",
			Identifier: identifier,
			ChildExec:  agent.ChildExec,
			ChildArgs:  agent.ChildArgs,
			WorkingDir: baseDir,
			Env:        env,
		})
		if identifier == "" {
			diagnostics = append(diagnostics, protocol.Diagnostic{
				Severity: "info",
				Code:     "debug.interface.agent_manual_default",
				Message:  "agent 已按默认手动模式导入；可切换为 managed 后由 LocalBridge 托管 child_exec",
				Data: map[string]interface{}{
					"index":     index,
					"childExec": agent.ChildExec,
					"childArgs": agent.ChildArgs,
				},
			})
		}
	}
	return profiles, diagnostics
}

func defaultOptionValues(options map[string]piOption) map[string]interface{} {
	values := make(map[string]interface{}, len(options))
	keys := make([]string, 0, len(options))
	for key := range options {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, key := range keys {
		values[key] = defaultOptionValue(options[key])
	}
	return values
}

func defaultOptionValue(option piOption) interface{} {
	optionType := normalizedOptionType(option.Type)
	if len(option.DefaultCase) > 0 && string(option.DefaultCase) != "null" {
		if optionType == "checkbox" {
			var values []string
			if err := json.Unmarshal(option.DefaultCase, &values); err == nil {
				return values
			}
		}
		var value string
		if err := json.Unmarshal(option.DefaultCase, &value); err == nil {
			if optionType == "checkbox" {
				return []string{value}
			}
			return value
		}
	}
	if optionType == "input" {
		result := make(map[string]string, len(option.Inputs))
		for _, input := range option.Inputs {
			result[input.Name] = input.Default
		}
		return result
	}
	if optionType == "checkbox" {
		return []string{}
	}
	if len(option.Cases) > 0 {
		return option.Cases[0].Name
	}
	return ""
}

func buildOverrides(pi projectInterface, selections protocol.InterfaceImportSelections) []protocol.PipelineOverride {
	controllerName := selections.ControllerName
	resourceName := selections.ResourceName
	taskName := selections.TaskName
	controller := findController(pi.Controllers, controllerName)
	resource := findResource(pi.Resources, resourceName)
	task := findTask(pi.Tasks, taskName)
	values := selections.OptionValues
	if values == nil {
		values = defaultOptionValues(pi.Options)
	}

	merged := map[string]interface{}{}
	visited := map[string]bool{}
	applyOptionList(merged, pi, pi.GlobalOptions, values, controllerName, resourceName, visited)
	if resource != nil {
		applyOptionList(merged, pi, resource.Options, values, controllerName, resourceName, visited)
	}
	if controller != nil {
		applyOptionList(merged, pi, controller.Options, values, controllerName, resourceName, visited)
	}
	if task != nil {
		mergePipeline(merged, task.PipelineOverride)
		applyOptionList(merged, pi, task.Options, values, controllerName, resourceName, visited)
	}
	return pipelineOverrideList(merged)
}

func applyOptionList(target map[string]interface{}, pi projectInterface, optionNames []string, values map[string]interface{}, controllerName string, resourceName string, visited map[string]bool) {
	for _, optionName := range optionNames {
		applyOption(target, pi, strings.TrimSpace(optionName), values, controllerName, resourceName, visited)
	}
}

func applyOption(target map[string]interface{}, pi projectInterface, optionName string, values map[string]interface{}, controllerName string, resourceName string, visited map[string]bool) {
	if optionName == "" || visited[optionName] {
		return
	}
	option, ok := pi.Options[optionName]
	if !ok || !optionActive(option, controllerName, resourceName) {
		return
	}
	visited[optionName] = true
	defer delete(visited, optionName)

	optionType := normalizedOptionType(option.Type)
	value, ok := values[optionName]
	if !ok {
		value = defaultOptionValue(option)
	}

	if optionType == "input" {
		inputValues := inputValueMap(value, option.Inputs)
		mergePipeline(target, substituteInputValues(option.PipelineOverride, option.Inputs, inputValues))
		return
	}

	if optionType == "checkbox" {
		selected := stringSetFromValue(value)
		for _, item := range option.Cases {
			if selected[item.Name] {
				mergePipeline(target, item.PipelineOverride)
				applyOptionList(target, pi, item.Options, values, controllerName, resourceName, visited)
			}
		}
		return
	}

	selected := stringFromValue(value)
	for _, item := range option.Cases {
		if item.Name == selected {
			mergePipeline(target, item.PipelineOverride)
			applyOptionList(target, pi, item.Options, values, controllerName, resourceName, visited)
			return
		}
	}
}

func mergePipeline(target map[string]interface{}, source map[string]interface{}) {
	for nodeName, sourceNode := range source {
		if existingNode, ok := target[nodeName].(map[string]interface{}); ok {
			if sourceMap, ok := sourceNode.(map[string]interface{}); ok {
				target[nodeName] = deepMerge(existingNode, sourceMap)
				continue
			}
		}
		target[nodeName] = cloneValue(sourceNode)
	}
}

func deepMerge(existing map[string]interface{}, source map[string]interface{}) map[string]interface{} {
	result := make(map[string]interface{}, len(existing)+len(source))
	for key, value := range existing {
		result[key] = cloneValue(value)
	}
	for key, value := range source {
		if existingMap, ok := result[key].(map[string]interface{}); ok {
			if sourceMap, ok := value.(map[string]interface{}); ok {
				result[key] = deepMerge(existingMap, sourceMap)
				continue
			}
		}
		result[key] = cloneValue(value)
	}
	return result
}

func pipelineOverrideList(merged map[string]interface{}) []protocol.PipelineOverride {
	keys := make([]string, 0, len(merged))
	for key := range merged {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	result := make([]protocol.PipelineOverride, 0, len(keys))
	for _, key := range keys {
		node, ok := merged[key].(map[string]interface{})
		if !ok {
			node = map[string]interface{}{"value": merged[key]}
		}
		result = append(result, protocol.PipelineOverride{
			RuntimeName: key,
			Pipeline:    node,
		})
	}
	return result
}

func substituteInputValues(source map[string]interface{}, inputs []piOptionInput, values map[string]string) map[string]interface{} {
	if source == nil {
		return nil
	}
	result := make(map[string]interface{}, len(source))
	for key, value := range source {
		result[key] = substituteValue(value, inputs, values)
	}
	return result
}

func substituteValue(value interface{}, inputs []piOptionInput, values map[string]string) interface{} {
	switch typed := value.(type) {
	case string:
		return substituteString(typed, inputs, values)
	case []interface{}:
		result := make([]interface{}, len(typed))
		for i, item := range typed {
			result[i] = substituteValue(item, inputs, values)
		}
		return result
	case map[string]interface{}:
		result := make(map[string]interface{}, len(typed))
		for key, item := range typed {
			result[key] = substituteValue(item, inputs, values)
		}
		return result
	default:
		return typed
	}
}

func substituteString(value string, inputs []piOptionInput, values map[string]string) interface{} {
	for _, input := range inputs {
		placeholder := "{" + input.Name + "}"
		inputValue := values[input.Name]
		if value == placeholder {
			return convertInputValue(inputValue, input.PipelineType)
		}
		value = strings.ReplaceAll(value, placeholder, inputValue)
	}
	return value
}

func convertInputValue(value string, pipelineType string) interface{} {
	switch strings.ToLower(strings.TrimSpace(pipelineType)) {
	case "int":
		parsed, err := strconv.Atoi(value)
		if err == nil {
			return parsed
		}
	case "bool":
		parsed, err := strconv.ParseBool(value)
		if err == nil {
			return parsed
		}
	}
	return value
}

func exportControllers(values []piController) []protocol.InterfaceImportController {
	result := make([]protocol.InterfaceImportController, 0, len(values))
	for _, value := range values {
		paths := make([]string, 0, len(value.AttachResourcePaths))
		for _, item := range value.AttachResourcePaths {
			paths = append(paths, resolvePIPath(value.BaseDir, item))
		}
		result = append(result, protocol.InterfaceImportController{
			Name:                value.Name,
			Label:               value.Label,
			Type:                normalizeControllerType(value.Type),
			AttachResourcePaths: paths,
			Options:             append([]string{}, value.Options...),
			Raw:                 value.Raw,
		})
	}
	return result
}

func exportResources(values []piResource) []protocol.InterfaceImportResource {
	result := make([]protocol.InterfaceImportResource, 0, len(values))
	for _, value := range values {
		paths := make([]string, 0, len(value.Paths))
		for _, item := range value.Paths {
			paths = append(paths, resolvePIPath(value.BaseDir, item))
		}
		result = append(result, protocol.InterfaceImportResource{
			Name:        value.Name,
			Label:       value.Label,
			Paths:       paths,
			Controllers: append([]string{}, value.Controllers...),
			Options:     append([]string{}, value.Options...),
		})
	}
	return result
}

func exportTasks(values []piTask) []protocol.InterfaceImportTask {
	result := make([]protocol.InterfaceImportTask, 0, len(values))
	for _, value := range values {
		result = append(result, protocol.InterfaceImportTask{
			Name:             value.Name,
			Label:            value.Label,
			Entry:            value.Entry,
			DefaultCheck:     value.DefaultCheck,
			Resources:        append([]string{}, value.Resources...),
			Controllers:      append([]string{}, value.Controllers...),
			Options:          append([]string{}, value.Options...),
			PipelineOverride: cloneMap(value.PipelineOverride),
		})
	}
	return result
}

func exportPresets(values []piPreset) []protocol.InterfaceImportPreset {
	result := make([]protocol.InterfaceImportPreset, 0, len(values))
	for _, value := range values {
		tasks := make([]protocol.InterfaceImportPresetTask, 0, len(value.Tasks))
		for _, task := range value.Tasks {
			tasks = append(tasks, protocol.InterfaceImportPresetTask{
				Name:    task.Name,
				Enabled: task.Enabled,
				Option:  cloneMap(task.Option),
			})
		}
		result = append(result, protocol.InterfaceImportPreset{
			Name:  value.Name,
			Label: value.Label,
			Tasks: tasks,
		})
	}
	return result
}

func exportOptions(values map[string]piOption) []protocol.InterfaceImportOption {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	result := make([]protocol.InterfaceImportOption, 0, len(keys))
	for _, key := range keys {
		option := values[key]
		cases := make([]protocol.InterfaceImportOptionCase, 0, len(option.Cases))
		for _, item := range option.Cases {
			cases = append(cases, protocol.InterfaceImportOptionCase{
				Name:             item.Name,
				Label:            item.Label,
				Options:          append([]string{}, item.Options...),
				PipelineOverride: cloneMap(item.PipelineOverride),
			})
		}
		inputs := make([]protocol.InterfaceImportOptionInput, 0, len(option.Inputs))
		for _, input := range option.Inputs {
			inputs = append(inputs, protocol.InterfaceImportOptionInput{
				Name:         input.Name,
				Label:        input.Label,
				Default:      input.Default,
				PipelineType: input.PipelineType,
				Verify:       input.Verify,
				PatternMsg:   input.PatternMsg,
			})
		}
		result = append(result, protocol.InterfaceImportOption{
			Name:             key,
			Label:            option.Label,
			Type:             normalizedOptionType(option.Type),
			Controllers:      append([]string{}, option.Controllers...),
			Resources:        append([]string{}, option.Resources...),
			DefaultValue:     defaultOptionValue(option),
			Cases:            cases,
			Inputs:           inputs,
			PipelineOverride: cloneMap(option.PipelineOverride),
		})
	}
	return result
}

func piEnvironment(pi projectInterface, controller *piController, resource *piResource) map[string]string {
	env := map[string]string{
		"PI_INTERFACE_VERSION":    "v2.5.0",
		"PI_CLIENT_NAME":          "MPE",
		"PI_CLIENT_VERSION":       "unknown",
		"PI_CLIENT_LANGUAGE":      "",
		"PI_CLIENT_MAAFW_VERSION": "unknown",
		"PI_VERSION":              pi.Version,
	}
	if controller != nil {
		env["PI_CONTROLLER"] = compactJSON(rawMap(*controller))
	}
	if resource != nil {
		env["PI_RESOURCE"] = compactJSON(rawMap(*resource))
	}
	return env
}

func normalizeControllerType(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "win32":
		return "win32"
	case "dbg":
		return "dbg"
	case "replay":
		return "replay"
	case "record":
		return "record"
	default:
		return "adb"
	}
}

func normalizedOptionType(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "checkbox", "input", "switch":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return "select"
	}
}

func optionActive(option piOption, controllerName string, resourceName string) bool {
	return supportsController(option.Controllers, controllerName) && supportsResource(option.Resources, resourceName)
}

func supportsController(allowed []string, controllerName string) bool {
	if len(allowed) == 0 || controllerName == "" {
		return true
	}
	for _, item := range allowed {
		if item == controllerName {
			return true
		}
	}
	return false
}

func supportsResource(allowed []string, resourceName string) bool {
	if len(allowed) == 0 || resourceName == "" {
		return true
	}
	for _, item := range allowed {
		if item == resourceName {
			return true
		}
	}
	return false
}

func findController(values []piController, name string) *piController {
	for i := range values {
		if values[i].Name == name {
			return &values[i]
		}
	}
	return nil
}

func findResource(values []piResource, name string) *piResource {
	for i := range values {
		if values[i].Name == name {
			return &values[i]
		}
	}
	return nil
}

func findTask(values []piTask, name string) *piTask {
	for i := range values {
		if values[i].Name == name {
			return &values[i]
		}
	}
	return nil
}

func namedResourceIndex(values []piResource) map[string]int {
	result := make(map[string]int, len(values))
	for i, item := range values {
		if item.Name != "" {
			result[item.Name] = i
		}
	}
	return result
}

func namedControllerIndex(values []piController) map[string]int {
	result := make(map[string]int, len(values))
	for i, item := range values {
		if item.Name != "" {
			result[item.Name] = i
		}
	}
	return result
}

func namedTaskIndex(values []piTask) map[string]int {
	result := make(map[string]int, len(values))
	for i, item := range values {
		if item.Name != "" {
			result[item.Name] = i
		}
	}
	return result
}

func namedPresetIndex(values []piPreset) map[string]int {
	result := make(map[string]int, len(values))
	for i, item := range values {
		if item.Name != "" {
			result[item.Name] = i
		}
	}
	return result
}

func nameOfController(value *piController) string {
	if value == nil {
		return ""
	}
	return value.Name
}

func nameOfResource(value *piResource) string {
	if value == nil {
		return ""
	}
	return value.Name
}

func nameOfTask(value *piTask) string {
	if value == nil {
		return ""
	}
	return value.Name
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func resolvePIPath(baseDir string, path string) string {
	clean := filepath.Clean(strings.TrimSpace(path))
	if filepath.IsAbs(clean) {
		return clean
	}
	return filepath.Join(baseDir, clean)
}

func appendUnique(values []string, additions ...string) []string {
	seen := make(map[string]bool, len(values)+len(additions))
	result := make([]string, 0, len(values)+len(additions))
	for _, value := range values {
		if value == "" || seen[value] {
			continue
		}
		seen[value] = true
		result = append(result, value)
	}
	for _, value := range additions {
		if value == "" || seen[value] {
			continue
		}
		seen[value] = true
		result = append(result, value)
	}
	return result
}

func inputValueMap(value interface{}, inputs []piOptionInput) map[string]string {
	result := make(map[string]string, len(inputs))
	for _, input := range inputs {
		result[input.Name] = input.Default
	}
	if typed, ok := value.(map[string]interface{}); ok {
		for key, item := range typed {
			result[key] = fmt.Sprint(item)
		}
	}
	if typed, ok := value.(map[string]string); ok {
		for key, item := range typed {
			result[key] = item
		}
	}
	return result
}

func stringSetFromValue(value interface{}) map[string]bool {
	result := map[string]bool{}
	switch typed := value.(type) {
	case []string:
		for _, item := range typed {
			result[item] = true
		}
	case []interface{}:
		for _, item := range typed {
			result[fmt.Sprint(item)] = true
		}
	case string:
		if typed != "" {
			result[typed] = true
		}
	}
	return result
}

func stringFromValue(value interface{}) string {
	if value == nil {
		return ""
	}
	return fmt.Sprint(value)
}

func cloneMap(source map[string]interface{}) map[string]interface{} {
	if source == nil {
		return nil
	}
	result := make(map[string]interface{}, len(source))
	for key, value := range source {
		result[key] = cloneValue(value)
	}
	return result
}

func cloneValue(value interface{}) interface{} {
	data, err := json.Marshal(value)
	if err != nil {
		return value
	}
	var cloned interface{}
	if err := json.Unmarshal(data, &cloned); err != nil {
		return value
	}
	return cloned
}

func rawMap(value interface{}) map[string]interface{} {
	data, err := json.Marshal(value)
	if err != nil {
		return nil
	}
	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		return nil
	}
	delete(result, "BaseDir")
	delete(result, "Raw")
	return result
}

func compactJSON(value interface{}) string {
	data, err := json.Marshal(value)
	if err != nil {
		return ""
	}
	return string(data)
}
