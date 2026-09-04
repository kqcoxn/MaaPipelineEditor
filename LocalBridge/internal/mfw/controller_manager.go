package mfw

import (
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	maa "github.com/MaaXYZ/maa-framework-go/v4"
	"github.com/MaaXYZ/maa-framework-go/v4/controller/adb"
	"github.com/MaaXYZ/maa-framework-go/v4/controller/macos"
	"github.com/MaaXYZ/maa-framework-go/v4/controller/win32"
	"github.com/google/uuid"
	mpeconfig "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/config"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
)

// 控制器管理器
type ControllerManager struct {
	controllers map[string]*ControllerInfo
	mu          sync.RWMutex
}

// 创建控制器管理器
func NewControllerManager() *ControllerManager {
	return &ControllerManager{
		controllers: make(map[string]*ControllerInfo),
	}
}

// 创建ADB控制器
func (cm *ControllerManager) CreateAdbController(adbPath, address string, screencapMethod, inputMethod []string, config, agentPath string) (string, error) {
	logger.Debug("MFW", "创建 ADB 控制器: %s @ %s", adbPath, address)

	controllerID := uuid.New().String()

	// 解析截图方法
	var scMethod adb.ScreencapMethod
	for _, m := range screencapMethod {
		parsed, _ := adb.ParseScreencapMethod(m)
		scMethod |= parsed
	}
	// 如果未指定方法，使用传入的第一个方法作为默认，maafw-golang 库会处理默认值

	// 解析输入方法
	var inMethod adb.InputMethod
	for _, m := range inputMethod {
		parsed, _ := adb.ParseInputMethod(m)
		inMethod |= parsed
	}

	if strings.TrimSpace(agentPath) == "" {
		if cfg := mpeconfig.GetGlobal(); cfg != nil {
			agentPath = cfg.ResolvedMaaFWAgentDir()
		}
	}
	warning := ""
	if strings.TrimSpace(agentPath) == "" {
		warning = "MaaAgentBinary 目录不存在，MaaTouch/Minitouch 不可用"
		if requiresAdbAgent(inputMethod) && !hasAgentlessAdbFallback(inputMethod) {
			return "", NewMFWError(ErrCodeControllerCreateFail, warning, nil)
		}
		logger.Warn("MFW", "%s；候选输入方式: %v", warning, inputMethod)
	} else {
		logger.Info("MFW", "使用 MaaAgentBinary: %s", agentPath)
	}
	logger.Info("MFW", "ADB 输入方式候选: %v", inputMethod)

	// 创建 ADB 控制器
	ctrl, err := maa.NewAdbController(adbPath, address, scMethod, inMethod, config, agentPath)
	if err != nil {
		return "", NewMFWError(ErrCodeControllerCreateFail, "failed to create adb controller: "+err.Error(), nil)
	}

	info := &ControllerInfo{
		ControllerID: controllerID,
		Type:         "ADB",
		Controller:   ctrl,
		Connected:    false,
		CreatedAt:    time.Now(),
		LastActiveAt: time.Now(),
		InputMethods: append([]string(nil), inputMethod...),
		AgentPath:    agentPath,
		Warning:      warning,
	}

	cm.mu.Lock()
	cm.controllers[controllerID] = info
	cm.mu.Unlock()

	logger.Debug("MFW", "控制器已创建: %s", controllerID)
	return controllerID, nil
}

func requiresAdbAgent(methods []string) bool {
	for _, method := range methods {
		if strings.EqualFold(method, "Maatouch") || strings.EqualFold(method, "MinitouchAndAdbKey") {
			return true
		}
	}
	return false
}

func hasAgentlessAdbFallback(methods []string) bool {
	for _, method := range methods {
		if strings.EqualFold(method, "AdbShell") || strings.EqualFold(method, "EmulatorExtras") {
			return true
		}
	}
	return false
}

// win32ScreencapMethodMapping 额外的截图方法映射（WithPseudoMinimize 变体）
// MaaFramework 中 FramePool=2, PrintWindow=16
var win32ScreencapMethodMapping = map[string]win32.ScreencapMethod{
	"FramePoolWithPseudoMinimize":   win32.ScreencapFramePool,
	"PrintWindowWithPseudoMinimize": win32.ScreencapPrintWindow,
}

