package interfacerun

import (
	"context"
	"fmt"
	maa "github.com/MaaXYZ/maa-framework-go/v4"
	pi "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/service/projectinterface"
	"time"
)

type taskJob interface {
	Status() maa.Status
	Success() bool
}

func (s *Service) executeTasks(ctx context.Context, plans []*pi.RuntimePlan, post func(*pi.RuntimePlan) (taskJob, error), stop func()) error {
	for index, plan := range plans {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		s.update(func(state *State) { state.Status = "running"; state.Items[index].Status = "running" })
		s.log("info", fmt.Sprintf("开始任务 %d/%d · %s", index+1, len(plans), s.Snapshot().Items[index].Label))
		job, err := post(plan)
		if err != nil {
			return err
		}
		if job == nil {
			return fmt.Errorf("提交任务失败")
		}
		ticker := time.NewTicker(80 * time.Millisecond)
		cancel := ctx.Done()
		for status := job.Status(); !status.Done() && !status.Invalid(); status = job.Status() {
			select {
			case <-cancel:
				stop()
				cancel = nil
			case <-ticker.C:
			}
		}
		ticker.Stop()
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if !job.Success() {
			s.update(func(state *State) { state.Items[index].Status = "failed" })
			return fmt.Errorf("任务执行失败: %s", plan.TaskName)
		}
		s.update(func(state *State) { state.Items[index].Status = "completed" })
		s.log("success", "任务完成 · "+s.Snapshot().Items[index].Label)
	}
	return nil
}
