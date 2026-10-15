package mfw

import (
	"errors"
	"fmt"
	"time"

	maa "github.com/MaaXYZ/maa-framework-go/v4"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
)

// DestroyController 等待拥有的控制器完成原生调用后释放。
// 必须从回调外调用，并先销毁绑定它的 Tasker / Agent；绑定和借用错误直接返回。
// PostStop 会使动作 ID 失效，Binding 的 Destroy 此时提交 Inactive 屏障，
// 首次可返回 ErrInUse，需重试直到屏障和回调结束，才能回收 ADB 等外部资源。
func DestroyController(ctrl *maa.Controller) error {
	if ctrl == nil {
		return nil
	}
	for {
		err := ctrl.Destroy()
		if !errors.Is(err, maa.ErrInUse) && !errors.Is(err, maa.ErrInCallback) {
			return err
		}
		time.Sleep(25 * time.Millisecond)
	}
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
	job, postErr := ctrl.PostConnect()
	if postErr != nil {
		cm.removeController(controllerID, info)
		return NewMFWError(ErrCodeControllerConnectFail, "failed to post connect", map[string]interface{}{"reason": postErr.Error()})
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

func destroyController(info *ControllerInfo) error {
	if info == nil {
		return nil
	}
	info.lifecycleMu.Lock()
	defer info.lifecycleMu.Unlock()
	if ctrl, ok := info.Controller.(*maa.Controller); ok && ctrl != nil {
		err := DestroyController(ctrl)
		if err != nil {
			logger.Warn("MFW", "销毁控制器失败: %v", err)
		} else if info.releaseADB != nil {
			info.releaseADB()
			info.releaseADB = nil
		}
		return err
	}
	return nil
}

// 断开控制器
func (cm *ControllerManager) DisconnectController(controllerID string) error {
	cm.mu.Lock()
	if cm.reserved[controllerID] {
		cm.mu.Unlock()
		return fmt.Errorf("设备正在运行，请先停止任务")
	}
	info, exists := cm.controllers[controllerID]
	if !exists {
		cm.mu.Unlock()
		return ErrControllerNotFound
	}
	delete(cm.controllers, controllerID)
	cm.mu.Unlock()

	// 等待正在进行的连接或操作结束后再销毁底层实例。
	started := time.Now()
	logger.Info("MFW", "正在断开控制器，等待进行中的操作结束: %s", controllerID)
	if err := destroyController(info); err != nil {
		cm.mu.Lock()
		cm.controllers[controllerID] = info
		cm.mu.Unlock()
		return fmt.Errorf("断开控制器失败: %w", err)
	}

	logger.Info("MFW", "控制器已断开: %s，耗时 %s", controllerID, time.Since(started).Round(time.Millisecond))
	return nil
}
