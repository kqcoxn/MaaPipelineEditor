package mfw

import (
	"fmt"
	"sync"
	"time"

	maa "github.com/MaaXYZ/maa-framework-go/v4"
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
	logger.Debug("MFW", "提交任务: entry=%s, controller=%s, resource=%s", entry, controllerID, resourceID)

	// 创建 Tasker
	tasker, err := maa.NewTasker()
	if err != nil {
		return 0, NewMFWError(ErrCodeTaskSubmitFailed, "failed to create tasker: "+err.Error(), nil)
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

	logger.Debug("MFW", "任务提交成功: %d", taskID)
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
		job, err := tasker.PostStop()
		if err != nil {
			return fmt.Errorf("提交停止任务失败: %w", err)
		}
		if !job.Wait().Success() {
			return fmt.Errorf("停止任务失败")
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
			job, err := tasker.PostStop()
			if err != nil {
				logger.Error("MFW", "提交停止任务失败: %v", err)
				continue
			}
			if !job.Wait().Success() {
				logger.Error("MFW", "停止任务失败: %d", taskID)
				continue
			}
			if err := tasker.Destroy(); err != nil {
				logger.Error("MFW", "释放任务失败: %v", err)
				continue
			}
		}
		delete(tm.tasks, taskID)
		info.Status = "Stopped"
		logger.Info("MFW", "停止任务: %d", taskID)
	}
}
