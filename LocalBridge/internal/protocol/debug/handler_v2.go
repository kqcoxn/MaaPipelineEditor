package debug

import (
	"fmt"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/mfw"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/server"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/pkg/models"
)

// ============================================================================
// DebugHandlerV2 - 调试协议处理器
// ============================================================================

// DebugHandlerV2 调试协议处理器 V2
type DebugHandlerV2 struct {
	service      *mfw.Service
	debugService *mfw.DebugServiceV2
}

// NewDebugHandlerV2 创建调试协议处理器 V2
func NewDebugHandlerV2(service *mfw.Service) *DebugHandlerV2 {
	return &DebugHandlerV2{
		service:      service,
		debugService: mfw.NewDebugServiceV2(service),
	}
}

// GetRoutePrefix 返回处理的路由前缀
func (h *DebugHandlerV2) GetRoutePrefix() []string {
	return []string{"/mpe/debug/"}
}

// Handle 处理消息
func (h *DebugHandlerV2) Handle(msg models.Message, conn *server.Connection) *models.Message {
	path := msg.Path
	logger.Debug("DebugV2", "处理调试消息: %s", path)

	// 检查 MFW 服务是否已初始化
	if !h.service.IsInitialized() {
		logger.Warn("DebugV2", "服务未初始化，拒绝请求")
		h.sendError(conn, "MaaFramework 未初始化，请先初始化服务")
		return nil
	}

	// 根据路由分发到不同的处理器
	switch path {
	// 会话管理
	case "/mpe/debug/create_session":
		h.handleCreateSession(conn, msg)
	case "/mpe/debug/destroy_session":
		h.handleDestroySession(conn, msg)
	case "/mpe/debug/list_sessions":
		h.handleListSessions(conn, msg)
	case "/mpe/debug/get_session":
		h.handleGetSession(conn, msg)

	// 调试控制
	case "/mpe/debug/start":
		h.handleStart(conn, msg)
	case "/mpe/debug/run":
		h.handleRun(conn, msg)
	case "/mpe/debug/continue":
		h.handleContinue(conn, msg)
	case "/mpe/debug/step":
		h.handleStep(conn, msg)
	case "/mpe/debug/stop":
		h.handleStop(conn, msg)

	// 断点管理
	case "/mpe/debug/set_breakpoints":
		h.handleSetBreakpoints(conn, msg)

	// 数据查询
	case "/mpe/debug/get_node_data":
		h.handleGetNodeData(conn, msg)
	case "/mpe/debug/screencap":
		h.handleScreencap(conn, msg)

	default:
		logger.Warn("DebugV2", "未知的调试路由: %s", path)
		h.sendError(conn, "未知的调试路由: "+path)
	}

	return nil
}

// ============================================================================
// 会话管理
// ============================================================================

// handleCreateSession 创建调试会话
func (h *DebugHandlerV2) handleCreateSession(conn *server.Connection, msg models.Message) {
	dataMap, ok := msg.Data.(map[string]interface{})
	if !ok {
		h.sendError(conn, "请求数据格式错误")
		return
	}

	resourcePath, _ := dataMap["resource_path"].(string)
	controllerID, _ := dataMap["controller_id"].(string)

	logger.Info("DebugV2", "创建调试会话: 资源=%s, 控制器=%s", resourcePath, controllerID)

	if resourcePath == "" || controllerID == "" {
		h.sendError(conn, "缺少必需参数: resource_path, controller_id")
		return
	}

	// 创建一个用于持有 session_id 的闭包变量
	var sessionIDHolder string

	// 创建事件回调（通过闭包引用 sessionIDHolder）
	eventCallback := h.createEventCallbackWithSessionID(conn, &sessionIDHolder)

	// 创建会话
	session, err := h.debugService.CreateSession(resourcePath, controllerID, eventCallback)
	if err != nil {
		logger.Error("DebugV2", "创建会话失败: %v", err)
		h.sendError(conn, err.Error())
		return
	}

	// 更新 session_id holder
	sessionIDHolder = session.SessionID

	// 发送成功响应
	h.sendResponse(conn, "/lte/debug/session_created", map[string]interface{}{
		"success":    true,
		"session_id": session.SessionID,
	})
}

