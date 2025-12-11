package mfw

import (
	"sync"
	"time"

	maa "github.com/MaaXYZ/maa-framework-go/v3"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
)

// 任务管理器
type TaskManager struct {
	tasks map[int64]*TaskInfo
	mu    sync.RWMutex
}

// 创建任务管理器
func NewTaskManager() *TaskManager {
	return &TaskManager{
		tasks: make(map[int64]*TaskInfo),
	}
}

// 提交任务
func (tm *TaskManager) SubmitTask(controllerID, resourceID, entry string, override map[string]interface{}) (int64, error) {
	logger.Info("MFW", "提交任务: entry=%s, controller=%s, resource=%s", entry, controllerID, resourceID)

	// 创建 Tasker
	tasker := maa.NewTasker()
	if tasker == nil {
		return 0, NewMFWError(ErrCodeTaskSubmitFailed, "failed to create tasker", nil)
	}

	taskID := time.Now().UnixNano()

	info := &TaskInfo{
		TaskID:       taskID,
		ControllerID: controllerID,
		ResourceID:   resourceID,
		Tasker:       tasker,
		Entry:        entry,
		Override:     override,
		Status:       "Pending",
		SubmittedAt:  time.Now(),
	}

	tm.mu.Lock()
	tm.tasks[taskID] = info
	tm.mu.Unlock()

	logger.Info("MFW", "任务提交成功: %d", taskID)
	return taskID, nil
}

// 获取任务状态
func (tm *TaskManager) GetTaskStatus(taskID int64) (string, error) {
	tm.mu.RLock()
	defer tm.mu.RUnlock()

	info, exists := tm.tasks[taskID]
	if !exists {
		return "", ErrTaskNotFound
	}

	return info.Status, nil
}

// 停止任务
func (tm *TaskManager) StopTask(taskID int64) error {
	tm.mu.RLock()
	info, exists := tm.tasks[taskID]
	tm.mu.RUnlock()

	if !exists {
		return ErrTaskNotFound
	}

	// 调用 Tasker 的停止方法
	if tasker, ok := info.Tasker.(*maa.Tasker); ok && tasker != nil {
		job := tasker.PostStop()
		if job != nil {
			job.Wait()
		}
	}

	info.Status = "Stopped"

	logger.Info("MFW", "任务已停止: %d", taskID)
	return nil
}

// 停止所有任务
func (tm *TaskManager) StopAll() {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	for taskID, info := range tm.tasks {
		// 调用 Tasker 的停止方法
		if tasker, ok := info.Tasker.(*maa.Tasker); ok && tasker != nil {
			job := tasker.PostStop()
			if job != nil {
				job.Wait()
			}
			tasker.Destroy()
		}
		info.Status = "Stopped"
		logger.Info("MFW", "停止任务: %d", taskID)
	}

	// 清空任务列表
	tm.tasks = make(map[int64]*TaskInfo)
	logger.Info("MFW", "所有任务已停止")
}
