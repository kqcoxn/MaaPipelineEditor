package interfaceimport

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
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

	data, err := os.ReadFile(interfacePath)
	if err != nil {
		return protocol.InterfaceImportResult{}, fmt.Errorf("读取 interface.json 失败: %w", err)
	}

	var pi projectInterface
	if err := utils.ParseJSONC(data, &pi); err != nil {
		return protocol.InterfaceImportResult{}, fmt.Errorf("解析 interface.json 失败: %w", err)
	}
	if pi.InterfaceVersion != 2 {
		return protocol.InterfaceImportResult{}, fmt.Errorf("仅支持 ProjectInterface v2，当前为: %d", pi.InterfaceVersion)
	}

	baseDir := filepath.Dir(interfacePath)
	resource, resourceDiagnostics := firstResource(pi.Resources)
	controller := firstController(pi.Controllers)
	task := firstTask(pi.Tasks)
	agentProfiles, agentDiagnostics := importAgents(pi.Agents)

	resourcePaths := make([]string, 0)
	if resource != nil {
		for _, item := range resource.Paths {
			resourcePaths = append(resourcePaths, resolvePIPath(baseDir, item))
		}
	}
	if controller != nil {
		for _, item := range controller.AttachResourcePaths {
			resourcePaths = append(resourcePaths, resolvePIPath(baseDir, item))
		}
	}

	entry := protocol.NodeTarget{}
	entryName := ""
	if task != nil {
		entry.RuntimeName = strings.TrimSpace(task.Entry)
		entryName = entry.RuntimeName
	}

	profileName := strings.TrimSpace(pi.Label)
	if profileName == "" {
		profileName = strings.TrimSpace(pi.Name)
	}
	if profileName == "" {
		profileName = filepath.Base(baseDir)
	}

	controllerType := "adb"
	if controller != nil {
		controllerType = normalizeControllerType(controller.Type)
	}

	diagnostics := make([]protocol.Diagnostic, 0, len(resourceDiagnostics)+len(agentDiagnostics))
	diagnostics = append(diagnostics, resourceDiagnostics...)
	diagnostics = append(diagnostics, agentDiagnostics...)
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

type projectInterface struct {
	InterfaceVersion int             `json:"interface_version"`
	Name             string          `json:"name"`
	Label            string          `json:"label"`
	Resources        []piResource    `json:"resource"`
	Controllers      []piController  `json:"controller"`
	Tasks            []piTask        `json:"task"`
	Agents           json.RawMessage `json:"agent"`
}

type piResource struct {
	Name  string      `json:"name"`
	Paths stringSlice `json:"path"`
}

type piController struct {
	Name                string      `json:"name"`
	Type                string      `json:"type"`
	AttachResourcePaths stringSlice `json:"attach_resource_path"`
}

type piTask struct {
	Name         string `json:"name"`
	Entry        string `json:"entry"`
	DefaultCheck bool   `json:"default_check"`
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

func firstResource(resources []piResource) (*piResource, []protocol.Diagnostic) {
	if len(resources) == 0 {
		return nil, []protocol.Diagnostic{{
			Severity: "warning",
			Code:     "debug.interface.resource_missing",
			Message:  "interface.json 未声明 resource",
		}}
	}
	return &resources[0], nil
}

func firstController(controllers []piController) *piController {
	if len(controllers) == 0 {
		return nil
	}
	return &controllers[0]
}

func firstTask(tasks []piTask) *piTask {
	if len(tasks) == 0 {
		return nil
	}
	for i := range tasks {
		if tasks[i].DefaultCheck {
			return &tasks[i]
		}
	}
	return &tasks[0]
}

func importAgents(raw json.RawMessage) ([]protocol.AgentProfile, []protocol.Diagnostic) {
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
		enabled := identifier != ""
		profiles = append(profiles, protocol.AgentProfile{
			ID:         fmt.Sprintf("agent-%d", index+1),
			Enabled:    enabled,
			Transport:  "identifier",
			Identifier: identifier,
		})
		if !enabled {
			diagnostics = append(diagnostics, protocol.Diagnostic{
				Severity: "info",
				Code:     "debug.interface.agent_subprocess_deferred",
				Message:  "P4 不托管 agent 子进程；缺少 identifier 的 agent 已作为禁用草稿导入",
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

func resolvePIPath(baseDir string, path string) string {
	clean := filepath.Clean(strings.TrimSpace(path))
	if filepath.IsAbs(clean) {
		return clean
	}
	return filepath.Join(baseDir, clean)
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
