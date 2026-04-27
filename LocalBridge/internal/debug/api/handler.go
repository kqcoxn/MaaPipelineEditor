package api

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/artifact"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/protocol"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/registry"
	debugrunner "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/runner"
	debugsession "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/session"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/trace"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/mfw"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/server"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/pkg/models"
)

type Handler struct {
	service      *mfw.Service
	sessions     *debugsession.Manager
	traces       *trace.Store
	artifacts    *artifact.Store
	runner       *debugrunner.Runner
	capabilities protocol.CapabilityManifest
}

func NewHandler(service *mfw.Service) *Handler {
	sessions := debugsession.NewManager()
	traces := trace.NewStore()
	artifacts := artifact.NewStore()
	return &Handler{
		service:      service,
		sessions:     sessions,
		traces:       traces,
		artifacts:    artifacts,
		runner:       debugrunner.New(service, sessions, traces, artifacts),
		capabilities: registry.DefaultCapabilityManifest(),
	}
}

func (h *Handler) GetRoutePrefix() []string {
	return []string{"/mpe/debug/"}
}

func (h *Handler) Handle(msg models.Message, conn *server.Connection) *models.Message {
	logger.Debug("DebugVNext", "处理调试消息: %s", msg.Path)

	switch msg.Path {
	case "/mpe/debug/capabilities":
		h.send(conn, "/lte/debug/capabilities", h.capabilities)
	case "/mpe/debug/session/create":
		h.handleCreateSession(conn)
	case "/mpe/debug/session/destroy":
		h.handleDestroySession(conn, msg)
	case "/mpe/debug/session/snapshot":
		h.handleSessionSnapshot(conn, msg)
	case "/mpe/debug/run/start":
		h.handleRunStart(conn, msg)
	case "/mpe/debug/run/stop":
		h.handleRunStop(conn, msg)
	case "/mpe/debug/artifact/get":
		h.handleArtifactGet(conn, msg)
	case "/mpe/debug/start", "/mpe/debug/stop":
		h.sendError(conn, "debug_legacy_route_removed", "旧调试路由已移除，请使用 debug-vNext 契约", map[string]string{
			"path": msg.Path,
		})
	default:
		h.sendError(conn, "debug_route_not_found", "未知的 debug-vNext 路由", map[string]string{
			"path": msg.Path,
		})
	}

	return nil
}

func (h *Handler) handleCreateSession(conn *server.Connection) {
	if !h.service.IsInitialized() {
		h.sendError(conn, "debug_not_initialized", "MaaFramework 未初始化，请先初始化服务", nil)
		return
	}

	snapshot := h.sessions.Create(h.capabilities)
	h.send(conn, "/lte/debug/session_created", snapshot)
}

func (h *Handler) handleDestroySession(conn *server.Connection, msg models.Message) {
	if !h.service.IsInitialized() {
		h.sendError(conn, "debug_not_initialized", "MaaFramework 未初始化，请先初始化服务", nil)
		return
	}

	sessionID, err := getSessionID(msg)
	if err != nil {
		h.sendError(conn, "debug_invalid_request", err.Error(), nil)
		return
	}

	h.runner.DisposeSession(sessionID)
	if err := h.sessions.Destroy(sessionID); err != nil {
		h.sendError(conn, "debug_session_not_found", err.Error(), nil)
		return
	}

	h.send(conn, "/lte/debug/session_destroyed", map[string]string{
		"sessionId": sessionID,
	})
}

func (h *Handler) handleSessionSnapshot(conn *server.Connection, msg models.Message) {
	if !h.service.IsInitialized() {
		h.sendError(conn, "debug_not_initialized", "MaaFramework 未初始化，请先初始化服务", nil)
		return
	}

	sessionID, err := getSessionID(msg)
	if err != nil {
		h.sendError(conn, "debug_invalid_request", err.Error(), nil)
		return
	}

	snapshot, err := h.sessions.Snapshot(sessionID)
	if err != nil {
		h.sendError(conn, "debug_session_not_found", err.Error(), nil)
		return
	}

	h.send(conn, "/lte/debug/session_snapshot", snapshot)
}

func (h *Handler) handleRunStart(conn *server.Connection, msg models.Message) {
	if !h.service.IsInitialized() {
		h.sendError(conn, "debug_not_initialized", "MaaFramework 未初始化，请先初始化服务", nil)
		return
	}

	req, err := decodeData[protocol.RunRequest](msg)
	if err != nil {
		h.sendError(conn, "debug_invalid_request", err.Error(), nil)
		return
	}

	if err := validateRunRequest(req); err != nil {
		h.sendError(conn, "debug_invalid_request", err.Error(), nil)
		return
	}

	if req.SessionID == "" {
		snapshot := h.sessions.Create(h.capabilities)
		req.SessionID = snapshot.SessionID
		h.send(conn, "/lte/debug/session_created", snapshot)
	} else {
		if _, err := h.sessions.Snapshot(req.SessionID); err != nil {
			h.sendError(conn, "debug_session_not_found", err.Error(), nil)
			return
		}
	}

	result, err := h.runner.Start(req, h.eventSender(conn), h.snapshotSender(conn))
	if err != nil {
		h.sendError(conn, "debug_run_start_failed", err.Error(), map[string]interface{}{
			"mode":      req.Mode,
			"sessionId": req.SessionID,
		})
		return
	}

	h.send(conn, "/lte/debug/run_started", map[string]interface{}{
		"sessionId": result.SessionID,
		"runId":     result.RunID,
		"mode":      result.Mode,
		"entry":     result.Entry,
		"startedAt": result.StartedAt,
		"session":   result.Session,
	})
}

