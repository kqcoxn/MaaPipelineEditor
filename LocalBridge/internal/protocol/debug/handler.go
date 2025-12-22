package debug

import (
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/mfw"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/server"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/pkg/models"
)

// 调试协议处理器
type DebugHandler struct {
	service      *mfw.Service
	debugService *mfw.DebugService
}

// 创建调试协议处理器
func NewDebugHandler(service *mfw.Service) *DebugHandler {
	return &DebugHandler{
		service:      service,
		debugService: mfw.NewDebugService(service),
	}
}

// 返回处理的路由前缀
func (h *DebugHandler) GetRoutePrefix() []string {
	return []string{"/mpe/debug/"}
}

// 处理消息
func (h *DebugHandler) Handle(msg models.Message, conn *server.Connection) *models.Message {
	path := msg.Path
	logger.Debug("Debug", "处理调试消息: %s", path)

	// 检查 MFW 服务是否已初始化
	if !h.service.IsInitialized() {
		logger.Warn("Debug", "服务未初始化，拒绝请求")
		h.sendError(conn, "MaaFramework 未初始化，请先初始化服务")
		return nil
	}

	// 根据路由分发到不同的处理器
	switch path {
	case "/mpe/debug/start":
		h.handleStartDebug(conn, msg)
	case "/mpe/debug/stop":
		h.handleStopDebug(conn, msg)
	default:
		logger.Warn("Debug", "未知的调试路由: %s", path)
		h.sendError(conn, "未知的调试路由: "+path)
	}

	return nil
}

// 处理启动调试请求
func (h *DebugHandler) handleStartDebug(conn *server.Connection, msg models.Message) {
	dataMap, ok := msg.Data.(map[string]interface{})
	if !ok {
		h.sendError(conn, "请求数据格式错误")
		return
	}

	resourcePath, _ := dataMap["resource_path"].(string)
	entry, _ := dataMap["entry"].(string)
	controllerID, _ := dataMap["controller_id"].(string)

	logger.Info("Debug", "启动调试请求: 资源=%s, 入口=%s, 控制器=%s", resourcePath, entry, controllerID)

	// 验证参数
	if resourcePath == "" || entry == "" || controllerID == "" {
		h.sendError(conn, "缺少必需参数: resource_path, entry, controller_id")
		return
	}

	// 创建事件处理器
	handler := &debugEventHandler{conn: conn}

	// 启动调试
	taskID, err := h.debugService.StartDebug(resourcePath, entry, controllerID, handler)
	if err != nil {
		logger.Error("Debug", "启动调试失败: %v", err)
		h.sendError(conn, err.Error())
		return
	}

	// 发送启动成功响应
	response := models.Message{
		Path: "/lte/debug/started",
		Data: map[string]interface{}{
			"success": true,
			"task_id": taskID,
		},
	}
	conn.Send(response)

	logger.Info("Debug", "调试已启动: %s", taskID)
}

// 处理停止调试请求
func (h *DebugHandler) handleStopDebug(conn *server.Connection, msg models.Message) {
	dataMap, ok := msg.Data.(map[string]interface{})
	if !ok {
		h.sendError(conn, "请求数据格式错误")
		return
	}

	taskID, _ := dataMap["task_id"].(string)

	logger.Info("Debug", "停止调试请求: %s", taskID)

	// 验证参数
	if taskID == "" {
		h.sendError(conn, "缺少必需参数: task_id")
		return
	}

	// 停止调试
	err := h.debugService.StopDebug(taskID)
	if err != nil {
		logger.Error("Debug", "停止调试失败: %v", err)
		// 即使失败也发送停止响应
	}

	// 发送停止响应
	response := models.Message{
		Path: "/lte/debug/stopped",
		Data: map[string]interface{}{
			"success": err == nil,
			"task_id": taskID,
			"error": func() string {
				if err != nil {
					return err.Error()
				}
				return ""
			}(),
		},
	}
	conn.Send(response)

	logger.Info("Debug", "调试已停止: %s", taskID)
}

// 发送错误响应
func (h *DebugHandler) sendError(conn *server.Connection, errorMsg string) {
	response := models.Message{
		Path: "/lte/debug/error",
		Data: map[string]interface{}{
			"error": errorMsg,
		},
	}
	conn.Send(response)
}

// 调试事件处理器
type debugEventHandler struct {
	conn *server.Connection
}

// 实现 DebugEventHandler 接口
func (h *debugEventHandler) OnDebugEvent(event mfw.DebugEvent) {
	logger.Debug("Debug", "调试事件: Type=%s, EventName=%s, NodeID=%s",
		event.Type, event.EventName, event.NodeID)

	// 根据事件类型发送不同的响应
	switch event.Type {
	case "debug_event":
		// 发送调试事件
		response := models.Message{
			Path: "/lte/debug/event",
			Data: map[string]interface{}{
				"event_name": event.EventName,
				"task_id":    event.TaskID,
				"node_id":    event.NodeID,
				"timestamp":  event.Timestamp,
				"detail":     event.Detail,
			},
		}
		h.conn.Send(response)

	case "debug_completed":
		// 发送完成事件
		response := models.Message{
			Path: "/lte/debug/completed",
			Data: map[string]interface{}{
				"task_id": event.TaskID,
			},
		}
		h.conn.Send(response)

	default:
		logger.Warn("Debug", "未知的调试事件类型: %s", event.Type)
	}
}