// handleDestroySession 销毁调试会话
func (h *DebugHandlerV2) handleDestroySession(conn *server.Connection, msg models.Message) {
	dataMap, ok := msg.Data.(map[string]interface{})
	if !ok {
		h.sendError(conn, "请求数据格式错误")
		return
	}

	sessionID, _ := dataMap["session_id"].(string)

	if sessionID == "" {
		h.sendError(conn, "缺少必需参数: session_id")
		return
	}

	err := h.debugService.DestroySession(sessionID)
	if err != nil {
		h.sendError(conn, err.Error())
		return
	}

	h.sendResponse(conn, "/lte/debug/session_destroyed", map[string]interface{}{
		"success":    true,
		"session_id": sessionID,
	})
}

// handleListSessions 列出所有会话
func (h *DebugHandlerV2) handleListSessions(conn *server.Connection, msg models.Message) {
	sessions := h.debugService.ListSessions()

	sessionList := make([]map[string]interface{}, 0, len(sessions))
	for _, s := range sessions {
		sessionList = append(sessionList, map[string]interface{}{
			"session_id":    s.SessionID,
			"resource_path": s.ResourcePath,
			"entry_node":    s.EntryNode,
			"status":        string(s.Status),
			"created_at":    s.CreatedAt.Unix(),
		})
	}

	h.sendResponse(conn, "/lte/debug/sessions", map[string]interface{}{
		"success":  true,
		"sessions": sessionList,
	})
}

// handleGetSession 获取会话信息
func (h *DebugHandlerV2) handleGetSession(conn *server.Connection, msg models.Message) {
	dataMap, ok := msg.Data.(map[string]interface{})
	if !ok {
		h.sendError(conn, "请求数据格式错误")
		return
	}

	sessionID, _ := dataMap["session_id"].(string)

	if sessionID == "" {
		h.sendError(conn, "缺少必需参数: session_id")
		return
	}

	session := h.debugService.GetSession(sessionID)
	if session == nil {
		h.sendError(conn, fmt.Sprintf("会话不存在: %s", sessionID))
		return
	}

	h.sendResponse(conn, "/lte/debug/session_info", map[string]interface{}{
		"success":        true,
		"session_id":     session.SessionID,
		"resource_path":  session.ResourcePath,
		"entry_node":     session.EntryNode,
		"status":         string(session.Status),
		"current_node":   session.GetCurrentNode(),
		"last_node":      session.GetLastNode(),
		"pause_reason":   session.GetPauseReason(),
		"breakpoints":    session.GetBreakpoints(),
		"executed_nodes": session.GetExecutedNodes(),
	})
}

// ============================================================================
// 调试控制
// ============================================================================

