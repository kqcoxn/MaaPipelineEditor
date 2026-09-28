package runtime

import (
	"fmt"
	"time"

	maa "github.com/MaaXYZ/maa-framework-go/v4"
)

func (r *Runtime) Stop() error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.adapter == nil || r.stopJob != nil {
		return nil
	}
	job, err := r.adapter.RequestStop()
	if err == nil {
		r.stopJob = job
	}
	return err
}

func (r *Runtime) Wait() Result {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.waitUntilIdleLocked()
	if r.taskJob == nil {
		return Result{Status: "invalid", Err: fmt.Errorf("任务尚未提交或 runtime 已释放")}
	}
	status := r.taskJob.Status()
	return Result{
		Status: status.String(),
		OK:     status.Success() && r.taskJob.Error() == nil,
		Err:    r.taskJob.Error(),
	}
}

// 调用和返回时均持有 r.mu；等待期间释放锁，允许 Stop 及时提交请求。
// PostStop 会清空原任务的完成状态，使其 Wait 提前返回，此时原生回调仍可运行。
// 必须同时确认停止任务完成和 Tasker 空闲，才能移除回调、销毁对象或归还执行权。
func (r *Runtime) waitUntilIdleLocked() {
	for r.adapter != nil {
		tasker := r.adapter.GetTasker()
		if nativeJobFinished(r.taskJob) && nativeJobFinished(r.stopJob) && (tasker == nil || !tasker.Running()) {
			return
		}
		r.mu.Unlock()
		time.Sleep(20 * time.Millisecond)
		r.mu.Lock()
	}
}

func nativeJobFinished(job *maa.TaskJob) bool {
	if job == nil {
		return true
	}
	status := job.Status()
	return status.Done() || status.Invalid()
}

func (r *Runtime) Destroy() {
	r.mu.Lock()
	defer r.mu.Unlock()

	// 销毁也执行同一检查，覆盖启动失败回收，以及 Wait 返回后才收到 Stop 的竞态。
	r.waitUntilIdleLocked()
	if r.adapter == nil {
		return
	}
	if r.contextSinkID > 0 {
		r.adapter.RemoveContextSink(r.contextSinkID)
	}
	if r.taskerSinkID > 0 {
		r.adapter.RemoveTaskerSink(r.taskerSinkID)
	}
	r.adapter.Destroy()
	r.adapter = nil
	r.taskJob = nil
	r.stopJob = nil
	// Pool 拥有 Agent 连接及借用 Resource 的生命周期，单次运行结束时不释放它们。
	r.agentClients = nil
}