func (h *Handler) handleRunStop(conn *server.Connection, msg models.Message) {
	req, err := decodeData[protocol.RunStopRequest](msg)
	if err != nil {
		h.sendError(conn, "debug_invalid_request", err.Error(), nil)
		return
	}

	if strings.TrimSpace(req.SessionID) == "" {
		h.sendError(conn, "debug_invalid_request", "缺少必需参数: sessionId", nil)
		return
	}

	if _, err := h.sessions.Snapshot(req.SessionID); err != nil {
		h.sendError(conn, "debug_session_not_found", err.Error(), nil)
		return
	}

	if err := h.runner.Stop(req.SessionID, req.RunID, req.Reason, h.eventSender(conn), h.snapshotSender(conn)); err != nil {
		h.sendError(conn, "debug_run_stop_failed", err.Error(), map[string]string{
			"sessionId": req.SessionID,
			"runId":     req.RunID,
		})
		return
	}

	h.send(conn, "/lte/debug/run_stop_requested", map[string]string{
		"sessionId": req.SessionID,
		"runId":     req.RunID,
		"reason":    req.Reason,
	})
}

func (h *Handler) handleArtifactGet(conn *server.Connection, msg models.Message) {
	req, err := decodeData[protocol.ArtifactGetRequest](msg)
	if err != nil {
		h.sendError(conn, "debug_invalid_request", err.Error(), nil)
		return
	}

	if strings.TrimSpace(req.SessionID) == "" {
		h.sendError(conn, "debug_invalid_request", "缺少必需参数: sessionId", nil)
		return
	}
	if strings.TrimSpace(req.ArtifactID) == "" {
		h.sendError(conn, "debug_invalid_request", "缺少必需参数: artifactId", nil)
		return
	}

	if _, err := h.sessions.Snapshot(req.SessionID); err != nil {
		h.sendError(conn, "debug_session_not_found", err.Error(), nil)
		return
	}

	payload, err := h.artifacts.Get(req.SessionID, req.ArtifactID)
	if err != nil {
		h.sendError(conn, "debug_artifact_not_found", err.Error(), map[string]string{
			"sessionId":  req.SessionID,
			"artifactId": req.ArtifactID,
		})
		return
	}
	h.send(conn, "/lte/debug/artifact", payload)
}