// parseWin32ScreencapMethod 解析 Win32 截图方法，支持额外的映射
func parseWin32ScreencapMethod(name string) (win32.ScreencapMethod, error) {
	if method, ok := win32ScreencapMethodMapping[name]; ok {
		return method, nil
	}
	return win32.ParseScreencapMethod(name)
}

// 创建 Win32 控制器
func (cm *ControllerManager) CreateWin32Controller(hwnd, screencapMethod, inputMethod string) (string, error) {
	logger.Debug("MFW", "创建 Win32 控制器: %s", hwnd)

	controllerID := uuid.New().String()

	hwndPtr, err := parseWindowHandle(hwnd)
	if err != nil {
		return "", NewMFWError(ErrCodeInvalidParameter, err.Error(), nil)
	}
	if hwndPtr != nil {
		logger.Debug("MFW", "解析窗口句柄: %s -> %v", hwnd, hwndPtr)
	}

	// 解析截图方法，默认使用 FramePool
	scMethod, err := parseWin32ScreencapMethod(screencapMethod)
	if err != nil || scMethod == win32.ScreencapNone {
		scMethod = win32.ScreencapFramePool
		logger.Debug("MFW", "使用默认截图方法: FramePool")
	}

	// 解析鼠标输入方法，默认使用 SendMessageWithCursorPos
	mouseMethod, err := win32.ParseInputMethod(inputMethod)
	if err != nil || mouseMethod == win32.InputNone {
		mouseMethod = win32.InputSendMessageWithCursorPos
		logger.Debug("MFW", "使用默认输入方法: SendMessageWithCursorPos")
	}

	// 创建 Win32 控制器
	ctrl, err := maa.NewWin32Controller(hwndPtr, scMethod, mouseMethod, mouseMethod)
	if err != nil {
		return "", NewMFWError(ErrCodeControllerCreateFail, "failed to create win32 controller: "+err.Error(), nil)
	}

	info := &ControllerInfo{
		ControllerID: controllerID,
		Type:         "Win32",
		Controller:   ctrl,
		Connected:    false,
		CreatedAt:    time.Now(),
		LastActiveAt: time.Now(),
	}

	cm.mu.Lock()
	cm.controllers[controllerID] = info
	cm.mu.Unlock()

	logger.Debug("MFW", "控制器已创建: %s", controllerID)
	return controllerID, nil
}

// 创建 PlayCover 控制器 (macOS上运行 iOS 应用)
func (cm *ControllerManager) CreatePlayCoverController(address, deviceUUID string) (string, error) {
	logger.Debug("MFW", "创建 PlayCover 控制器: %s", address)

	controllerID := uuid.New().String()

	// 创建 PlayCover 控制器
	ctrl, err := maa.NewPlayCoverController(address, deviceUUID)
	if err != nil {
		return "", NewMFWError(ErrCodeControllerCreateFail, "failed to create playcover controller: "+err.Error(), nil)
	}

	info := &ControllerInfo{
		ControllerID: controllerID,
		Type:         "PlayCover",
		Controller:   ctrl,
		Connected:    false,
		UUID:         deviceUUID,
		CreatedAt:    time.Now(),
		LastActiveAt: time.Now(),
	}

	cm.mu.Lock()
	cm.controllers[controllerID] = info
	cm.mu.Unlock()

	logger.Debug("MFW", "控制器已创建: %s", controllerID)
	return controllerID, nil
}

// 创建 Gamepad 控制器
func (cm *ControllerManager) CreateGamepadController(hwnd, gamepadType, screencapMethod string) (string, error) {
	logger.Debug("MFW", "创建 Gamepad 控制器: type=%s, hwnd=%s", gamepadType, hwnd)

	controllerID := uuid.New().String()

	hwndPtr, err := parseWindowHandle(hwnd)
	if err != nil {
		return "", NewMFWError(ErrCodeInvalidParameter, err.Error(), nil)
	}
	if hwndPtr != nil {
		logger.Debug("MFW", "解析窗口句柄: %s -> %v", hwnd, hwndPtr)
	}

	// 解析游戏pad类型
	var gpType maa.GamepadType
	switch strings.ToLower(gamepadType) {
	case "dualshock4", "ds4":
		gpType = maa.GamepadTypeDualShock4
	default:
		gpType = maa.GamepadTypeXbox360
	}

	// 解析截图方法
	scMethod, _ := parseWin32ScreencapMethod(screencapMethod)

	// 创建 Gamepad 控制器
	ctrl, err := maa.NewGamepadController(hwndPtr, gpType, scMethod)
	if err != nil {
		return "", NewMFWError(ErrCodeControllerCreateFail, "failed to create gamepad controller (ViGEm驱动未安装?): "+err.Error(), nil)
	}

	info := &ControllerInfo{
		ControllerID: controllerID,
		Type:         "Gamepad",
		Controller:   ctrl,
		Connected:    false,
		CreatedAt:    time.Now(),
		LastActiveAt: time.Now(),
	}

	cm.mu.Lock()
	cm.controllers[controllerID] = info
	cm.mu.Unlock()

	logger.Debug("MFW", "控制器已创建: %s", controllerID)
	return controllerID, nil
}

