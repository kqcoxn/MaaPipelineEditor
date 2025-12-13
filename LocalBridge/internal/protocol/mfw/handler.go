package mfw

import (
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/errors"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/mfw"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/server"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/pkg/models"
)

// MaaFramework协议处理器
type MFWHandler struct {
	service *mfw.Service
}

// 创建MFW协议处理器
func NewMFWHandler(service *mfw.Service) *MFWHandler {
	return &MFWHandler{
		service: service,
	}
}

// 返回处理的路由前缀
func (h *MFWHandler) GetRoutePrefix() []string {
	return []string{"/etl/mfw/"}
}

// 处理消息
func (h *MFWHandler) Handle(msg models.Message, conn *server.Connection) *models.Message {
	path := msg.Path
	logger.Info("MFW", "处理MFW消息: %s", path)

	// 检查 MFW 服务是否已初始化
	if !h.service.IsInitialized() {
		logger.Warn("MFW", "服务未初始化，拒绝请求")
		logger.Error("MFW", "MaaFramework 库路径未配置，请运行 'mpelb config set-lib' 并按提示输入后重启服务")
		h.sendMFWError(conn, mfw.ErrCodeNotInitialized,
			"MaaFramework 未初始化",
			"请在后端运行 'mpelb config set-lib' 设置 MaaFramework 库路径后重启服务")
		return nil
	}

	// 根据路由分发到不同的处理器
	switch path {
	// 设备相关路由
	case "/etl/mfw/refresh_adb_devices":
		h.handleRefreshAdbDevices(conn, msg)
	case "/etl/mfw/refresh_win32_windows":
		h.handleRefreshWin32Windows(conn, msg)

	// 控制器相关路由
	case "/etl/mfw/create_adb_controller":
		h.handleCreateAdbController(conn, msg)
	case "/etl/mfw/create_win32_controller":
		h.handleCreateWin32Controller(conn, msg)
	case "/etl/mfw/disconnect_controller":
		h.handleDisconnectController(conn, msg)
	case "/etl/mfw/request_screencap":
		h.handleScreencap(conn, msg)
	case "/etl/mfw/controller_click":
		h.handleControllerClick(conn, msg)
	case "/etl/mfw/controller_swipe":
		h.handleControllerSwipe(conn, msg)
	case "/etl/mfw/controller_input_text":
		h.handleControllerInputText(conn, msg)
	case "/etl/mfw/controller_start_app":
		h.handleControllerStartApp(conn, msg)
	case "/etl/mfw/controller_stop_app":
		h.handleControllerStopApp(conn, msg)

	// 任务相关路由
	case "/etl/mfw/submit_task":
		h.handleSubmitTask(conn, msg)
	case "/etl/mfw/query_task_status":
		h.handleQueryTaskStatus(conn, msg)
	case "/etl/mfw/stop_task":
		h.handleStopTask(conn, msg)

	// 资源相关路由
	case "/etl/mfw/load_resource":
		h.handleLoadResource(conn, msg)
	case "/etl/mfw/register_custom_recognition":
		h.handleRegisterCustomRecognition(conn, msg)
	case "/etl/mfw/register_custom_action":
		h.handleRegisterCustomAction(conn, msg)

	default:
		logger.Warn("MFW", "未知的MFW路由: %s", path)
		h.sendError(conn, errors.NewInvalidRequestError("未知的MFW路由: "+path))
	}

	return nil
}

// 设备相关处理方法
func (h *MFWHandler) handleRefreshAdbDevices(conn *server.Connection, msg models.Message) {
	logger.Info("MFW", "刷新ADB设备列表")
	devices, err := h.service.DeviceManager().RefreshAdbDevices()
	if err != nil {
		logger.Error("MFW", "刷新ADB设备列表失败: %v", err)
		h.sendMFWError(conn, mfw.ErrCodeDeviceNotFound, "刷新设备列表失败", err.Error())
		return
	}

	// 发送设备列表响应
	response := models.Message{
		Path: "/lte/mfw/adb_devices",
		Data: map[string]interface{}{
			"devices": devices,
		},
	}
	conn.Send(response)
}

