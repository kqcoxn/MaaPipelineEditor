package mfw

import (
	"bytes"
	"encoding/base64"
	"image/png"
	"strconv"
	"strings"
	"sync"
	"time"
	"unsafe"

	maa "github.com/MaaXYZ/maa-framework-go/v4"
	"github.com/MaaXYZ/maa-framework-go/v4/controller/adb"
	"github.com/MaaXYZ/maa-framework-go/v4/controller/win32"
	"github.com/google/uuid"
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
	}

	cm.mu.Lock()
	cm.controllers[controllerID] = info
	cm.mu.Unlock()

	logger.Debug("MFW", "控制器已创建: %s", controllerID)
	return controllerID, nil
}

// win32InputMethodMapping 文档显示名称到实际 API 名称的映射
var win32InputMethodMapping = map[string]string{
	"SendMessageWithWindowPos": "SendMessageWithCursorPosAndBlockInput",
	"PostMessageWithWindowPos": "PostMessageWithCursorPosAndBlockInput",
}

// mapWin32InputMethod 将文档显示名称映射为实际 API 名称
func mapWin32InputMethod(name string) string {
	if mapped, ok := win32InputMethodMapping[name]; ok {
		return mapped
	}
	return name
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

	// 解析窗口句柄
	var hwndPtr unsafe.Pointer
	if hwnd != "" {
		// 去掉 "0x" 或 "0X" 前缀
		hexStr := strings.TrimPrefix(hwnd, "0x")
		hexStr = strings.TrimPrefix(hexStr, "0X")
		if val, err := strconv.ParseUint(hexStr, 16, 64); err == nil {
			hwndPtr = unsafe.Pointer(uintptr(val))
			logger.Debug("MFW", "解析窗口句柄: %s -> %v", hwnd, hwndPtr)
		} else {
			logger.Error("MFW", "解析窗口句柄失败: %s, %v", hwnd, err)
		}
	}

	// 解析截图方法，默认使用 FramePool
	scMethod, err := parseWin32ScreencapMethod(screencapMethod)
	if err != nil || scMethod == win32.ScreencapNone {
		scMethod = win32.ScreencapFramePool
		logger.Debug("MFW", "使用默认截图方法: FramePool")
	}

	// 解析鼠标输入方法，默认使用 SendMessageWithCursorPos
	actualInputMethod := mapWin32InputMethod(inputMethod)
	mouseMethod, err := win32.ParseInputMethod(actualInputMethod)
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

	// 解析窗口句柄（可选）
	var hwndPtr unsafe.Pointer
	if hwnd != "" {
		// 去掉 "0x" 或 "0X" 前缀
		hexStr := strings.TrimPrefix(hwnd, "0x")
		hexStr = strings.TrimPrefix(hexStr, "0X")
		if val, err := strconv.ParseUint(hexStr, 16, 64); err == nil {
			hwndPtr = unsafe.Pointer(uintptr(val))
			logger.Debug("MFW", "解析窗口句柄: %s -> %v", hwnd, hwndPtr)
		} else {
			logger.Error("MFW", "解析窗口句柄失败: %s, %v", hwnd, err)
		}
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
func (cm *ControllerManager) CreateWlRootsController(socketPath string) (string, error) {
	logger.Debug("MFW", "创建 WlRoots 控制器: %s", socketPath)

	controllerID := uuid.New().String()

	// 创建 WlRoots 控制器
	ctrl, err := maa.NewWlRootsController(socketPath)
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

// 连接控制器
func (cm *ControllerManager) ConnectController(controllerID string) error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	info, exists := cm.controllers[controllerID]
	if !exists {
		return ErrControllerNotFound
	}

	// 获取控制器实例
	ctrl, ok := info.Controller.(*maa.Controller)
	if !ok || ctrl == nil {
		return NewMFWError(ErrCodeControllerNotConnected, "controller instance not available", nil)
	}

	// 异步连接并等待完成
	job := ctrl.PostConnect()
	if job == nil {
		return NewMFWError(ErrCodeControllerConnectFail, "failed to post connect", nil)
	}

	// 使用超时机制等待连接完成
	done := make(chan bool, 1)
	go func() {
		job.Wait()
		done <- true
	}()

	select {
	case <-done:
		// 连接完成，继续检查状态
	case <-time.After(10 * time.Second):
		logger.Warn("MFW", "控制器连接超时！")
	}

	// 检查连接状态
	if !ctrl.Connected() {
		return NewMFWError(ErrCodeControllerConnectFail, "controller connection failed", nil)
	}

	// 获取 UUID
	if uuidStr, err := ctrl.GetUUID(); err == nil {
		info.UUID = uuidStr
	}

	info.Connected = true
	info.LastActiveAt = time.Now()

	logger.Info("MFW", "控制器已连接: %s", controllerID)
	return nil
}

// 断开控制器
func (cm *ControllerManager) DisconnectController(controllerID string) error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	info, exists := cm.controllers[controllerID]
	if !exists {
		return ErrControllerNotFound
	}

	// 销毁控制器实例
	if ctrl, ok := info.Controller.(*maa.Controller); ok && ctrl != nil {
		ctrl.Destroy()
	}

	delete(cm.controllers, controllerID)

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

// 截图
func (cm *ControllerManager) Screencap(req *ScreencapRequest) (*ScreencapResult, error) {
	cm.mu.RLock()
	info, exists := cm.controllers[req.ControllerID]
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

	// 设置截图参数
	if req.TargetLongSide > 0 {
		ctrl.SetScreenshot(maa.WithScreenshotTargetLongSide(req.TargetLongSide))
	}
	if req.TargetShortSide > 0 {
		ctrl.SetScreenshot(maa.WithScreenshotTargetShortSide(req.TargetShortSide))
	}
	if req.UseRawSize {
		ctrl.SetScreenshot(maa.WithScreenshotUseRawSize(true))
	}

	// 执行截图
	if !req.UseCache {
		job := ctrl.PostScreencap()
		if job == nil {
			return nil, NewMFWError(ErrCodeOperationFail, "failed to post screencap", nil)
		}
		job.Wait()
		if !job.Success() {
			return &ScreencapResult{
				ControllerID: req.ControllerID,
				Success:      false,
				Error:        "screencap job failed",
				Timestamp:    time.Now().Format(time.RFC3339),
			}, nil
		}
	}

	// 获取缓存图像
	img, imgErr := ctrl.CacheImage()
	info.LastActiveAt = time.Now()

	if imgErr != nil || img == nil {
		return &ScreencapResult{
			ControllerID: req.ControllerID,
			Success:      false,
			Error:        "no image captured",
			Timestamp:    time.Now().Format(time.RFC3339),
		}, nil
	}

	// 编码为 PNG 并转为 Base64
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return nil, NewMFWError(ErrCodeOperationFail, "failed to encode image", nil)
	}

	bounds := img.Bounds()
	result := &ScreencapResult{
		ControllerID: req.ControllerID,
		Success:      true,
		ImageData:    "data:image/png;base64," + base64.StdEncoding.EncodeToString(buf.Bytes()),
		Width:        bounds.Dx(),
		Height:       bounds.Dy(),
		Timestamp:    time.Now().Format(time.RFC3339),
	}

	return result, nil
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
	defer cm.mu.Unlock()

	now := time.Now()
	for id, info := range cm.controllers {
		if now.Sub(info.LastActiveAt) > timeout {
			// 销毁控制器实例
			if ctrl, ok := info.Controller.(*maa.Controller); ok && ctrl != nil {
				ctrl.Destroy()
			}
			delete(cm.controllers, id)
			logger.Debug("MFW", "清理非活跃控制器: %s", id)
		}
	}
}

// 断开所有控制器
func (cm *ControllerManager) DisconnectAll() {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	for id, info := range cm.controllers {
		// 销毁控制器实例
		if ctrl, ok := info.Controller.(*maa.Controller); ok && ctrl != nil {
			ctrl.Destroy()
		}
		logger.Debug("MFW", "断开控制器: %s", id)
	}

	// 清空控制器列表
	cm.controllers = make(map[string]*ControllerInfo)
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