// 创建 WlRoots 控制器
func (cm *ControllerManager) CreateWlRootsController(socketPath string, useWin32VkCode bool) (string, error) {
	logger.Debug("MFW", "创建 WlRoots 控制器: socketPath=%s, useWin32VkCode=%t", socketPath, useWin32VkCode)

	controllerID := uuid.New().String()

	// 创建 WlRoots 控制器
	ctrl, err := maa.NewWlRootsController(socketPath, useWin32VkCode)
	if err != nil {
		return "", NewMFWError(ErrCodeControllerCreateFail, "failed to create wlroots controller: "+err.Error(), nil)
	}

	info := &ControllerInfo{
		ControllerID: controllerID,
		Type:         "WlRoots",
		Controller:   ctrl,
		Connected:    false,
		CreatedAt:    time.Now(),
		LastActiveAt: time.Now(),
	}

	cm.mu.Lock()
	cm.controllers[controllerID] = info
	cm.mu.Unlock()

	logger.Debug("MFW", "控制器已创建: %s", controllerID)
	return controllerID, nil
}

// 创建 macOS 原生控制器。
// MaaFramework 使用 CGWindowID（窗口 ID）作为目标句柄；输入层会根据窗口 ID
// 反查进程 PID，因此这里不能把进程 PID 当作控制器句柄使用。
func (cm *ControllerManager) CreateMacosController(windowID string, screencapMethod, inputMethod string) (string, error) {
	parsedWindowID, err := parseMacOSWindowID(windowID)
	if err != nil {
		return "", NewMFWError(ErrCodeInvalidParameter, err.Error(), nil)
	}

	scMethod := macos.ScreencapNone
	switch screencapMethod {
	case "", "None":
		scMethod = macos.ScreencapNone
	case "ScreenCaptureKit":
		scMethod = macos.ScreencapScreenCaptureKit
	default:
		return "", NewMFWError(ErrCodeInvalidParameter, "不支持的 macOS 截图方法: "+screencapMethod, nil)
	}

	inMethod := macos.InputNone
	switch inputMethod {
	case "", "None":
		inMethod = macos.InputNone
	case "GlobalEvent":
		inMethod = macos.InputGlobalEvent
	case "PostToPid":
		inMethod = macos.InputPostToPid
	default:
		return "", NewMFWError(ErrCodeInvalidParameter, "不支持的 macOS 输入方法: "+inputMethod, nil)
	}

	ctrl, err := maa.NewMacOSController(uint32(parsedWindowID), scMethod, inMethod)
	if err != nil {
		return "", NewMFWError(ErrCodeControllerCreateFail, "创建 macOS 控制器失败: "+err.Error(), nil)
	}

	controllerID := uuid.New().String()
	info := &ControllerInfo{
		ControllerID: controllerID,
		Type:         "MacOS",
		Controller:   ctrl,
		Connected:    false,
		CreatedAt:    time.Now(),
		LastActiveAt: time.Now(),
	}

	cm.mu.Lock()
	cm.controllers[controllerID] = info
	cm.mu.Unlock()

	logger.Debug("MFW", "macOS 控制器已创建: %s (window=%d)", controllerID, parsedWindowID)
	return controllerID, nil
}