// handleStart 启动调试
// 自动创建会话并运行任务
func (h *DebugHandlerV2) handleStart(conn *server.Connection, msg models.Message) {
	dataMap, ok := msg.Data.(map[string]interface{})
	if !ok {
		h.sendError(conn, "请求数据格式错误")
		return
	}

	resourcePath, _ := dataMap["resource_path"].(string)
	entryNode, _ := dataMap["entry"].(string)
	controllerID, _ := dataMap["controller_id"].(string)
	breakpointsRaw, _ := dataMap["breakpoints"].([]interface{})

	logger.Info("DebugV2", "启动调试: 资源=%s, 入口=%s, 控制器=%s", resourcePath, entryNode, controllerID)

	if resourcePath == "" || entryNode == "" || controllerID == "" {
		h.sendError(conn, "缺少必需参数: resource_path, entry, controller_id")
		return
	}

	// 转换断点列表
	breakpoints := h.parseStringArray(breakpointsRaw)

	// 创建一个用于持有 session_id 的闭包变量
	var sessionIDHolder string

	// 创建事件回调
	eventCallback := h.createEventCallbackWithSessionID(conn, &sessionIDHolder)

	// 创建会话
	session, err := h.debugService.CreateSession(resourcePath, controllerID, eventCallback)
	if err != nil {
		logger.Error("DebugV2", "创建会话失败: %v", err)
		h.sendError(conn, err.Error())
		return
	}

	// 更新 session_id holder
	sessionIDHolder = session.SessionID

	// 运行任务
	err = session.RunTask(entryNode, breakpoints)
	if err != nil {
		logger.Error("DebugV2", "运行任务失败: %v", err)
		h.sendError(conn, err.Error())
		// 清理会话
		h.debugService.DestroySession(session.SessionID)
		return
	}

	// 发送启动成功响应
	h.sendResponse(conn, "/lte/debug/started", map[string]interface{}{
		"success":    true,
		"session_id": session.SessionID,
	})
}

// handleRun 运行任务
func (h *DebugHandlerV2) handleRun(conn *server.Connection, msg models.Message) {
	dataMap, ok := msg.Data.(map[string]interface{})
	if !ok {
		h.sendError(conn, "请求数据格式错误")
		return
	}

	sessionID, _ := dataMap["session_id"].(string)
	entryNode, _ := dataMap["entry"].(string)
	breakpointsRaw, _ := dataMap["breakpoints"].([]interface{})

	if sessionID == "" || entryNode == "" {
		h.sendError(conn, "缺少必需参数: session_id, entry")
		return
	}

	// 转换断点列表
	breakpoints := h.parseStringArray(breakpointsRaw)

	logger.Info("DebugV2", "运行任务: Session=%s, Entry=%s, Breakpoints=%v", sessionID, entryNode, breakpoints)

	session := h.debugService.GetSession(sessionID)
	if session == nil {
		h.sendError(conn, fmt.Sprintf("会话不存在: %s", sessionID))
		return
	}

	err := session.RunTask(entryNode, breakpoints)
	if err != nil {
		h.sendError(conn, err.Error())
		return
	}

	h.sendResponse(conn, "/lte/debug/running", map[string]interface{}{
		"success":    true,
		"session_id": sessionID,
		"entry":      entryNode,
	})
}

// handleContinue 继续执行
func (h *DebugHandlerV2) handleContinue(conn *server.Connection, msg models.Message) {
	dataMap, ok := msg.Data.(map[string]interface{})
	if !ok {
		h.sendError(conn, "请求数据格式错误")
		return
	}

	sessionID, _ := dataMap["session_id"].(string)
	fromNode, _ := dataMap["from_node"].(string)
	breakpointsRaw, _ := dataMap["breakpoints"].([]interface{})

	if sessionID == "" || fromNode == "" {
		h.sendError(conn, "缺少必需参数: session_id, from_node")
		return
	}

	breakpoints := h.parseStringArray(breakpointsRaw)

	logger.Info("DebugV2", "继续执行: Session=%s, FromNode=%s", sessionID, fromNode)

	session := h.debugService.GetSession(sessionID)
	if session == nil {
		h.sendError(conn, fmt.Sprintf("会话不存在: %s", sessionID))
		return
	}

	err := session.ContinueFrom(fromNode, breakpoints)
	if err != nil {
		h.sendError(conn, err.Error())
		return
	}

	h.sendResponse(conn, "/lte/debug/continued", map[string]interface{}{
		"success":    true,
		"session_id": sessionID,
		"from_node":  fromNode,
	})
}