func (h *MFWHandler) handleRefreshWin32Windows(conn *server.Connection, msg models.Message) {
	logger.Info("MFW", "刷新Win32窗体列表")
	windows, err := h.service.DeviceManager().RefreshWin32Windows()
	if err != nil {
		logger.Error("MFW", "刷新Win32窗体列表失败: %v", err)
		h.sendMFWError(conn, mfw.ErrCodeDeviceNotFound, "刷新窗体列表失败", err.Error())
		return
	}

	// 发送窗体列表响应
	response := models.Message{
		Path: "/lte/mfw/win32_windows",
		Data: map[string]interface{}{
			"windows": windows,
		},
	}
	conn.Send(response)
}

// 控制器相关处理方法
func (h *MFWHandler) handleCreateAdbController(conn *server.Connection, msg models.Message) {
	dataMap, ok := msg.Data.(map[string]interface{})
	if !ok {
		h.sendError(conn, errors.NewInvalidRequestError("请求数据格式错误"))
		return
	}

	adbPath, _ := dataMap["adb_path"].(string)
	address, _ := dataMap["address"].(string)
	screencapMethods, _ := dataMap["screencap_methods"].([]interface{})
	inputMethods, _ := dataMap["input_methods"].([]interface{})
	config, _ := dataMap["config"].(string)
	agentPath, _ := dataMap["agent_path"].(string)

	// 转换方法列表
	screencapMethodsStr := h.convertInterfaceSliceToStringSlice(screencapMethods)
	inputMethodsStr := h.convertInterfaceSliceToStringSlice(inputMethods)

	controllerID, err := h.service.ControllerManager().CreateAdbController(
		adbPath, address, screencapMethodsStr, inputMethodsStr, config, agentPath,
	)
	if err != nil {
		logger.Error("MFW", "创建ADB控制器失败: %v", err)
		h.sendMFWError(conn, mfw.ErrCodeControllerCreateFail, "控制器创建失败", err.Error())
		return
	}

	// 自动连接控制器
	if err := h.service.ControllerManager().ConnectController(controllerID); err != nil {
		logger.Error("MFW", "连接ADB控制器失败: %v", err)
		h.sendMFWError(conn, mfw.ErrCodeControllerConnectFail, "控制器连接失败", err.Error())
		return
	}

	// 发送控制器创建响应
	response := models.Message{
		Path: "/lte/mfw/controller_created",
		Data: map[string]interface{}{
			"success":       true,
			"controller_id": controllerID,
			"type":          "adb",
		},
	}
	conn.Send(response)
}

func (h *MFWHandler) handleCreateWin32Controller(conn *server.Connection, msg models.Message) {
	dataMap, ok := msg.Data.(map[string]interface{})
	if !ok {
		h.sendError(conn, errors.NewInvalidRequestError("请求数据格式错误"))
		return
	}

	hwnd, _ := dataMap["hwnd"].(string)
	screencapMethod, _ := dataMap["screencap_method"].(string)
	inputMethod, _ := dataMap["input_method"].(string)

	controllerID, err := h.service.ControllerManager().CreateWin32Controller(
		hwnd, screencapMethod, inputMethod,
	)
	if err != nil {
		logger.Error("MFW", "创建Win32控制器失败: %v", err)
		h.sendMFWError(conn, mfw.ErrCodeControllerCreateFail, "控制器创建失败", err.Error())
		return
	}

	// 自动连接控制器
	if err := h.service.ControllerManager().ConnectController(controllerID); err != nil {
		logger.Error("MFW", "连接Win32控制器失败: %v", err)
		h.sendMFWError(conn, mfw.ErrCodeControllerConnectFail, "控制器连接失败", err.Error())
		return
	}

	// 发送控制器创建响应
	response := models.Message{
		Path: "/lte/mfw/controller_created",
		Data: map[string]interface{}{
			"success":       true,
			"controller_id": controllerID,
			"type":          "win32",
		},
	}
	conn.Send(response)
}

