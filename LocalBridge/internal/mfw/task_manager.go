package mfw

import (
	"sync"
	"time"

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

	// TODO: 实际实现
	// tasker := maa.NewTasker()
	// tasker.BindController(controller)
	// tasker.BindResource(resource)
	// taskJob := tasker.PostTask(entry, override)
	// taskID := taskJob.ID

	taskID := time.Now().UnixNano() // 临时使用时间戳作为ID

	info := &TaskInfo{
		TaskID:       taskID,
		ControllerID: controllerID,
		ResourceID:   resourceID,
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

	// TODO: 实际查询taskJob.Status()

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

	// TODO: 调用tasker.PostStop()

	info.Status = "Stopped"

	logger.Info("MFW", "任务已停止: %d", taskID)
	return nil
}