func parseMacOSWindowID(windowID string) (uint64, error) {
	windowID = strings.TrimSpace(windowID)
	if windowID == "" {
		return 0, fmt.Errorf("macOS 窗口 ID 不能为空")
	}

	base := 10
	value := windowID
	if strings.HasPrefix(strings.ToLower(value), "0x") {
		base = 16
		value = value[2:]
	}
	parsed, err := strconv.ParseUint(value, base, 32)
	if err != nil {
		return 0, fmt.Errorf("macOS 窗口 ID 无效: %w", err)
	}
	return parsed, nil
}

// 连接控制器
func (cm *ControllerManager) ConnectController(controllerID string) error {
	cm.mu.RLock()
	info, exists := cm.controllers[controllerID]
	cm.mu.RUnlock()
	if !exists {
		return ErrControllerNotFound
	}
	info.lifecycleMu.Lock()
	defer info.lifecycleMu.Unlock()

	// 获取控制器实例
	ctrl, ok := info.Controller.(*maa.Controller)
	if !ok || ctrl == nil {
		return NewMFWError(ErrCodeControllerNotConnected, "controller instance not available", nil)
	}

	// 异步连接并等待完成。不要持有管理器锁，否则超时期间无法处理断开请求。
	job := ctrl.PostConnect()
	if job == nil {
		cm.removeController(controllerID, info)
		return NewMFWError(ErrCodeControllerConnectFail, "failed to post connect", nil)
	}

	// 轮询状态，避免超时后仍有 Job.Wait goroutine 访问底层句柄。
	status, timedOut := waitControllerJob(job, 10*time.Second, 25*time.Millisecond)
	if timedOut {
		logger.Warn("MFW", "控制器连接超时！")
		cm.removeController(controllerID, info)
		return NewMFWError(ErrCodeControllerConnectFail, "控制器连接超时（10 秒）", nil)
	}

	// 检查连接任务与控制器状态。失败控制器必须从管理器中移除，避免后续请求继续复用。
	if !status.Success() || !ctrl.Connected() {
		cm.removeController(controllerID, info)
		return NewMFWError(ErrCodeControllerConnectFail, "controller connection failed", nil)
	}

	// 获取 UUID
	if uuidStr, err := ctrl.GetUUID(); err == nil {
		info.UUID = uuidStr
	}

	cm.mu.Lock()
	current, stillExists := cm.controllers[controllerID]
	if !stillExists || current != info {
		cm.mu.Unlock()
		return ErrControllerNotFound
	}
	info.Connected = true
	info.LastActiveAt = time.Now()
	cm.mu.Unlock()

	if controllerInfo, err := ctrl.GetInfo(); err == nil {
		logger.Info("MFW", "控制器已连接: %s, info=%s", controllerID, controllerInfo)
	} else {
		logger.Info("MFW", "控制器已连接: %s, input_methods=%v", controllerID, info.InputMethods)
	}
	return nil
}

// 从管理器摘除控制器并销毁底层实例。超时场景下 Destroy 可能需要等待 MaaFramework
// 当前连接动作结束，因此放到后台执行；管理器会立即忘记该控制器，不再接受后续请求。
func (cm *ControllerManager) removeController(controllerID string, expected *ControllerInfo) {
	cm.mu.Lock()
	info, exists := cm.controllers[controllerID]
	if !exists || info != expected {
		cm.mu.Unlock()
		return
	}
	delete(cm.controllers, controllerID)
	cm.mu.Unlock()

	go destroyController(info)
}

func waitControllerJob(job *maa.Job, timeout, pollInterval time.Duration) (maa.Status, bool) {
	if job == nil {
		return maa.StatusFailure, false
	}
	if timeout <= 0 {
		status := job.Status()
		return status, !status.Done()
	}
	if pollInterval <= 0 {
		pollInterval = 25 * time.Millisecond
	}

	deadline := time.NewTimer(timeout)
	defer deadline.Stop()
	ticker := time.NewTicker(pollInterval)
	defer ticker.Stop()

	for {
		status := job.Status()
		if status.Done() {
			return status, false
		}

		select {
		case <-ticker.C:
		case <-deadline.C:
			if status := job.Status(); status.Done() {
				return status, false
			}
			return maa.StatusInvalid, true
		}
	}
}

func destroyController(info *ControllerInfo) {
	if info == nil {
		return
	}
	info.lifecycleMu.Lock()
	defer info.lifecycleMu.Unlock()
	if ctrl, ok := info.Controller.(*maa.Controller); ok && ctrl != nil {
		ctrl.Destroy()
	}
}