func (h *MFWHandler) handleDisconnectController(conn *server.Connection, msg models.Message) {
	dataMap, ok := msg.Data.(map[string]interface{})
	if !ok {
		h.sendError(conn, errors.NewInvalidRequestError("请求数据格式错误"))
		return
	}

	controllerID, _ := dataMap["controller_id"].(string)

	err := h.service.ControllerManager().DisconnectController(controllerID)
	if err != nil {
		logger.Error("MFW", "断开控制器失败: %v", err)
		h.sendMFWError(conn, mfw.ErrCodeControllerNotFound, "控制器不存在", err.Error())
		return
	}

	// 发送控制器状态更新
	response := models.Message{
		Path: "/lte/mfw/controller_status",
		Data: map[string]interface{}{
			"controller_id": controllerID,
			"connected":     false,
		},
	}
	conn.Send(response)
}

func (h *MFWHandler) handleScreencap(conn *server.Connection, msg models.Message) {
	dataMap, ok := msg.Data.(map[string]interface{})
	if !ok {
		h.sendError(conn, errors.NewInvalidRequestError("请求数据格式错误"))
		return
	}

	controllerID, _ := dataMap["controller_id"].(string)

	// 创建截图请求
	req := &mfw.ScreencapRequest{
		ControllerID: controllerID,
	}

	result, err := h.service.ControllerManager().Screencap(req)
	if err != nil {
		logger.Error("MFW", "截图失败: %v", err)
		h.sendMFWError(conn, mfw.ErrCodeScreencapFailed, "截图失败", err.Error())
		return
	}

	// 发送截图结果
	response := models.Message{
		Path: "/lte/mfw/screencap_result",
		Data: map[string]interface{}{
			"controller_id": controllerID,
			"success":       true,
			"image":         result.ImageData,
			"width":         result.Width,
			"height":        result.Height,
		},
	}
	conn.Send(response)
}

func (h *MFWHandler) handleControllerClick(conn *server.Connection, msg models.Message) {
	dataMap, ok := msg.Data.(map[string]interface{})
	if !ok {
		h.sendError(conn, errors.NewInvalidRequestError("请求数据格式错误"))
		return
	}

	controllerID, _ := dataMap["controller_id"].(string)
	x, _ := dataMap["x"].(float64)
	y, _ := dataMap["y"].(float64)

	result, err := h.service.ControllerManager().Click(controllerID, int32(x), int32(y))
	if err != nil {
		logger.Error("MFW", "点击操作失败: %v", err)
		h.sendMFWError(conn, mfw.ErrCodeOperationFailed, "点击操作失败", err.Error())
		return
	}

	h.sendControllerOperationResult(conn, result)
}

func (h *MFWHandler) handleControllerSwipe(conn *server.Connection, msg models.Message) {
	dataMap, ok := msg.Data.(map[string]interface{})
	if !ok {
		h.sendError(conn, errors.NewInvalidRequestError("请求数据格式错误"))
		return
	}

	controllerID, _ := dataMap["controller_id"].(string)
	x1, _ := dataMap["x1"].(float64)
	y1, _ := dataMap["y1"].(float64)
	x2, _ := dataMap["x2"].(float64)
	y2, _ := dataMap["y2"].(float64)
	duration, _ := dataMap["duration"].(float64)

	result, err := h.service.ControllerManager().Swipe(controllerID, int32(x1), int32(y1), int32(x2), int32(y2), int32(duration))
	if err != nil {
		logger.Error("MFW", "滑动操作失败: %v", err)
		h.sendMFWError(conn, mfw.ErrCodeOperationFailed, "滑动操作失败", err.Error())
		return
	}

	h.sendControllerOperationResult(conn, result)
}