// handleStep 单步执行
func (h *DebugHandlerV2) handleStep(conn *server.Connection, msg models.Message) {
	dataMap, ok := msg.Data.(map[string]interface{})
	if !ok {
		h.sendError(conn, "请求数据格式错误")
		return
	}

	sessionID, _ := dataMap["session_id"].(string)
	fromNode, _ := dataMap["from_node"].(string)
	nextNodesRaw, _ := dataMap["next_nodes"].([]interface{})
	breakpointsRaw, _ := dataMap["breakpoints"].([]interface{})

	if sessionID == "" || fromNode == "" {
		h.sendError(conn, "缺少必需参数: session_id, from_node")
		return
	}

	nextNodes := h.parseStringArray(nextNodesRaw)
	breakpoints := h.parseStringArray(breakpointsRaw)

	logger.Info("DebugV2", "单步执行: Session=%s, FromNode=%s, NextNodes=%v", sessionID, fromNode, nextNodes)

	session := h.debugService.GetSession(sessionID)
	if session == nil {
		h.sendError(conn, fmt.Sprintf("会话不存在: %s", sessionID))
		return
	}

	err := session.StepFrom(fromNode, nextNodes, breakpoints)
	if err != nil {
		h.sendError(conn, err.Error())
		return
	}

	h.sendResponse(conn, "/lte/debug/stepped", map[string]interface{}{
		"success":    true,
		"session_id": sessionID,
		"from_node":  fromNode,
	})
}

// handleStop 停止调试
func (h *DebugHandlerV2) handleStop(conn *server.Connection, msg models.Message) {
	dataMap, ok := msg.Data.(map[string]interface{})
	if !ok {
		h.sendError(conn, "请求数据格式错误")
		return
	}

	sessionID, _ := dataMap["session_id"].(string)

	if sessionID == "" {
		h.sendError(conn, "缺少必需参数: session_id")
		return
	}

	logger.Info("DebugV2", "停止调试: Session=%s", sessionID)

	session := h.debugService.GetSession(sessionID)
	if session == nil {
		h.sendError(conn, fmt.Sprintf("会话不存在: %s", sessionID))
		return
	}

	err := session.Stop()
	if err != nil {
		h.sendError(conn, err.Error())
		return
	}

	h.sendResponse(conn, "/lte/debug/stopped", map[string]interface{}{
		"success":    true,
		"session_id": sessionID,
	})
}

// ============================================================================
// 断点管理
// ============================================================================

// handleSetBreakpoints 设置断点
func (h *DebugHandlerV2) handleSetBreakpoints(conn *server.Connection, msg models.Message) {
	dataMap, ok := msg.Data.(map[string]interface{})
	if !ok {
		h.sendError(conn, "请求数据格式错误")
		return
	}

	sessionID, _ := dataMap["session_id"].(string)
	breakpointsRaw, _ := dataMap["breakpoints"].([]interface{})

	if sessionID == "" {
		h.sendError(conn, "缺少必需参数: session_id")
		return
	}

	breakpoints := h.parseStringArray(breakpointsRaw)

	logger.Info("DebugV2", "设置断点: Session=%s, Breakpoints=%v", sessionID, breakpoints)

	session := h.debugService.GetSession(sessionID)
	if session == nil {
		h.sendError(conn, fmt.Sprintf("会话不存在: %s", sessionID))
		return
	}

	session.SetBreakpoints(breakpoints)

	h.sendResponse(conn, "/lte/debug/breakpoints_set", map[string]interface{}{
		"success":     true,
		"session_id":  sessionID,
		"breakpoints": breakpoints,
	})
}

// ============================================================================
// 数据查询
// ============================================================================

// handleGetNodeData 获取节点数据
func (h *DebugHandlerV2) handleGetNodeData(conn *server.Connection, msg models.Message) {
	dataMap, ok := msg.Data.(map[string]interface{})
	if !ok {
		h.sendError(conn, "请求数据格式错误")
		return
	}

	sessionID, _ := dataMap["session_id"].(string)
	nodeName, _ := dataMap["node_name"].(string)

	if sessionID == "" || nodeName == "" {
		h.sendError(conn, "缺少必需参数: session_id, node_name")
		return
	}

	session := h.debugService.GetSession(sessionID)
	if session == nil {
		h.sendError(conn, fmt.Sprintf("会话不存在: %s", sessionID))
		return
	}

	nodeData, ok := session.GetNodeJSON(nodeName)
	if !ok {
		h.sendError(conn, fmt.Sprintf("节点数据不存在: %s", nodeName))
		return
	}

	h.sendResponse(conn, "/lte/debug/node_data", map[string]interface{}{
		"success":   true,
		"node_name": nodeName,
		"node_data": nodeData,
	})
}