// 断开控制器
func (cm *ControllerManager) DisconnectController(controllerID string) error {
	cm.mu.Lock()
	info, exists := cm.controllers[controllerID]
	if !exists {
		cm.mu.Unlock()
		return ErrControllerNotFound
	}
	delete(cm.controllers, controllerID)
	cm.mu.Unlock()

	// 等待正在进行的连接或操作结束后再销毁底层实例。
	destroyController(info)

	logger.Info("MFW", "控制器已断开: %s", controllerID)
	return nil
}

// 获取控制器
func (cm *ControllerManager) GetController(controllerID string) (*ControllerInfo, error) {
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	info, exists := cm.controllers[controllerID]
	if !exists {
		return nil, ErrControllerNotFound
	}

	return info, nil
}

// 执行点击操作
func (cm *ControllerManager) Click(controllerID string, x, y int32) (*ControllerOperationResult, error) {
	cm.mu.RLock()
	info, exists := cm.controllers[controllerID]
	cm.mu.RUnlock()

	if !exists {
		return nil, ErrControllerNotFound
	}

	if !info.Connected {
		return nil, ErrNotConnected
	}

	ctrl, ok := info.Controller.(*maa.Controller)
	if !ok || ctrl == nil {
		return nil, ErrNotConnected
	}

	// 执行点击操作
	job := ctrl.PostClick(x, y)
	if job == nil {
		return nil, NewMFWError(ErrCodeOperationFail, "failed to post click", nil)
	}
	job.Wait()

	info.LastActiveAt = time.Now()

	return &ControllerOperationResult{
		ControllerID: controllerID,
		Operation:    OpClick,
		Success:      job.Success(),
		Status:       "Success",
	}, nil
}

// 执行滑动操作
func (cm *ControllerManager) Swipe(controllerID string, x1, y1, x2, y2, duration int32) (*ControllerOperationResult, error) {
	cm.mu.RLock()
	info, exists := cm.controllers[controllerID]
	cm.mu.RUnlock()

	if !exists {
		return nil, ErrControllerNotFound
	}

	if !info.Connected {
		return nil, ErrNotConnected
	}

	ctrl, ok := info.Controller.(*maa.Controller)
	if !ok || ctrl == nil {
		return nil, ErrNotConnected
	}

	// 执行滑动操作
	job := ctrl.PostSwipe(x1, y1, x2, y2, time.Duration(duration)*time.Millisecond)
	if job == nil {
		return nil, NewMFWError(ErrCodeOperationFail, "failed to post swipe", nil)
	}
	job.Wait()

	info.LastActiveAt = time.Now()

	return &ControllerOperationResult{
		ControllerID: controllerID,
		Operation:    OpSwipe,
		Success:      job.Success(),
		Status:       "Success",
	}, nil
}

// 输入文本
func (cm *ControllerManager) InputText(controllerID, text string) (*ControllerOperationResult, error) {
	cm.mu.RLock()
	info, exists := cm.controllers[controllerID]
	cm.mu.RUnlock()

	if !exists {
		return nil, ErrControllerNotFound
	}

	if !info.Connected {
		return nil, ErrNotConnected
	}

	ctrl, ok := info.Controller.(*maa.Controller)
	if !ok || ctrl == nil {
		return nil, ErrNotConnected
	}

	// 执行输入文本操作
	job := ctrl.PostInputText(text)
	if job == nil {
		return nil, NewMFWError(ErrCodeOperationFail, "failed to post input text", nil)
	}
	job.Wait()

	info.LastActiveAt = time.Now()

	return &ControllerOperationResult{
		ControllerID: controllerID,
		Operation:    OpInputText,
		Success:      job.Success(),
		Status:       "Success",
	}, nil
}

// 启动应用
func (cm *ControllerManager) StartApp(controllerID, intent string) (*ControllerOperationResult, error) {
	cm.mu.RLock()
	info, exists := cm.controllers[controllerID]
	cm.mu.RUnlock()

	if !exists {
		return nil, ErrControllerNotFound
	}

	if !info.Connected {
		return nil, ErrNotConnected
	}

	ctrl, ok := info.Controller.(*maa.Controller)
	if !ok || ctrl == nil {
		return nil, ErrNotConnected
	}

	// 执行启动应用操作
	job := ctrl.PostStartApp(intent)
	if job == nil {
		return nil, NewMFWError(ErrCodeOperationFail, "failed to post start app", nil)
	}
	job.Wait()

	info.LastActiveAt = time.Now()

	return &ControllerOperationResult{
		ControllerID: controllerID,
		Operation:    OpStartApp,
		Success:      job.Success(),
		Status:       "Success",
	}, nil
}

