package interfacerun

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	pi "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/service/projectinterface"
)

type Preparation struct {
	ID          string    `json:"id"`
	Key         string    `json:"key"`
	CompletedAt time.Time `json:"completedAt"`
}

func preparationKey(plan *pi.RuntimePlan) string {
	raw, _ := json.Marshal([]any{plan.ProjectID, plan.Revision, plan.ControllerName, plan.ResourceName, plan.OptionValues["pretask"]})
	hash := sha256.Sum256(raw)
	return hex.EncodeToString(hash[:])
}
func (s *Service) Prepare(ctx context.Context, req pi.ContextRequest) (prepared *Preparation, failure error) {
	// Reserve execution before checking connections; preparing is also a native lifecycle operation.
	release, err := s.mfw.AcquireExecution("Interface 项目准备", "")
	if err != nil {
		return nil, err
	}
	defer release()
	snapshot, err := s.pi.Snapshot(req.Language)
	if err != nil {
		return nil, err
	}
	req.TaskName = ""
	req.Purpose = "interface"
	plan, err := snapshot.ResolveContext(req)
	if err != nil {
		return nil, err
	}
	if plan.ContextID == "" {
		return nil, fmt.Errorf("运行环境选项无效，请先修正配置")
	}
	if snapshot.HasPretasks(plan) && len(s.mfw.ControllerManager().ListControllers()) > 0 {
		return nil, fmt.Errorf("预任务必须在连接设备前执行，请先在设备配置中断开设备，再准备项目")
	}
	ctx, cancel := context.WithCancel(ctx)
	done := make(chan struct{})
	s.mu.Lock()
	s.cancel = cancel
	s.done = done
	s.preparation = nil
	s.state = State{RunID: uuid.NewString(), RequestID: req.RequestID, ProjectID: plan.ProjectID, Revision: plan.Revision, ControllerName: plan.ControllerName, ResourceName: plan.ResourceName, Status: "preparing", Items: []Item{}, Logs: []Log{}, StartedAt: time.Now().Format(time.RFC3339Nano)}
	s.mu.Unlock()
	defer func() {
		release()
		status := "idle"
		if ctx.Err() != nil {
			status = "stopped"
		} else if failure != nil {
			status = "failed"
		}
		if failure != nil {
			s.log("error", failure.Error())
		}
		s.update(func(state *State) { state.Status = status })
		cancel()
		close(done)
	}()
	s.log("info", "正在准备项目…")
	if err = snapshot.RunPretasks(ctx, plan, func(text string) { s.log("info", text) }); err != nil {
		return nil, err
	}
	if s.pi.Status().Revision != snapshot.Revision {
		return nil, fmt.Errorf("准备期间 PI 已更新，请重新准备项目")
	}
	preparation := &Preparation{ID: uuid.NewString(), Key: preparationKey(plan), CompletedAt: time.Now()}
	s.mu.Lock()
	s.preparation = preparation
	s.mu.Unlock()
	s.log("success", "项目准备完成，请连接设备后开始运行")
	return preparation, nil
}
func (s *Service) validatePreparation(plan *pi.RuntimePlan, createdAt time.Time, id string) error {
	snapshot, err := s.pi.Snapshot(plan.Language)
	if err != nil {
		return err
	}
	if !snapshot.HasPretasks(plan) {
		return nil
	}
	p := s.preparation
	if p == nil || p.ID != id || p.Key != preparationKey(plan) {
		return fmt.Errorf("请先准备项目，再连接设备并开始运行")
	}
	if !createdAt.After(p.CompletedAt) {
		return fmt.Errorf("设备在项目准备前已创建，请重新连接设备")
	}
	return nil
}