// handleScreencap 截图
func (h *DebugHandlerV2) handleScreencap(conn *server.Connection, msg models.Message) {
	dataMap, ok := msg.Data.(map[string]interface{})
	if !ok {
		h.sendError(conn, "请求数据格式错误")
		return
	}

	sessionID, _ := dataMap["session_id"].(string)

	if sessionID == "" {
		h.sendError(conn, "缺少必需参数: session_id")
		return
	}

	session := h.debugService.GetSession(sessionID)
	if session == nil {
		h.sendError(conn, fmt.Sprintf("会话不存在: %s", sessionID))
		return
	}

	adapter := session.GetAdapter()
	if adapter == nil {
		h.sendError(conn, "适配器未初始化")
		return
	}

	imageData, err := adapter.Screencap()
	if err != nil {
		h.sendError(conn, fmt.Sprintf("截图失败: %v", err))
		return
	}

	h.sendResponse(conn, "/lte/debug/screencap", map[string]interface{}{
		"success":    true,
		"session_id": sessionID,
		"image_data": "data:image/png;base64," + imageData,
	})
}

// ============================================================================
// 辅助方法
// ============================================================================

// sendResponse 发送响应
func (h *DebugHandlerV2) sendResponse(conn *server.Connection, path string, data map[string]interface{}) {
	response := models.Message{
		Path: path,
		Data: data,
	}
	conn.Send(response)
}

// sendError 发送错误响应
func (h *DebugHandlerV2) sendError(conn *server.Connection, errorMsg string) {
	response := models.Message{
		Path: "/lte/debug/error",
		Data: map[string]interface{}{
			"success": false,
			"error":   errorMsg,
		},
	}
	conn.Send(response)
}

// parseStringArray 解析字符串数组
func (h *DebugHandlerV2) parseStringArray(raw []interface{}) []string {
	result := make([]string, 0, len(raw))
	for _, item := range raw {
		if str, ok := item.(string); ok {
			result = append(result, str)
		}
	}
	return result
}

// createEventCallback 创建事件回调（已弃用，使用 createEventCallbackWithSessionID）
func (h *DebugHandlerV2) createEventCallback(conn *server.Connection) mfw.DebugEventCallback {
	return h.createEventCallbackWithSessionID(conn, nil)
}

// createEventCallbackWithSessionID 创建带 session_id 的事件回调
// sessionIDHolder 是一个指向 session_id 的指针，在会话创建后会被设置正确的值
func (h *DebugHandlerV2) createEventCallbackWithSessionID(conn *server.Connection, sessionIDHolder *string) mfw.DebugEventCallback {
	return func(event mfw.DebugEventData) {
		// 转换事件类型
		eventName := string(event.Type)

		// 获取 session_id
		var sessionID string
		if sessionIDHolder != nil {
			sessionID = *sessionIDHolder
		}

		// 发送事件
		response := models.Message{
			Path: "/lte/debug/event",
			Data: map[string]interface{}{
				"event_name": eventName,
				"session_id": sessionID, // 使用正确的 session_id
				"node_name":  event.NodeName,
				"node_id":    event.NodeID,
				"task_id":    event.TaskID,
				"reco_id":    event.RecoID,
				"action_id":  event.ActionID,
				"timestamp":  event.Timestamp,
				"latency":    event.Latency,
				"detail":     event.Detail,
			},
		}
		conn.Send(response)
	}
}
