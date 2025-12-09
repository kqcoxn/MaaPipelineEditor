package mfw

import (
	"bytes"
	"encoding/base64"
	"image/png"
	"sync"
	"time"

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
	logger.Info("MFW", "创建 ADB 控制器: %s @ %s", adbPath, address)

	controllerID := uuid.New().String()

	// TODO: 实际调用maa.NewAdbController
	// ctrl := maa.NewAdbController(adbPath, address, ...)
	// if ctrl == nil {
	//     return "", NewMFWError(ErrCodeControllerCreateFail, "failed to create adb controller", nil)
	// }

	info := &ControllerInfo{
		ControllerID: controllerID,
		Type:         "ADB",
		Connected:    false,
		CreatedAt:    time.Now(),
		LastActiveAt: time.Now(),
	}

	cm.mu.Lock()
	cm.controllers[controllerID] = info
	cm.mu.Unlock()

	logger.Info("MFW", "控制器创建成功: %s", controllerID)
	return controllerID, nil
}

// 创建Win32控制器
func (cm *ControllerManager) CreateWin32Controller(hwnd, screencapMethod, inputMethod string) (string, error) {
	logger.Info("MFW", "创建 Win32 控制器: %s", hwnd)

	controllerID := uuid.New().String()

	// TODO: 实际调用maa.NewWin32Controller

	info := &ControllerInfo{
		ControllerID: controllerID,
		Type:         "Win32",
		Connected:    false,
		CreatedAt:    time.Now(),
		LastActiveAt: time.Now(),
	}

	cm.mu.Lock()
	cm.controllers[controllerID] = info
	cm.mu.Unlock()

	logger.Info("MFW", "控制器创建成功: %s", controllerID)
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

	// TODO: 实际调用controller.PostConnect().Wait()
	
	info.Connected = true
	info.LastActiveAt = time.Now()

	logger.Info("MFW", "控制器已连接: %s", controllerID)
	return nil
}

// 断开控制器
func (cm *ControllerManager) DisconnectController(controllerID string) error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	_, exists := cm.controllers[controllerID]
	if !exists {
		return ErrControllerNotFound
	}

	// TODO: 实际调用controller.Destroy()

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

	// TODO: 实际调用controller.PostClick(x, y).Wait()

	info.LastActiveAt = time.Now()

	return &ControllerOperationResult{
		ControllerID: controllerID,
		Operation:    OpClick,
		Success:      true,
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

	// TODO: 实际调用controller.PostSwipe(x1, y1, x2, y2, duration).Wait()

	info.LastActiveAt = time.Now()

	return &ControllerOperationResult{
		ControllerID: controllerID,
		Operation:    OpSwipe,
		Success:      true,
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

	// TODO: 实际调用controller.PostInputText(text).Wait()

	info.LastActiveAt = time.Now()

	return &ControllerOperationResult{
		ControllerID: controllerID,
		Operation:    OpInputText,
		Success:      true,
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

	// TODO: 实际调用controller.PostStartApp(intent).Wait()

	info.LastActiveAt = time.Now()

	return &ControllerOperationResult{
		ControllerID: controllerID,
		Operation:    OpStartApp,
		Success:      true,
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

	// TODO: 实际调用controller.PostStopApp(intent).Wait()

	info.LastActiveAt = time.Now()

	return &ControllerOperationResult{
		ControllerID: controllerID,
		Operation:    OpStopApp,
		Success:      true,
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

	// TODO: 实际实现
	// if !req.UseCache {
	//     if req.TargetLongSide > 0 {
	//         controller.SetScreenshotTargetLongSide(req.TargetLongSide)
	//     }
	//     controller.PostScreencap().Wait()
	// }
	// img := controller.CacheImage()
	// 编码为PNG并转Base64

	info.LastActiveAt = time.Now()

	// 临时返回空图像数据
	emptyImg := make([]byte, 1)
	var buf bytes.Buffer
	_ = png.Encode(&buf, nil)
	
	result := &ScreencapResult{
		ControllerID: req.ControllerID,
		Success:      true,
		ImageData:    base64.StdEncoding.EncodeToString(buf.Bytes()),
		Width:        0,
		Height:       0,
		Timestamp:    time.Now().Format(time.RFC3339),
	}

	_ = emptyImg // 避免未使用变量警告

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
			// TODO: 调用Destroy释放资源
			delete(cm.controllers, id)
			logger.Info("MFW", "清理非活跃控制器: %s", id)
		}
	}
}
