package diagnostics

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/protocol"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/runutil"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/mfw"
)

type Service struct {
	mfwService *mfw.Service
}

func NewService(mfwService *mfw.Service, root string) *Service {
	_ = root
	return &Service{
		mfwService: mfwService,
	}
}

func (s *Service) CheckRun(req protocol.RunRequest) []protocol.Diagnostic {
	diagnostics := make([]protocol.Diagnostic, 0)
	diagnostics = append(diagnostics, s.checkResources(req.Profile.ResourcePaths)...)
	diagnostics = append(diagnostics, s.checkTarget(req)...)
	diagnostics = append(diagnostics, s.checkController(req)...)
	diagnostics = append(diagnostics, checkAgents(req.Profile.Agents)...)
	return diagnostics
}

func HasBlockingDiagnostic(diagnostics []protocol.Diagnostic) bool {
	for _, diagnostic := range diagnostics {
		if diagnostic.Severity == "error" {
			return true
		}
	}
	return false
}

func FirstError(diagnostics []protocol.Diagnostic) error {
	for _, diagnostic := range diagnostics {
		if diagnostic.Severity == "error" {
			return fmt.Errorf("%s: %s", diagnostic.Code, diagnostic.Message)
		}
	}
	return nil
}

func (s *Service) checkResources(paths []string) []protocol.Diagnostic {
	result := make([]protocol.Diagnostic, 0)
	resourcePaths := runutil.NonEmptyResourcePaths(paths)
	if len(resourcePaths) == 0 {
		return []protocol.Diagnostic{{
			Severity: "error",
			Code:     "debug.resource.empty",
			Message:  "profile.resourcePaths 不能为空",
		}}
	}

	seen := make(map[string]struct{}, len(resourcePaths))
	for index, resourcePath := range resourcePaths {
		abs, err := filepath.Abs(resourcePath)
		if err != nil {
			result = append(result, protocol.Diagnostic{
				Severity:   "error",
				Code:       "debug.resource.invalid_path",
				Message:    fmt.Sprintf("资源路径无法解析: %s", resourcePath),
				SourcePath: resourcePath,
				Data:       map[string]interface{}{"index": index, "error": err.Error()},
			})
			continue
		}
		if _, ok := seen[abs]; ok {
			result = append(result, protocol.Diagnostic{
				Severity:   "warning",
				Code:       "debug.resource.duplicate",
				Message:    "资源路径重复，将按配置顺序重复加载",
				SourcePath: abs,
				Data:       map[string]interface{}{"index": index},
			})
		}
		seen[abs] = struct{}{}

		info, err := os.Stat(abs)
		if err != nil {
			result = append(result, protocol.Diagnostic{
				Severity:   "error",
				Code:       "debug.resource.not_found",
				Message:    "资源路径不存在",
				SourcePath: abs,
				Data:       map[string]interface{}{"index": index, "error": err.Error()},
			})
			continue
		}
		if !info.IsDir() {
			result = append(result, protocol.Diagnostic{
				Severity:   "error",
				Code:       "debug.resource.not_directory",
				Message:    "资源路径不是目录",
				SourcePath: abs,
				Data:       map[string]interface{}{"index": index},
			})
			continue
		}
		if !hasResourceMarker(abs) {
			result = append(result, protocol.Diagnostic{
				Severity:   "warning",
				Code:       "debug.resource.marker_missing",
				Message:    "资源路径未发现 pipeline/image/model/default_pipeline.json 标记",
				SourcePath: abs,
				Data:       map[string]interface{}{"index": index},
			})
		}
	}
	return result
}

func (s *Service) checkTarget(req protocol.RunRequest) []protocol.Diagnostic {
	if !protocol.RunModeRequiresTarget(req.Mode) {
		return nil
	}
	if req.Target == nil {
		return []protocol.Diagnostic{{
			Severity: "error",
			Code:     "debug.target.missing",
			Message:  fmt.Sprintf("%s 需要 target", req.Mode),
		}}
	}
	for _, node := range req.ResolverSnapshot.Nodes {
		if node.FileID == req.Target.FileID &&
			node.NodeID == req.Target.NodeID &&
			node.RuntimeName == req.Target.RuntimeName {
			return nil
		}
	}
	return []protocol.Diagnostic{{
		Severity: "error",
		Code:     "debug.target.not_in_resolver",
		Message:  "目标节点不在 resolver snapshot 中",
		FileID:   req.Target.FileID,
		NodeID:   req.Target.NodeID,
		Data: map[string]interface{}{
			"runtimeName": req.Target.RuntimeName,
		},
	}}
}

func (s *Service) checkController(req protocol.RunRequest) []protocol.Diagnostic {
	if !runutil.UsesLiveController(req.Mode) {
		return nil
	}
	controllerID := controllerIDFromOptions(req.Profile.Controller.Options)
	if controllerID == "" {
		return []protocol.Diagnostic{{
			Severity: "error",
			Code:     "debug.controller.missing",
			Message:  "缺少 profile.controller.options.controllerId",
		}}
	}
	if s.mfwService == nil {
		return []protocol.Diagnostic{{
			Severity: "error",
			Code:     "debug.controller.service_missing",
			Message:  "MaaFramework service 不可用",
		}}
	}
	info, err := s.mfwService.ControllerManager().GetController(controllerID)
	if err != nil {
		return []protocol.Diagnostic{{
			Severity: "error",
			Code:     "debug.controller.not_found",
			Message:  "找不到指定 controller",
			Data:     map[string]interface{}{"controllerId": controllerID, "error": err.Error()},
		}}
	}
	if info == nil || !info.Connected {
		return []protocol.Diagnostic{{
			Severity: "error",
			Code:     "debug.controller.disconnected",
			Message:  "controller 未连接",
			Data:     map[string]interface{}{"controllerId": controllerID},
		}}
	}
	return nil
}

func checkAgents(agents []protocol.AgentProfile) []protocol.Diagnostic {
	result := make([]protocol.Diagnostic, 0)
	for index, agent := range agents {
		if !agent.Enabled {
			continue
		}
		switch agent.Transport {
		case "identifier":
			if strings.TrimSpace(agent.Identifier) == "" {
				result = append(result, protocol.Diagnostic{
					Severity: "error",
					Code:     "debug.agent.identifier_missing",
					Message:  "identifier agent 缺少 identifier",
					Data:     map[string]interface{}{"agentId": agent.ID, "index": index},
				})
			}
		case "tcp":
			if agent.TCPPort <= 0 || agent.TCPPort > 65535 {
				result = append(result, protocol.Diagnostic{
					Severity: "error",
					Code:     "debug.agent.invalid_tcp_port",
					Message:  "tcp agent 端口必须在 1-65535 范围内",
					Data:     map[string]interface{}{"agentId": agent.ID, "index": index, "tcpPort": agent.TCPPort},
				})
			}
		default:
			result = append(result, protocol.Diagnostic{
				Severity: "error",
				Code:     "debug.agent.invalid_transport",
				Message:  "不支持的 agent transport",
				Data:     map[string]interface{}{"agentId": agent.ID, "index": index, "transport": agent.Transport},
			})
		}
	}
	return result
}

func hasResourceMarker(path string) bool {
	for _, marker := range []string{"pipeline", "image", "model", "default_pipeline.json"} {
		if _, err := os.Stat(filepath.Join(path, marker)); err == nil {
			return true
		}
	}
	return false
}

func controllerIDFromOptions(options map[string]interface{}) string {
	for _, key := range []string{"controllerId", "controller_id"} {
		if value, ok := options[key].(string); ok && strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