// 停止应用
func (cm *ControllerManager) StopApp(controllerID, intent string) (*ControllerOperationResult, error) {
	cm.mu.RLock()
	info, exists := cm.controllers[controllerID]
	cm.mu.RUnlock()

	if !exists {
		return nil, ErrControllerNotFound
	}

	if !info.Connected {
		return nil, ErrNotConnected
	}

	ctrl, ok := info.Controller.(*maa.Controller)
	if !ok || ctrl == nil {
		return nil, ErrNotConnected
	}

	// 执行停止应用操作
	job := ctrl.PostStopApp(intent)
	if job == nil {
		return nil, NewMFWError(ErrCodeOperationFail, "failed to post stop app", nil)
	}
	job.Wait()

	info.LastActiveAt = time.Now()

	return &ControllerOperationResult{
		ControllerID: controllerID,
		Operation:    OpStopApp,
		Success:      job.Success(),
		Status:       "Success",
	}, nil
}

// 获取控制器状态
func (cm *ControllerManager) GetControllerStatus(controllerID string) (bool, string, error) {
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	info, exists := cm.controllers[controllerID]
	if !exists {
		return false, "", ErrControllerNotFound
	}

	return info.Connected, info.UUID, nil
}

// 列出所有控制器
func (cm *ControllerManager) ListControllers() []*ControllerInfo {
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	result := make([]*ControllerInfo, 0, len(cm.controllers))
	for _, info := range cm.controllers {
		result = append(result, info)
	}

	return result
}

// 清理非活跃控制器
func (cm *ControllerManager) CleanupInactive(timeout time.Duration) {
	cm.mu.Lock()
	now := time.Now()
	stale := make([]*ControllerInfo, 0)
	for id, info := range cm.controllers {
		if now.Sub(info.LastActiveAt) > timeout {
			delete(cm.controllers, id)
			stale = append(stale, info)
			logger.Debug("MFW", "清理非活跃控制器: %s", id)
		}
	}
	cm.mu.Unlock()

	for _, info := range stale {
		destroyController(info)
	}
}

// 断开所有控制器
func (cm *ControllerManager) DisconnectAll() {
	cm.mu.Lock()
	controllers := make([]struct {
		id   string
		info *ControllerInfo
	}, 0, len(cm.controllers))
	for id, info := range cm.controllers {
		controllers = append(controllers, struct {
			id   string
			info *ControllerInfo
		}{id: id, info: info})
	}
	cm.controllers = make(map[string]*ControllerInfo)
	cm.mu.Unlock()

	for _, item := range controllers {
		destroyController(item.info)
		logger.Debug("MFW", "断开控制器: %s", item.id)
	}

	logger.Debug("MFW", "所有控制器已断开")
}

// Gamepad 专用操作方法

// 点击手柄按键
func (cm *ControllerManager) ClickGamepadKey(controllerID string, keycode int32) (*ControllerOperationResult, error) {
	cm.mu.RLock()
	info, exists := cm.controllers[controllerID]
	cm.mu.RUnlock()

	if !exists {
		return nil, ErrControllerNotFound
	}

	if !info.Connected {
		return nil, ErrNotConnected
	}

	ctrl, ok := info.Controller.(*maa.Controller)
	if !ok || ctrl == nil {
		return nil, ErrNotConnected
	}

	// 执行按键点击操作
	job := ctrl.PostClickKey(keycode)
	if job == nil {
		return nil, NewMFWError(ErrCodeOperationFail, "failed to post click key", nil)
	}
	job.Wait()

	info.LastActiveAt = time.Now()

	return &ControllerOperationResult{
		ControllerID: controllerID,
		Operation:    OpClickKey,
		Success:      job.Success(),
		Status:       "Success",
	}, nil
}

