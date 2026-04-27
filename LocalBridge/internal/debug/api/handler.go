package api

import (
	"fmt"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/registry"
	debugsession "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/session"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/mfw"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/server"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/pkg/models"
)

type Handler struct {
	service      *mfw.Service
	sessions     *debugsession.Manager
	capabilities registry.CapabilityManifest
}

func NewHandler(service *mfw.Service) *Handler {
	return &Handler{
		service:      service,
		sessions:     debugsession.NewManager(),
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
	case "/mpe/debug/run/start", "/mpe/debug/run/stop":
		if !h.service.IsInitialized() {
			h.sendError(conn, "debug_not_initialized", "MaaFramework 未初始化，请先初始化服务", nil)
			return nil
		}
		h.sendError(conn, "debug_not_implemented", "debug-vNext P0 尚未实现运行控制", map[string]string{
			"path": msg.Path,
		})
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

	if err := h.sessions.Destroy(sessionID); err != nil {
		h.sendError(conn, "debug_session_not_found", err.Error(), nil)
		return
	}

	h.send(conn, "/lte/debug/session_destroyed", map[string]string{
		"session_id": sessionID,
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

func getSessionID(msg models.Message) (string, error) {
	dataMap, ok := msg.Data.(map[string]interface{})
	if !ok {
		return "", fmt.Errorf("请求数据格式错误")
	}
	if sessionID, ok := dataMap["session_id"].(string); ok && sessionID != "" {
		return sessionID, nil
	}
	if sessionID, ok := dataMap["sessionId"].(string); ok && sessionID != "" {
		return sessionID, nil
	}
	return "", fmt.Errorf("缺少必需参数: session_id")
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