func (h *MFWHandler) handleControllerInputText(conn *server.Connection, msg models.Message) {
	dataMap, ok := msg.Data.(map[string]interface{})
	if !ok {
		h.sendError(conn, errors.NewInvalidRequestError("请求数据格式错误"))
		return
	}

	controllerID, _ := dataMap["controller_id"].(string)
	text, _ := dataMap["text"].(string)

	result, err := h.service.ControllerManager().InputText(controllerID, text)
	if err != nil {
		logger.Error("MFW", "输入文本失败: %v", err)
		h.sendMFWError(conn, mfw.ErrCodeOperationFailed, "输入文本失败", err.Error())
		return
	}

	h.sendControllerOperationResult(conn, result)
}

func (h *MFWHandler) handleControllerStartApp(conn *server.Connection, msg models.Message) {
	dataMap, ok := msg.Data.(map[string]interface{})
	if !ok {
		h.sendError(conn, errors.NewInvalidRequestError("请求数据格式错误"))
		return
	}

	controllerID, _ := dataMap["controller_id"].(string)
	packageName, _ := dataMap["package"].(string)

	result, err := h.service.ControllerManager().StartApp(controllerID, packageName)
	if err != nil {
		logger.Error("MFW", "启动应用失败: %v", err)
		h.sendMFWError(conn, mfw.ErrCodeOperationFailed, "启动应用失败", err.Error())
		return
	}

	h.sendControllerOperationResult(conn, result)
}

func (h *MFWHandler) handleControllerStopApp(conn *server.Connection, msg models.Message) {
	dataMap, ok := msg.Data.(map[string]interface{})
	if !ok {
		h.sendError(conn, errors.NewInvalidRequestError("请求数据格式错误"))
		return
	}

	controllerID, _ := dataMap["controller_id"].(string)
	packageName, _ := dataMap["package"].(string)

	result, err := h.service.ControllerManager().StopApp(controllerID, packageName)
	if err != nil {
		logger.Error("MFW", "停止应用失败: %v", err)
		h.sendMFWError(conn, mfw.ErrCodeOperationFailed, "停止应用失败", err.Error())
		return
	}

	h.sendControllerOperationResult(conn, result)
}

// 任务相关处理方法
func (h *MFWHandler) handleSubmitTask(conn *server.Connection, msg models.Message) {
	dataMap, ok := msg.Data.(map[string]interface{})
	if !ok {
		h.sendError(conn, errors.NewInvalidRequestError("请求数据格式错误"))
		return
	}

	controllerID, _ := dataMap["controller_id"].(string)
	resourceID, _ := dataMap["resource_id"].(string)
	entry, _ := dataMap["entry"].(string)
	pipelineOverride, _ := dataMap["pipeline_override"].(map[string]interface{})

	taskID, err := h.service.TaskManager().SubmitTask(controllerID, resourceID, entry, pipelineOverride)
	if err != nil {
		logger.Error("MFW", "提交任务失败: %v", err)
		h.sendMFWError(conn, mfw.ErrCodeTaskSubmitFailed, "任务提交失败", err.Error())
		return
	}

	// 发送任务提交响应
	response := models.Message{
		Path: "/lte/mfw/task_submitted",
		Data: map[string]interface{}{
			"task_id":       taskID,
			"controller_id": controllerID,
			"resource_id":   resourceID,
			"entry":         entry,
		},
	}
	conn.Send(response)
}

func (h *MFWHandler) handleQueryTaskStatus(conn *server.Connection, msg models.Message) {
	dataMap, ok := msg.Data.(map[string]interface{})
	if !ok {
		h.sendError(conn, errors.NewInvalidRequestError("请求数据格式错误"))
		return
	}

	taskIDFloat, _ := dataMap["task_id"].(float64)
	taskID := int64(taskIDFloat)

	status, err := h.service.TaskManager().GetTaskStatus(taskID)
	if err != nil {
		logger.Error("MFW", "查询任务状态失败: %v", err)
		h.sendMFWError(conn, mfw.ErrCodeTaskSubmitFailed, "任务不存在", err.Error())
		return
	}

	// 发送任务状态响应
	response := models.Message{
		Path: "/lte/mfw/task_status",
		Data: map[string]interface{}{
			"task_id": taskID,
			"status":  status,
		},
	}
	conn.Send(response)
}