// 触摸摇杆/扳机
func (cm *ControllerManager) TouchGamepadControl(controllerID string, contact, x, y, pressure int32, action string) (*ControllerOperationResult, error) {
	cm.mu.RLock()
	info, exists := cm.controllers[controllerID]
	cm.mu.RUnlock()

	if !exists {
		return nil, ErrControllerNotFound
	}

	if !info.Connected {
		return nil, ErrNotConnected
	}

	ctrl, ok := info.Controller.(*maa.Controller)
	if !ok || ctrl == nil {
		return nil, ErrNotConnected
	}

	var job *maa.Job
	var op ControllerOperation

	// 根据动作类型执行不同操作
	switch strings.ToLower(action) {
	case "down":
		job = ctrl.PostTouchDown(contact, x, y, pressure)
		op = OpTouchDown
	case "move":
		job = ctrl.PostTouchMove(contact, x, y, pressure)
		op = OpTouchMove
	case "up":
		job = ctrl.PostTouchUp(contact)
		op = OpTouchUp
	default:
		return nil, NewMFWError(ErrCodeOperationFail, "invalid touch action: "+action, nil)
	}

	if job == nil {
		return nil, NewMFWError(ErrCodeOperationFail, "failed to post touch action", nil)
	}
	job.Wait()

	info.LastActiveAt = time.Now()

	return &ControllerOperationResult{
		ControllerID: controllerID,
		Operation:    op,
		Success:      job.Success(),
		Status:       "Success",
	}, nil
}

// 滚动操作
func (cm *ControllerManager) Scroll(controllerID string, dx, dy int32) (*ControllerOperationResult, error) {
	cm.mu.RLock()
	info, exists := cm.controllers[controllerID]
	cm.mu.RUnlock()

	if !exists {
		return nil, ErrControllerNotFound
	}

	if !info.Connected {
		return nil, ErrNotConnected
	}

	ctrl, ok := info.Controller.(*maa.Controller)
	if !ok || ctrl == nil {
		return nil, ErrNotConnected
	}

	// 执行滚动操作
	job := ctrl.PostScroll(dx, dy)
	if job == nil {
		return nil, NewMFWError(ErrCodeOperationFail, "failed to post scroll", nil)
	}
	job.Wait()

	info.LastActiveAt = time.Now()

	return &ControllerOperationResult{
		ControllerID: controllerID,
		Operation:    OpScroll,
		Success:      job.Success(),
		Status:       "Success",
	}, nil
}

// 按下按键
func (cm *ControllerManager) KeyDown(controllerID string, keycode int32) (*ControllerOperationResult, error) {
	cm.mu.RLock()
	info, exists := cm.controllers[controllerID]
	cm.mu.RUnlock()

	if !exists {
		return nil, ErrControllerNotFound
	}

	if !info.Connected {
		return nil, ErrNotConnected
	}

	ctrl, ok := info.Controller.(*maa.Controller)
	if !ok || ctrl == nil {
		return nil, ErrNotConnected
	}

	// 执行按键按下操作
	job := ctrl.PostKeyDown(keycode)
	if job == nil {
		return nil, NewMFWError(ErrCodeOperationFail, "failed to post key down", nil)
	}
	job.Wait()

	info.LastActiveAt = time.Now()

	return &ControllerOperationResult{
		ControllerID: controllerID,
		Operation:    OpKeyDown,
		Success:      job.Success(),
		Status:       "Success",
	}, nil
}

// 释放按键
func (cm *ControllerManager) KeyUp(controllerID string, keycode int32) (*ControllerOperationResult, error) {
	cm.mu.RLock()
	info, exists := cm.controllers[controllerID]
	cm.mu.RUnlock()

	if !exists {
		return nil, ErrControllerNotFound
	}

	if !info.Connected {
		return nil, ErrNotConnected
	}

	ctrl, ok := info.Controller.(*maa.Controller)
	if !ok || ctrl == nil {
		return nil, ErrNotConnected
	}

	// 执行按键释放操作
	job := ctrl.PostKeyUp(keycode)
	if job == nil {
		return nil, NewMFWError(ErrCodeOperationFail, "failed to post key up", nil)
	}
	job.Wait()

	info.LastActiveAt = time.Now()

	return &ControllerOperationResult{
		ControllerID: controllerID,
		Operation:    OpKeyUp,
		Success:      job.Success(),
		Status:       "Success",
	}, nil
}