func validateRunRequest(req protocol.RunRequest) error {
	if !protocol.IsValidRunMode(req.Mode) {
		return fmt.Errorf("无效的 run mode: %s", req.Mode)
	}
	if req.Mode != protocol.RunModeFullRun && req.Mode != protocol.RunModeRunFromNode {
		return fmt.Errorf("P2 暂不支持 run mode: %s", req.Mode)
	}
	if strings.TrimSpace(req.Profile.ID) == "" {
		return fmt.Errorf("缺少必需字段: profile.id")
	}
	if strings.TrimSpace(req.Profile.Name) == "" {
		return fmt.Errorf("缺少必需字段: profile.name")
	}
	if !isSupportedController(req.Profile.Controller.Type) {
		return fmt.Errorf("无效的 controller.type: %s", req.Profile.Controller.Type)
	}
	if !isSupportedSavePolicy(req.Profile.SavePolicy) {
		return fmt.Errorf("无效的 savePolicy: %s", req.Profile.SavePolicy)
	}
	if strings.TrimSpace(controllerIDFromOptions(req.Profile.Controller.Options)) == "" {
		return fmt.Errorf("缺少必需字段: profile.controller.options.controllerId")
	}
	if len(nonEmptyStrings(req.Profile.ResourcePaths)) == 0 {
		return fmt.Errorf("profile.resourcePaths 不能为空")
	}
	if req.Mode == protocol.RunModeFullRun && !isCompleteTarget(req.Profile.Entry) {
		return fmt.Errorf("full-run 需要完整的 profile.entry")
	}
	if strings.TrimSpace(req.GraphSnapshot.GeneratedAt) == "" {
		return fmt.Errorf("缺少必需字段: graphSnapshot.generatedAt")
	}
	if strings.TrimSpace(req.GraphSnapshot.RootFileID) == "" {
		return fmt.Errorf("缺少必需字段: graphSnapshot.rootFileId")
	}
	if len(req.GraphSnapshot.Files) == 0 {
		return fmt.Errorf("graphSnapshot.files 不能为空")
	}
	for i, file := range req.GraphSnapshot.Files {
		if strings.TrimSpace(file.FileID) == "" {
			return fmt.Errorf("缺少必需字段: graphSnapshot.files[%d].fileId", i)
		}
		if file.Pipeline == nil {
			return fmt.Errorf("缺少必需字段: graphSnapshot.files[%d].pipeline", i)
		}
	}
	if strings.TrimSpace(req.ResolverSnapshot.GeneratedAt) == "" {
		return fmt.Errorf("缺少必需字段: resolverSnapshot.generatedAt")
	}
	if strings.TrimSpace(req.ResolverSnapshot.RootFileID) == "" {
		return fmt.Errorf("缺少必需字段: resolverSnapshot.rootFileId")
	}
	if len(req.ResolverSnapshot.Nodes) == 0 {
		return fmt.Errorf("resolverSnapshot.nodes 不能为空")
	}
	for i, node := range req.ResolverSnapshot.Nodes {
		if strings.TrimSpace(node.FileID) == "" {
			return fmt.Errorf("缺少必需字段: resolverSnapshot.nodes[%d].fileId", i)
		}
		if strings.TrimSpace(node.NodeID) == "" {
			return fmt.Errorf("缺少必需字段: resolverSnapshot.nodes[%d].nodeId", i)
		}
		if strings.TrimSpace(node.RuntimeName) == "" {
			return fmt.Errorf("缺少必需字段: resolverSnapshot.nodes[%d].runtimeName", i)
		}
	}
	if protocol.RunModeRequiresTarget(req.Mode) {
		if req.Target == nil {
			return fmt.Errorf("%s 需要 target", req.Mode)
		}
		if !isCompleteTarget(*req.Target) {
			return fmt.Errorf("%s 需要完整的 target.fileId、target.nodeId 和 target.runtimeName", req.Mode)
		}
	}
	return nil
}

func controllerIDFromOptions(options map[string]interface{}) string {
	for _, key := range []string{"controllerId", "controller_id"} {
		if value, ok := options[key].(string); ok && strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func nonEmptyStrings(values []string) []string {
	result := make([]string, 0, len(values))
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			result = append(result, strings.TrimSpace(value))
		}
	}
	return result
}

func isCompleteTarget(target protocol.NodeTarget) bool {
	return strings.TrimSpace(target.FileID) != "" &&
		strings.TrimSpace(target.NodeID) != "" &&
		strings.TrimSpace(target.RuntimeName) != ""
}

func isSupportedController(controllerType string) bool {
	switch controllerType {
	case "adb", "win32", "dbg", "replay", "record":
		return true
	default:
		return false
	}
}

func isSupportedSavePolicy(savePolicy string) bool {
	switch savePolicy {
	case "sandbox", "save-open-files", "use-disk":
		return true
	default:
		return false
	}
}

func getSessionID(msg models.Message) (string, error) {
	dataMap, ok := msg.Data.(map[string]interface{})
	if !ok {
		return "", fmt.Errorf("请求数据格式错误")
	}
	if sessionID, ok := dataMap["sessionId"].(string); ok && sessionID != "" {
		return sessionID, nil
	}
	if sessionID, ok := dataMap["session_id"].(string); ok && sessionID != "" {
		return sessionID, nil
	}
	return "", fmt.Errorf("缺少必需参数: sessionId")
}

func decodeData[T any](msg models.Message) (T, error) {
	var decoded T
	data, err := json.Marshal(msg.Data)
	if err != nil {
		return decoded, fmt.Errorf("请求数据序列化失败: %w", err)
	}
	if string(data) == "null" {
		return decoded, fmt.Errorf("请求数据不能为空")
	}
	if err := json.Unmarshal(data, &decoded); err != nil {
		return decoded, fmt.Errorf("请求数据格式错误: %w", err)
	}
	return decoded, nil
}

func (h *Handler) send(conn *server.Connection, path string, data interface{}) {
	if err := conn.Send(models.Message{Path: path, Data: data}); err != nil {
		logger.Error("DebugVNext", "发送响应失败: %v", err)
	}
}

func (h *Handler) sendError(conn *server.Connection, code string, message string, detail interface{}) {
	h.send(conn, "/lte/debug/error", map[string]interface{}{
		"code":    code,
		"message": message,
		"detail":  detail,
	})
}

func (h *Handler) eventSender(conn *server.Connection) debugrunner.EventSender {
	return func(event protocol.Event) {
		h.send(conn, "/lte/debug/event", event)
	}
}

func (h *Handler) snapshotSender(conn *server.Connection) debugrunner.SnapshotSender {
	return func(snapshot debugsession.Snapshot) {
		h.send(conn, "/lte/debug/session_snapshot", snapshot)
	}
}
