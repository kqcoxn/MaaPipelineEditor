package interfacerun

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/eventbus"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/mfw"
	pi "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/service/projectinterface"
)

type Service struct {
	mu          sync.Mutex
	pi          *pi.Service
	mfw         *mfw.Service
	bus         *eventbus.EventBus
	version     string
	state       State
	cancel      context.CancelFunc
	done        chan struct{}
	preparation *Preparation
}

func New(project *pi.Service, framework *mfw.Service, bus *eventbus.EventBus, version string) *Service {
	return &Service{pi: project, mfw: framework, bus: bus, version: version, state: State{Status: "idle", Items: []Item{}, Logs: []Log{}}}
}
func (s *Service) Snapshot() State { s.mu.Lock(); defer s.mu.Unlock(); return s.snapshotLocked() }
func (s *Service) snapshotLocked() State {
	v := s.state
	v.Items = append([]Item{}, v.Items...)
	v.Logs = append([]Log{}, v.Logs...)
	return v
}
func (s *Service) update(change func(*State)) {
	s.mu.Lock()
	change(&s.state)
	s.state.Sequence++
	state := s.snapshotLocked()
	s.mu.Unlock()
	s.bus.Publish(EventState, state)
}
func (s *Service) log(text string) {
	s.update(func(state *State) {
		if len(text) > 8000 {
			text = text[:8000] + "…"
		}
		state.Logs = append(state.Logs, Log{Sequence: state.Sequence + 1, Time: time.Now().Format(time.RFC3339Nano), Message: text})
		if len(state.Logs) > 500 {
			state.Logs = state.Logs[len(state.Logs)-500:]
		}
	})
}
func (s *Service) Start(req Request) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if Active(s.state.Status) {
		return fmt.Errorf("Interface 已有运行中的任务")
	}
	plans, items, err := s.resolve(req)
	if err != nil {
		return err
	}
	info, err := s.mfw.ControllerManager().GetController(req.ControllerID)
	if err != nil {
		return fmt.Errorf("请先连接设备: %w", err)
	}
	if !strings.EqualFold(info.Type, fmt.Sprint(plans[0].Controller["type"])) {
		return fmt.Errorf("设备类型与 PI 控制器不匹配，请重新选择并连接设备")
	}
	if err = s.validatePreparation(plans[0], info.CreatedAt, req.PreparationID); err != nil {
		return err
	}
	release, err := s.mfw.AcquireExecution("Interface", req.ControllerID)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithCancel(context.Background())
	s.cancel = cancel
	s.done = make(chan struct{})
	s.state = State{RunID: uuid.NewString(), RequestID: req.RequestID, ProjectID: req.ProjectID, Revision: plans[0].Revision, ControllerName: plans[0].ControllerName, ResourceName: plans[0].ResourceName, ControllerID: req.ControllerID, Status: "preparing", Items: items, Logs: []Log{}, StartedAt: time.Now().Format(time.RFC3339Nano)}
	// Plans are private immutable copies. PI refresh and browsing cannot release them.
	go s.execute(ctx, plans, release, s.done)
	return nil
}
func (s *Service) resolve(req Request) ([]*pi.RuntimePlan, []Item, error) {
	if req.RequestID == "" || req.ProjectID == "" || len(req.Tasks) == 0 {
		return nil, nil, fmt.Errorf("请选择至少一个任务")
	}
	snapshot, err := s.pi.Snapshot(req.Tasks[0].Language)
	if err != nil {
		return nil, nil, err
	}
	return resolveSnapshot(snapshot, req)
}
func resolveSnapshot(snapshot *pi.ProjectSnapshot, req Request) ([]*pi.RuntimePlan, []Item, error) {
	if len(req.Tasks) == 0 {
		return nil, nil, fmt.Errorf("请选择至少一个任务")
	}
	if snapshot.ProjectID != req.ProjectID {
		return nil, nil, fmt.Errorf("项目已变化，请重新运行")
	}
	seen := map[string]bool{}
	plans := []*pi.RuntimePlan{}
	items := []Item{}
	for _, task := range req.Tasks {
		if task.Revision != snapshot.Revision || task.TaskName == "" || seen[task.TaskName] {
			return nil, nil, fmt.Errorf("任务版本失效或任务重复，请刷新后重试")
		}
		seen[task.TaskName] = true
		task.Purpose = "interface"
		plan, err := snapshot.ResolveContext(task)
		if err != nil {
			return nil, nil, err
		}
		if plan.ContextID == "" {
			for _, d := range plan.Diagnostics {
				if d.Severity == "error" {
					return nil, nil, fmt.Errorf("%s: %s", task.TaskName, d.Message)
				}
			}
			return nil, nil, fmt.Errorf("任务配置无效")
		}
		if len(plans) > 0 && (plan.ControllerName != plans[0].ControllerName || plan.ResourceName != plans[0].ResourceName) {
			return nil, nil, fmt.Errorf("任务必须使用相同运行环境")
		}
		label := task.TaskName
		if tasks, ok := snapshot.Document["task"].([]any); ok {
			for _, raw := range tasks {
				if item, ok := raw.(map[string]any); ok && item["name"] == task.TaskName {
					if text, ok := item["label"].(string); ok {
						label = text
					}
				}
			}
		}
		plans = append(plans, plan)
		items = append(items, Item{Name: task.TaskName, Label: label, Entry: plan.Entry, Status: "pending"})
	}
	return plans, items, nil
}
func (s *Service) Stop(runID string) error {
	s.mu.Lock()
	if runID != s.state.RunID {
		s.mu.Unlock()
		return fmt.Errorf("运行标识已变化")
	}
	if !Active(s.state.Status) || s.state.Status == "stopping" {
		s.mu.Unlock()
		return nil
	}
	s.cancel()
	s.state.Status = "stopping"
	s.state.Sequence++
	state := s.snapshotLocked()
	s.mu.Unlock()
	s.bus.Publish(EventState, state)
	return nil
}
func (s *Service) Close() {
	s.mu.Lock()
	cancel, done := s.cancel, s.done
	s.mu.Unlock()
	if cancel != nil {
		cancel()
	}
	if done != nil {
		<-done
	}
}