// 带接触点和压力的点击 (ClickV2)
func (cm *ControllerManager) ClickV2(controllerID string, x, y, contact, pressure int32) (*ControllerOperationResult, error) {
	cm.mu.RLock()
	info, exists := cm.controllers[controllerID]
	cm.mu.RUnlock()

	if !exists {
		return nil, ErrControllerNotFound
	}

	if !info.Connected {
		return nil, ErrNotConnected
	}

	ctrl, ok := info.Controller.(*maa.Controller)
	if !ok || ctrl == nil {
		return nil, ErrNotConnected
	}

	// 执行带接触点和压力的点击操作
	job := ctrl.PostClickV2(x, y, contact, pressure)
	if job == nil {
		return nil, NewMFWError(ErrCodeOperationFail, "failed to post click v2", nil)
	}
	job.Wait()

	info.LastActiveAt = time.Now()

	return &ControllerOperationResult{
		ControllerID: controllerID,
		Operation:    OpClickV2,
		Success:      job.Success(),
		Status:       "Success",
	}, nil
}

// 带接触点和压力的滑动 (SwipeV2)
func (cm *ControllerManager) SwipeV2(controllerID string, x1, y1, x2, y2, duration, contact, pressure int32) (*ControllerOperationResult, error) {
	cm.mu.RLock()
	info, exists := cm.controllers[controllerID]
	cm.mu.RUnlock()

	if !exists {
		return nil, ErrControllerNotFound
	}

	if !info.Connected {
		return nil, ErrNotConnected
	}

	ctrl, ok := info.Controller.(*maa.Controller)
	if !ok || ctrl == nil {
		return nil, ErrNotConnected
	}

	// 执行带接触点和压力的滑动操作
	job := ctrl.PostSwipeV2(x1, y1, x2, y2, time.Duration(duration)*time.Millisecond, contact, pressure)
	if job == nil {
		return nil, NewMFWError(ErrCodeOperationFail, "failed to post swipe v2", nil)
	}
	job.Wait()

	info.LastActiveAt = time.Now()

	return &ControllerOperationResult{
		ControllerID: controllerID,
		Operation:    OpSwipeV2,
		Success:      job.Success(),
		Status:       "Success",
	}, nil
}

// 执行 Shell 命令 (仅 ADB 控制器)
func (cm *ControllerManager) Shell(controllerID, cmd string, timeoutMs int32) (*ControllerOperationResult, error) {
	cm.mu.RLock()
	info, exists := cm.controllers[controllerID]
	cm.mu.RUnlock()

	if !exists {
		return nil, ErrControllerNotFound
	}

	if !info.Connected {
		return nil, ErrNotConnected
	}

	ctrl, ok := info.Controller.(*maa.Controller)
	if !ok || ctrl == nil {
		return nil, ErrNotConnected
	}

	// 执行 Shell 命令
	timeout := time.Duration(timeoutMs) * time.Millisecond
	if timeout <= 0 {
		timeout = 10 * time.Second // 默认 10 秒超时
	}
	job := ctrl.PostShell(cmd, timeout)
	if job == nil {
		return nil, NewMFWError(ErrCodeOperationFail, "failed to post shell (only ADB controller supported)", nil)
	}
	job.Wait()

	info.LastActiveAt = time.Now()

	return &ControllerOperationResult{
		ControllerID: controllerID,
		Operation:    OpShell,
		Success:      job.Success(),
		Status:       "Success",
	}, nil
}

// 恢复控制器/窗口状态
func (cm *ControllerManager) Inactive(controllerID string) (*ControllerOperationResult, error) {
	cm.mu.RLock()
	info, exists := cm.controllers[controllerID]
	cm.mu.RUnlock()

	if !exists {
		return nil, ErrControllerNotFound
	}

	if !info.Connected {
		return nil, ErrNotConnected
	}

	ctrl, ok := info.Controller.(*maa.Controller)
	if !ok || ctrl == nil {
		return nil, ErrNotConnected
	}

	// 执行恢复操作
	job := ctrl.PostInactive()
	if job == nil {
		return nil, NewMFWError(ErrCodeOperationFail, "failed to post inactive", nil)
	}
	job.Wait()

	info.LastActiveAt = time.Now()

	return &ControllerOperationResult{
		ControllerID: controllerID,
		Operation:    OpInactive,
		Success:      job.Success(),
		Status:       "Success",
	}, nil
}