func (h *MFWHandler) handleStopTask(conn *server.Connection, msg models.Message) {
	dataMap, ok := msg.Data.(map[string]interface{})
	if !ok {
		h.sendError(conn, errors.NewInvalidRequestError("请求数据格式错误"))
		return
	}

	taskIDFloat, _ := dataMap["task_id"].(float64)
	taskID := int64(taskIDFloat)

	err := h.service.TaskManager().StopTask(taskID)
	if err != nil {
		logger.Error("MFW", "停止任务失败: %v", err)
		h.sendMFWError(conn, mfw.ErrCodeTaskSubmitFailed, "任务不存在", err.Error())
		return
	}

	// 发送任务状态响应
	response := models.Message{
		Path: "/lte/mfw/task_status",
		Data: map[string]interface{}{
			"task_id": taskID,
			"status":  "stopped",
		},
	}
	conn.Send(response)
}

// 资源相关处理方法
func (h *MFWHandler) handleLoadResource(conn *server.Connection, msg models.Message) {
	dataMap, ok := msg.Data.(map[string]interface{})
	if !ok {
		h.sendError(conn, errors.NewInvalidRequestError("请求数据格式错误"))
		return
	}

	resourcePath, _ := dataMap["resource_path"].(string)

	resourceID, resourceHash, err := h.service.ResourceManager().LoadResource(resourcePath)
	if err != nil {
		logger.Error("MFW", "加载资源失败: %v", err)
		h.sendMFWError(conn, mfw.ErrCodeResourceLoadFailed, "资源加载失败", err.Error())
		return
	}

	// 发送资源加载响应
	response := models.Message{
		Path: "/lte/mfw/resource_loaded",
		Data: map[string]interface{}{
			"resource_id":   resourceID,
			"resource_hash": resourceHash,
			"resource_path": resourcePath,
		},
	}
	conn.Send(response)
}

func (h *MFWHandler) handleRegisterCustomRecognition(conn *server.Connection, msg models.Message) {
	// TODO: 自定义识别注册功能暂未实现
	logger.Warn("MFW", "自定义识别注册功能暂未实现")
	h.sendMFWError(conn, mfw.ErrCodeResourceLoadFailed, "功能未实现", "自定义识别注册功能暂未实现")
}

func (h *MFWHandler) handleRegisterCustomAction(conn *server.Connection, msg models.Message) {
	// TODO: 自定义动作注册功能暂未实现
	logger.Warn("MFW", "自定义动作注册功能暂未实现")
	h.sendMFWError(conn, mfw.ErrCodeResourceLoadFailed, "功能未实现", "自定义动作注册功能暂未实现")
}

// 辅助方法
func (h *MFWHandler) convertInterfaceSliceToStringSlice(input []interface{}) []string {
	if input == nil {
		return []string{}
	}
	result := make([]string, 0, len(input))
	for _, v := range input {
		if str, ok := v.(string); ok {
			result = append(result, str)
		}
	}
	return result
}

func (h *MFWHandler) sendError(conn *server.Connection, err *errors.LBError) {
	errorMsg := models.Message{
		Path: "/error",
		Data: err.ToErrorData(),
	}
	conn.Send(errorMsg)
}

func (h *MFWHandler) sendMFWError(conn *server.Connection, code, message string, detail interface{}) {
	errorMsg := models.Message{
		Path: "/error",
		Data: map[string]interface{}{
			"code":    code,
			"message": message,
			"detail":  detail,
		},
	}
	conn.Send(errorMsg)
}

func (h *MFWHandler) sendControllerOperationResult(conn *server.Connection, result *mfw.ControllerOperationResult) {
	response := models.Message{
		Path: "/lte/mfw/controller_operation_result",
		Data: map[string]interface{}{
			"controller_id": result.ControllerID,
			"operation":     result.Operation,
			"success":       result.Success,
			"status":        result.Status,
		},
	}
	conn.Send(response)
}
