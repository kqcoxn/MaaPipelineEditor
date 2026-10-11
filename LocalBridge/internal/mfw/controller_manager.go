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
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/adbprocess"
	mpeconfig "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/config"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
)

// 控制器管理器
type ControllerManager struct {
	reserved    map[string]bool
	controllers map[string]*ControllerInfo
	mu          sync.RWMutex
}

// 创建控制器管理器
func NewControllerManager() *ControllerManager {
	return &ControllerManager{
		reserved:    make(map[string]bool),
		controllers: make(map[string]*ControllerInfo),
	}
}

// 创建ADB控制器
func (cm *ControllerManager) CreateAdbController(adbPath, address string, screencapMethod, inputMethod []string, config string) (string, error) {
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

	agentPath := (&mpeconfig.Config{}).ResolvedMaaFWAgentDir()
	warning := ""
	if strings.TrimSpace(agentPath) == "" {
		warning = "自带 MaaAgentBinary 缺失，MaaTouch/Minitouch 不可用，请运行 mpelb deps reinstall mfw 修复"
		if requiresAdbAgent(inputMethod) && !hasAgentlessAdbFallback(inputMethod) {
			return "", NewMFWError(ErrCodeControllerCreateFail, warning, nil)
		}
		logger.Warn("MFW", "%s；候选输入方式: %v", warning, inputMethod)
	} else {
		logger.Info("MFW", "使用 MaaAgentBinary: %s", agentPath)
	}
	logger.Info("MFW", "ADB 输入方式候选: %v", inputMethod)

	// 创建 ADB 控制器
	releaseADB := adbprocess.Acquire(adbPath)
	ctrl, err := maa.NewAdbController(adbPath, address, scMethod, inMethod, config, agentPath)
	if err != nil {
		releaseADB()
		return "", NewMFWError(ErrCodeControllerCreateFail, "failed to create adb controller: "+err.Error(), nil)
	}

	info := &ControllerInfo{
		releaseADB:   releaseADB,
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
func (cm *ControllerManager) CreateWin32Controller(hwnd, screencapMethod, inputMethod, keyboardInputMethod string) (string, error) {
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
	keyboardMethod, err := parseWin32KeyboardMethod(keyboardInputMethod)
	if err != nil {
		return "", err
	}
	ctrl, err := maa.NewWin32Controller(hwndPtr, scMethod, mouseMethod, keyboardMethod)
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

// 创建 Linux 控制器
func (cm *ControllerManager) CreateLinuxController(options LinuxControllerOptions) (string, error) {
	config, err := options.NativeConfig()
	if err != nil {
		return "", err
	}

	controllerID := uuid.New().String()

	// 创建 Linux 控制器
	ctrl, err := maa.NewLinuxController(config)
	if err != nil {
		return "", NewMFWError(ErrCodeControllerCreateFail, "failed to create linux controller: "+err.Error(), nil)
	}

	info := &ControllerInfo{
		ControllerID: controllerID,
		Type:         "Linux",
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
	stale := make([]string, 0)
	for id, info := range cm.controllers {
		if !cm.reserved[id] && now.Sub(info.LastActiveAt) > timeout {
			stale = append(stale, id)
			logger.Debug("MFW", "清理非活跃控制器: %s", id)
		}
	}
	cm.mu.Unlock()

	for _, id := range stale {
		_ = cm.DisconnectController(id)
	}
}

// 断开所有控制器
func (cm *ControllerManager) DisconnectAll() {
	cm.mu.Lock()
	controllers := make([]string, 0, len(cm.controllers))
	for id := range cm.controllers {
		controllers = append(controllers, id)
	}
	cm.mu.Unlock()

	for _, id := range controllers {
		if err := cm.DisconnectController(id); err != nil {
			logger.Warn("MFW", "断开控制器 %s 失败: %v", id, err)
		}
	}

	logger.Debug("MFW", "控制器清理完成")
}
