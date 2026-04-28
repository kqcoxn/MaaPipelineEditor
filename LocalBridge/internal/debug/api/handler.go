package api

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	maa "github.com/MaaXYZ/maa-framework-go/v4"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/artifact"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/batch"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/protocol"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/registry"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/replay"
	debugrunner "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/runner"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/runutil"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/screenshot"
	debugsession "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/session"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/trace"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/mfw"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/server"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/pkg/models"
)

type Handler struct {
	service      *mfw.Service
	root         string
	sessions     *debugsession.Manager
	traces       *trace.Store
	artifacts    *artifact.Store
	runner       *debugrunner.Runner
	screenshots  *screenshot.Service
	traceReplay  *replay.Service
	batches      *batch.Service
	capabilities protocol.CapabilityManifest
}

func NewHandler(service *mfw.Service, root string) *Handler {
	sessions := debugsession.NewManager()
	traces := trace.NewStore()
	artifacts := artifact.NewStore()
	return &Handler{
		service:      service,
		root:         root,
		sessions:     sessions,
		traces:       traces,
		artifacts:    artifacts,
		runner:       debugrunner.New(service, sessions, traces, artifacts, root),
		screenshots:  screenshot.NewService(service, artifacts),
		traceReplay:  replay.NewService(traces),
		batches:      batch.New(service, root, traces, artifacts),
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
	case "/mpe/debug/resource/preflight":
		h.handleResourcePreflight(conn, msg)
	case "/mpe/debug/run/stop":
		h.handleRunStop(conn, msg)
	case "/mpe/debug/artifact/get":
		h.handleArtifactGet(conn, msg)
	case "/mpe/debug/screenshot/capture":
		h.handleScreenshotCapture(conn, msg)
	case "/mpe/debug/screenshot/start":
		h.handleScreenshotStreamStart(conn, msg)
	case "/mpe/debug/screenshot/stop":
		h.handleScreenshotStreamStop(conn, msg)
	case "/mpe/debug/agent/test":
		h.handleAgentTest(conn, msg)
	case "/mpe/debug/trace/snapshot":
		h.handleTraceSnapshot(conn, msg)
	case "/mpe/debug/trace/replay/start":
		h.handleTraceReplayStart(conn, msg)
	case "/mpe/debug/trace/replay/seek":
		h.handleTraceReplaySeek(conn, msg)
	case "/mpe/debug/trace/replay/stop":
		h.handleTraceReplayStop(conn, msg)
	case "/mpe/debug/batch-recognition/start":
		h.handleBatchRecognitionStart(conn, msg)
	case "/mpe/debug/batch-recognition/stop":
		h.handleBatchRecognitionStop(conn, msg)
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

	h.screenshots.StopSession(sessionID)
	h.traceReplay.StopSession(sessionID)
	h.batches.StopSession(sessionID)
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

func (h *Handler) handleResourcePreflight(conn *server.Connection, msg models.Message) {
	req, err := decodeData[protocol.ResourcePreflightRequest](msg)
	if err != nil {
		h.sendError(conn, "debug_invalid_request", err.Error(), nil)
		return
	}

	startedAt := time.Now()
	checkedAt := startedAt.UTC().Format(time.RFC3339Nano)
	paths := nonEmptyStrings(req.ResourcePaths)
	result := protocol.ResourcePreflightResult{
		RequestID:     strings.TrimSpace(req.RequestID),
		ResourcePaths: paths,
		Status:        "failed",
		CheckedAt:     checkedAt,
	}

	if len(paths) == 0 {
		result.Diagnostics = []protocol.Diagnostic{{
			Severity: "error",
			Code:     "debug.resource.empty",
			Message:  "资源路径为空，请先配置至少一个资源路径。",
		}}
		h.send(conn, "/lte/debug/resource_preflight", result)
		return
	}
	if !h.service.IsInitialized() {
		result.Diagnostics = []protocol.Diagnostic{{
			Severity: "error",
			Code:     "debug_not_initialized",
			Message:  "MaaFramework 未初始化，无法加载资源。",
		}}
		result.DurationMS = time.Since(startedAt).Milliseconds()
		h.send(conn, "/lte/debug/resource_preflight", result)
		return
	}

	hash, loadErr := mfw.CheckResourceBundles(paths)
	result.DurationMS = time.Since(startedAt).Milliseconds()
	if loadErr != nil {
		result.Diagnostics = []protocol.Diagnostic{{
			Severity: "error",
			Code:     "debug.resource.load_failed",
			Message:  loadErr.Error(),
		}}
		h.send(conn, "/lte/debug/resource_preflight", result)
		return
	}

	result.Status = "ready"
	result.Hash = hash
	result.Diagnostics = []protocol.Diagnostic{{
		Severity: "info",
		Code:     "debug.resource.ready",
		Message:  "资源加载检测通过。",
		Data: map[string]interface{}{
			"hash":       hash,
			"durationMs": result.DurationMS,
		},
	}}
	h.send(conn, "/lte/debug/resource_preflight", result)
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

	h.screenshots.StopRunBound(req.SessionID, req.RunID, "run_stop")
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

func (h *Handler) handleScreenshotCapture(conn *server.Connection, msg models.Message) {
	if !h.service.IsInitialized() {
		h.sendError(conn, "debug_not_initialized", "MaaFramework 未初始化，请先初始化服务", nil)
		return
	}

	req, err := decodeData[protocol.ScreenshotCaptureRequest](msg)
	if err != nil {
		h.sendError(conn, "debug_invalid_request", err.Error(), nil)
		return
	}

	sessionID := strings.TrimSpace(req.SessionID)
	if sessionID == "" {
		snapshot := h.sessions.Create(h.capabilities)
		sessionID = snapshot.SessionID
		h.send(conn, "/lte/debug/session_created", snapshot)
	} else if _, err := h.sessions.Snapshot(sessionID); err != nil {
		h.sendError(conn, "debug_session_not_found", err.Error(), nil)
		return
	}

	ref, bounds, err := h.screenshots.Capture(sessionID, strings.TrimSpace(req.ControllerID), req.Force)
	if err != nil {
		h.sendError(conn, "debug_screenshot_failed", err.Error(), map[string]interface{}{
			"sessionId":    sessionID,
			"controllerId": req.ControllerID,
		})
		return
	}

	h.emitEvent(conn, protocol.Event{
		SessionID:     sessionID,
		Source:        "localbridge",
		Kind:          "screenshot",
		Phase:         "completed",
		Status:        "captured",
		ScreenshotRef: ref.ID,
		Data: map[string]interface{}{
			"controllerId": req.ControllerID,
			"force":        req.Force,
			"width":        bounds.Dx(),
			"height":       bounds.Dy(),
		},
	})
}

func (h *Handler) handleScreenshotStreamStart(conn *server.Connection, msg models.Message) {
	if !h.service.IsInitialized() {
		h.sendError(conn, "debug_not_initialized", "MaaFramework 未初始化，请先初始化服务", nil)
		return
	}

	req, err := decodeData[protocol.ScreenshotStreamStartRequest](msg)
	if err != nil {
		h.sendError(conn, "debug_invalid_request", err.Error(), nil)
		return
	}

	sessionID := strings.TrimSpace(req.SessionID)
	if sessionID == "" {
		snapshot := h.sessions.Create(h.capabilities)
		sessionID = snapshot.SessionID
		req.SessionID = sessionID
		h.send(conn, "/lte/debug/session_created", snapshot)
	} else if _, err := h.sessions.Snapshot(sessionID); err != nil {
		h.sendError(conn, "debug_session_not_found", err.Error(), nil)
		return
	}
	req.ControllerID = strings.TrimSpace(req.ControllerID)
	req.RunID = strings.TrimSpace(req.RunID)

	status, err := h.screenshots.Start(req, func(event protocol.Event) {
		h.emitEvent(conn, event)
	})
	if err != nil {
		h.sendError(conn, "debug_screenshot_stream_failed", err.Error(), map[string]interface{}{
			"sessionId":    sessionID,
			"controllerId": req.ControllerID,
		})
		return
	}
	h.send(conn, "/lte/debug/screenshot_stream_started", status)
}

func (h *Handler) handleScreenshotStreamStop(conn *server.Connection, msg models.Message) {
	req, err := decodeData[protocol.ScreenshotStreamStopRequest](msg)
	if err != nil {
		h.sendError(conn, "debug_invalid_request", err.Error(), nil)
		return
	}
	req.SessionID = strings.TrimSpace(req.SessionID)
	if req.SessionID == "" {
		h.sendError(conn, "debug_invalid_request", "缺少必需参数: sessionId", nil)
		return
	}
	if _, err := h.sessions.Snapshot(req.SessionID); err != nil {
		h.sendError(conn, "debug_session_not_found", err.Error(), nil)
		return
	}

	reason := strings.TrimSpace(req.Reason)
	if reason == "" {
		reason = "user_stop"
	}
	status, _ := h.screenshots.Stop(req.SessionID, reason)
	h.send(conn, "/lte/debug/screenshot_stream_stopped", status)
}

func (h *Handler) handleAgentTest(conn *server.Connection, msg models.Message) {
	req, err := decodeData[protocol.AgentTestRequest](msg)
	if err != nil {
		h.sendError(conn, "debug_invalid_request", err.Error(), nil)
		return
	}

	result := testAgentConnection(req.Agent)
	h.send(conn, "/lte/debug/agent_tested", result)
}

func testAgentConnection(agent protocol.AgentProfile) protocol.AgentTestResult {
	result := protocol.AgentTestResult{
		AgentID:   strings.TrimSpace(agent.ID),
		CheckedAt: time.Now().UTC().Format(time.RFC3339Nano),
	}
	client, err := createAgentClient(agent)
	if err != nil {
		result.Message = err.Error()
		return result
	}
	defer client.Destroy()
	defer func() { _ = client.Disconnect() }()

	if agent.TimeoutMS > 0 {
		if err := client.SetTimeout(time.Duration(agent.TimeoutMS) * time.Millisecond); err != nil {
			result.Message = err.Error()
			return result
		}
	}
	if err := client.Connect(); err != nil {
		result.Message = err.Error()
		return result
	}
	result.Success = true
	result.Message = "agent 连接测试通过，已断开测试连接"
	result.CustomRecognitions, _ = client.GetCustomRecognitionList()
	result.CustomActions, _ = client.GetCustomActionList()
	return result
}

func (h *Handler) handleTraceSnapshot(conn *server.Connection, msg models.Message) {
	req, err := decodeData[protocol.TraceSnapshotRequest](msg)
	if err != nil {
		h.sendError(conn, "debug_invalid_request", err.Error(), nil)
		return
	}
	if _, err := h.sessions.Snapshot(strings.TrimSpace(req.SessionID)); err != nil {
		h.sendError(conn, "debug_session_not_found", err.Error(), nil)
		return
	}
	snapshot, err := h.traceReplay.Snapshot(req)
	if err != nil {
		h.sendError(conn, "debug_trace_snapshot_failed", err.Error(), nil)
		return
	}
	h.send(conn, "/lte/debug/trace_snapshot", snapshot)
}

func (h *Handler) handleTraceReplayStart(conn *server.Connection, msg models.Message) {
	req, err := decodeData[protocol.TraceReplayRequest](msg)
	if err != nil {
		h.sendError(conn, "debug_invalid_request", err.Error(), nil)
		return
	}
	if _, err := h.sessions.Snapshot(strings.TrimSpace(req.SessionID)); err != nil {
		h.sendError(conn, "debug_session_not_found", err.Error(), nil)
		return
	}
	status, err := h.traceReplay.Start(req)
	if err != nil {
		h.sendError(conn, "debug_trace_replay_failed", err.Error(), nil)
		return
	}
	h.send(conn, "/lte/debug/trace_replay_status", status)
}

func (h *Handler) handleTraceReplaySeek(conn *server.Connection, msg models.Message) {
	req, err := decodeData[protocol.TraceReplayRequest](msg)
	if err != nil {
		h.sendError(conn, "debug_invalid_request", err.Error(), nil)
		return
	}
	if _, err := h.sessions.Snapshot(strings.TrimSpace(req.SessionID)); err != nil {
		h.sendError(conn, "debug_session_not_found", err.Error(), nil)
		return
	}
	status, err := h.traceReplay.Seek(req)
	if err != nil {
		h.sendError(conn, "debug_trace_replay_failed", err.Error(), nil)
		return
	}
	h.send(conn, "/lte/debug/trace_replay_status", status)
}

func (h *Handler) handleTraceReplayStop(conn *server.Connection, msg models.Message) {
	req, err := decodeData[protocol.TraceReplayStopRequest](msg)
	if err != nil {
		h.sendError(conn, "debug_invalid_request", err.Error(), nil)
		return
	}
	if _, err := h.sessions.Snapshot(strings.TrimSpace(req.SessionID)); err != nil {
		h.sendError(conn, "debug_session_not_found", err.Error(), nil)
		return
	}
	status, err := h.traceReplay.Stop(req)
	if err != nil {
		h.sendError(conn, "debug_trace_replay_failed", err.Error(), nil)
		return
	}
	h.send(conn, "/lte/debug/trace_replay_status", status)
}

func (h *Handler) handleBatchRecognitionStart(conn *server.Connection, msg models.Message) {
	if !h.service.IsInitialized() {
		h.sendError(conn, "debug_not_initialized", "MaaFramework 未初始化，请先初始化服务", nil)
		return
	}
	req, err := decodeData[protocol.BatchRecognitionRequest](msg)
	if err != nil {
		h.sendError(conn, "debug_invalid_request", err.Error(), nil)
		return
	}
	if strings.TrimSpace(req.SessionID) == "" {
		snapshot := h.sessions.Create(h.capabilities)
		req.SessionID = snapshot.SessionID
		h.send(conn, "/lte/debug/session_created", snapshot)
	} else if _, err := h.sessions.Snapshot(req.SessionID); err != nil {
		h.sendError(conn, "debug_session_not_found", err.Error(), nil)
		return
	}
	result, err := h.batches.Start(req, func(event protocol.Event) {
		h.send(conn, "/lte/debug/event", event)
	})
	if err != nil {
		h.sendError(conn, "debug_batch_recognition_failed", err.Error(), map[string]interface{}{
			"sessionId": req.SessionID,
		})
		return
	}
	h.send(conn, "/lte/debug/batch_recognition_started", result)
}

func (h *Handler) handleBatchRecognitionStop(conn *server.Connection, msg models.Message) {
	req, err := decodeData[protocol.BatchRecognitionStopRequest](msg)
	if err != nil {
		h.sendError(conn, "debug_invalid_request", err.Error(), nil)
		return
	}
	if _, err := h.sessions.Snapshot(strings.TrimSpace(req.SessionID)); err != nil {
		h.sendError(conn, "debug_session_not_found", err.Error(), nil)
		return
	}
	result, err := h.batches.Stop(req)
	if err != nil {
		h.sendError(conn, "debug_batch_recognition_stop_failed", err.Error(), nil)
		return
	}
	h.send(conn, "/lte/debug/batch_recognition_stopped", result)
}

func validateRunRequest(req protocol.RunRequest) error {
	if !protocol.IsValidRunMode(req.Mode) {
		return fmt.Errorf("无效的 run mode: %s", req.Mode)
	}
	if req.Mode == protocol.RunModeActionOnly && (req.Input == nil || !req.Input.ConfirmAction) {
		return fmt.Errorf("action-only requires input.confirmAction=true")
	}
	if req.Mode == protocol.RunModeFixedImageRecognition {
		if req.Input == nil ||
			(strings.TrimSpace(req.Input.ImagePath) == "" && strings.TrimSpace(req.Input.ImageRelativePath) == "") {
			return fmt.Errorf("fixed-image-recognition requires input.imageRelativePath or input.imagePath")
		}
	}
	if strings.TrimSpace(req.Profile.ID) == "" {
		return fmt.Errorf("缺少必需字段: profile.id")
	}
	if strings.TrimSpace(req.Profile.Name) == "" {
		return fmt.Errorf("缺少必需字段: profile.name")
	}
	if !isSupportedController(req.Profile.Controller.Type) {
		if req.Profile.Controller.Type == "replay" || req.Profile.Controller.Type == "record" {
			return fmt.Errorf("controller.type %s 暂不可用: go-binding-dbg-controller-missing", req.Profile.Controller.Type)
		}
		return fmt.Errorf("无效的 controller.type: %s", req.Profile.Controller.Type)
	}
	if !isSupportedSavePolicy(req.Profile.SavePolicy) {
		return fmt.Errorf("无效的 savePolicy: %s", req.Profile.SavePolicy)
	}
	if runutil.UsesLiveController(req.Mode) && strings.TrimSpace(controllerIDFromOptions(req.Profile.Controller.Options)) == "" {
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

func createAgentClient(agent protocol.AgentProfile) (*maa.AgentClient, error) {
	switch agent.Transport {
	case "tcp":
		if agent.TCPPort <= 0 || agent.TCPPort > 65535 {
			return nil, fmt.Errorf("tcp agent 端口必须在 1-65535 范围内")
		}
		return maa.NewAgentClient(maa.WithTcpPort(uint16(agent.TCPPort)))
	case "identifier", "":
		identifier := strings.TrimSpace(agent.Identifier)
		if identifier == "" {
			return nil, fmt.Errorf("identifier agent 缺少 identifier")
		}
		return maa.NewAgentClient(maa.WithIdentifier(identifier))
	default:
		return nil, fmt.Errorf("不支持的 agent transport: %s", agent.Transport)
	}
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
	case "adb", "win32", "dbg":
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

func (h *Handler) emitEvent(conn *server.Connection, event protocol.Event) {
	appended, err := h.traces.Append(event)
	if err != nil {
		logger.Warn("DebugVNext", "鍐欏叆 trace 澶辫触: %v", err)
		return
	}
	if appended.DetailRef != "" {
		h.artifacts.SetEventSeq(appended.SessionID, appended.DetailRef, appended.Seq)
	}
	if appended.ScreenshotRef != "" {
		h.artifacts.SetEventSeq(appended.SessionID, appended.ScreenshotRef, appended.Seq)
	}
	h.send(conn, "/lte/debug/event", appended)
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
