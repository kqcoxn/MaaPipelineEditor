package projectinterface

import (
	"encoding/json"
	"strings"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/eventbus"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/server"
	service "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/service/projectinterface"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/pkg/models"
)

type Handler struct {
	service *service.Service
}

func NewHandler(piService *service.Service, eventBus *eventbus.EventBus, wsServer *server.WebSocketServer) *Handler {
	handler := &Handler{service: piService}
	eventBus.Subscribe(service.EventChanged, func(event eventbus.Event) {
		wsServer.Broadcast(models.Message{Path: "/lte/interface/changed", Data: event.Data})
	})
	eventBus.Subscribe(service.EventContextDisposed, func(event eventbus.Event) {
		wsServer.Broadcast(models.Message{Path: "/lte/interface/context_disposed", Data: map[string]any{"contextId": event.Data}})
	})
	eventBus.Subscribe(eventbus.EventProjectInterfaceAgent, func(event eventbus.Event) {
		wsServer.Broadcast(models.Message{Path: "/lte/interface/agent", Data: event.Data})
	})
	return handler
}

func (h *Handler) GetRoutePrefix() []string { return []string{"/etl/interface/"} }

func (h *Handler) Handle(msg models.Message, conn *server.Connection) *models.Message {
	switch msg.Path {
	case "/etl/interface/status":
		h.send(conn, "/lte/interface/status", h.service.Status())
	case "/etl/interface/snapshot":
		var req struct {
			Language string `json:"language"`
		}
		if !decode(msg.Data, &req) {
			h.sendError(conn, "pi_invalid_request", "请求格式错误")
			break
		}
		snapshot, err := h.service.Snapshot(req.Language)
		if err != nil {
			h.sendError(conn, "pi_snapshot_unavailable", err.Error())
			break
		}
		h.send(conn, "/lte/interface/snapshot", snapshot)
	case "/etl/interface/diagnostics":
		h.send(conn, "/lte/interface/diagnostics", map[string]any{"diagnostics": h.service.Status().Diagnostics})
	case "/etl/interface/context/resolve":
		var req service.ContextRequest
		if !decode(msg.Data, &req) {
			h.sendError(conn, "pi_invalid_request", "请求格式错误")
			break
		}
		plan, err := h.service.ResolveContext(req)
		if err != nil {
			h.sendError(conn, "pi_context_resolve_failed", err.Error())
			break
		}
		h.send(conn, "/lte/interface/context", plan)
	case "/etl/interface/context/dispose":
		var req struct {
			ContextID string `json:"contextId"`
		}
		if !decode(msg.Data, &req) || strings.TrimSpace(req.ContextID) == "" {
			h.sendError(conn, "pi_invalid_request", "缺少 contextId")
			break
		}
		h.service.DisposeContext(req.ContextID)
	default:
		h.sendError(conn, "pi_route_not_found", "未知的 Project Interface 路由")
	}
	return nil
}

func decode(value any, target any) bool {
	raw, err := json.Marshal(value)
	if err != nil {
		return false
	}
	return json.Unmarshal(raw, target) == nil
}
func (h *Handler) send(conn *server.Connection, path string, data any) {
	if err := conn.Send(models.Message{Path: path, Data: data}); err != nil {
		logger.Warn("ProjectInterface", "发送响应失败: %v", err)
	}
}
func (h *Handler) sendError(conn *server.Connection, code, message string) {
	h.send(conn, "/lte/interface/error", map[string]any{"code": code, "message": message})
}
