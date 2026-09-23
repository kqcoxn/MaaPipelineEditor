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
		s.update(func(state *State) {
			if ctx.Err() == nil {
				state.Status = "running"
				state.Items[index].Status = "running"
			}
		})
		if ctx.Err() != nil {
			return ctx.Err()
		}
		job, err := post(plan)
		if err != nil {
			return err
		}
		if job == nil {
			return fmt.Errorf("提交任务失败")
		}
		ticker := time.NewTicker(80 * time.Millisecond)
		cancel := ctx.Done()
		stopped := false
		for status := job.Status(); !status.Done() && !status.Invalid(); status = job.Status() {
			select {
			case <-cancel:
				stop()
				stopped = true
				cancel = nil
			case <-ticker.C:
			}
		}
		ticker.Stop()
		if ctx.Err() != nil {
			if !stopped {
				stop()
			}
			return ctx.Err()
		}
		if !job.Success() {
			s.update(func(state *State) { state.Items[index].Status = "failed" })
			return fmt.Errorf("任务执行失败: %s", plan.TaskName)
		}
		s.update(func(state *State) { state.Items[index].Status = "completed" })
	}
	return nil
}
