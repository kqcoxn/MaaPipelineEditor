package mfw

import (
	"strings"
	"time"

	maa "github.com/MaaXYZ/maa-framework-go/v4"
)

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
	job, postErr := ctrl.PostClick(x, y)
	if postErr != nil {
		return nil, NewMFWError(ErrCodeOperationFail, "failed to post click", map[string]interface{}{"reason": postErr.Error()})
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
	job, postErr := ctrl.PostSwipe(x1, y1, x2, y2, time.Duration(duration)*time.Millisecond)
	if postErr != nil {
		return nil, NewMFWError(ErrCodeOperationFail, "failed to post swipe", map[string]interface{}{"reason": postErr.Error()})
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
	job, postErr := ctrl.PostInputText(text)
	if postErr != nil {
		return nil, NewMFWError(ErrCodeOperationFail, "failed to post input text", map[string]interface{}{"reason": postErr.Error()})
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
	job, postErr := ctrl.PostStartApp(intent)
	if postErr != nil {
		return nil, NewMFWError(ErrCodeOperationFail, "failed to post start app", map[string]interface{}{"reason": postErr.Error()})
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
	job, postErr := ctrl.PostStopApp(intent)
	if postErr != nil {
		return nil, NewMFWError(ErrCodeOperationFail, "failed to post stop app", map[string]interface{}{"reason": postErr.Error()})
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
	job, postErr := ctrl.PostClickKey(keycode)
	if postErr != nil {
		return nil, NewMFWError(ErrCodeOperationFail, "failed to post click key", map[string]interface{}{"reason": postErr.Error()})
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
	var postErr error
	var op ControllerOperation

	// 根据动作类型执行不同操作
	switch strings.ToLower(action) {
	case "down":
		job, postErr = ctrl.PostTouchDown(contact, x, y, pressure)
		op = OpTouchDown
	case "move":
		job, postErr = ctrl.PostTouchMove(contact, x, y, pressure)
		op = OpTouchMove
	case "up":
		job, postErr = ctrl.PostTouchUp(contact)
		op = OpTouchUp
	default:
		return nil, NewMFWError(ErrCodeOperationFail, "invalid touch action: "+action, nil)
	}

	if postErr != nil {
		return nil, NewMFWError(ErrCodeOperationFail, "failed to post touch action", map[string]interface{}{"reason": postErr.Error()})
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
	job, postErr := ctrl.PostScroll(dx, dy)
	if postErr != nil {
		return nil, NewMFWError(ErrCodeOperationFail, "failed to post scroll", map[string]interface{}{"reason": postErr.Error()})
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
	job, postErr := ctrl.PostKeyDown(keycode)
	if postErr != nil {
		return nil, NewMFWError(ErrCodeOperationFail, "failed to post key down", map[string]interface{}{"reason": postErr.Error()})
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
	job, postErr := ctrl.PostKeyUp(keycode)
	if postErr != nil {
		return nil, NewMFWError(ErrCodeOperationFail, "failed to post key up", map[string]interface{}{"reason": postErr.Error()})
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
	job, postErr := ctrl.PostClickV2(x, y, contact, pressure)
	if postErr != nil {
		return nil, NewMFWError(ErrCodeOperationFail, "failed to post click v2", map[string]interface{}{"reason": postErr.Error()})
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
	job, postErr := ctrl.PostSwipeV2(x1, y1, x2, y2, time.Duration(duration)*time.Millisecond, contact, pressure)
	if postErr != nil {
		return nil, NewMFWError(ErrCodeOperationFail, "failed to post swipe v2", map[string]interface{}{"reason": postErr.Error()})
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
	job, postErr := ctrl.PostShell(cmd, timeout)
	if postErr != nil {
		return nil, NewMFWError(ErrCodeOperationFail, "failed to post shell (only ADB controller supported)", map[string]interface{}{"reason": postErr.Error()})
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
	job, postErr := ctrl.PostInactive()
	if postErr != nil {
		return nil, NewMFWError(ErrCodeOperationFail, "failed to post inactive", map[string]interface{}{"reason": postErr.Error()})
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
