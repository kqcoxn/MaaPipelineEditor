package interfacerun

import (
	"context"
	"fmt"
	"time"

	maa "github.com/MaaXYZ/maa-framework-go/v4"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/eventbus"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/mfw"
	pi "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/service/projectinterface"
)

func (s *Service) execute(ctx context.Context, plans []*pi.RuntimePlan, release func(), done chan struct{}) {
	result := "completed"
	defer close(done)
	defer func() {
		if ctx.Err() != nil {
			result = "stopped"
		}
		release()
		s.update(func(state *State) {
			state.Status = result
			for i := range state.Items {
				if state.Items[i].Status == "pending" {
					state.Items[i].Status = "skipped"
				}
				if state.Items[i].Status == "running" {
					state.Items[i].Status = result
				}
			}
		})
	}()
	fail := func(err error) {
		if ctx.Err() != nil {
			result = "stopped"
		} else {
			result = "failed"
			s.update(func(state *State) { state.Error = err.Error() })
		}
	}
	if ctx.Err() != nil {
		fail(ctx.Err())
		return
	}
	// GUI execution does not collect debug recognition images or force every node's focus.
	// The shared execution lease keeps these process-wide options exclusive.
	if err := maa.SetDebugMode(false); err != nil {
		fail(err)
		return
	}
	defer func() { _ = maa.SetDebugMode(true); _ = maa.SetSaveDraw(true); _ = maa.SetSaveOnError(true) }()
	if err := maa.SetSaveDraw(false); err != nil {
		fail(err)
		return
	}
	if err := maa.SetSaveOnError(false); err != nil {
		fail(err)
		return
	}

	adapter := mfw.NewMaaFWAdapter()
	defer adapter.Destroy()
	info, err := s.mfw.ControllerManager().GetController(s.Snapshot().ControllerID)
	if err != nil {
		fail(err)
		return
	}
	controller, ok := info.Controller.(*maa.Controller)
	if !ok || controller == nil || !controller.Connected() {
		fail(fmt.Errorf("设备未连接"))
		return
	}
	resolution, err := mfw.ParseOptionalScreenshotResolution(plans[0].Controller)
	if err != nil {
		fail(err)
		return
	}
	if resolution == nil {
		value := mfw.DefaultScreenshotResolution()
		resolution = &value
	}
	if err = s.mfw.ControllerManager().SetScreenshotResolution(info.ControllerID, *resolution); err != nil {
		fail(err)
		return
	}

	adapter.SetController(controller, info.Type, info.UUID)
	if err := adapter.LoadResources(plans[0].ResourcePaths); err != nil {
		fail(err)
		return
	}
	if ctx.Err() != nil {
		fail(ctx.Err())
		return
	}
	supervisor := pi.NewSupervisor(eventbus.New())
	supervisor.SetOutputHandler(s.log)
	clients := []*maa.AgentClient{}
	// Tasker must be destroyed before clients and their resource.
	defer func() {
		adapter.DestroyTasker()
		for _, client := range clients {
			_ = client.Disconnect()
			client.Destroy()
		}
		supervisor.StopAll()
	}()
	for _, agent := range plans[0].Agents {
		if ctx.Err() != nil {
			fail(ctx.Err())
			return
		}
		if !agent.Enabled {
			continue
		}
		client, err := maa.NewAgentClient(maa.WithIdentifier(agent.Identifier))
		if err != nil {
			fail(err)
			return
		}
		clients = append(clients, client)
		identifier, err := client.Identifier()
		if err != nil {
			fail(err)
			return
		}
		if err = client.BindResource(adapter.GetResource()); err != nil {
			fail(err)
			return
		}
		if err = supervisor.Ensure(plans[0], agent, identifier, pi.RuntimeEnvironment(plans[0], s.version, maa.Version())); err != nil {
			fail(err)
			return
		}
		_ = client.SetTimeout(5 * time.Second)
		if err = client.Connect(); err != nil {
			fail(fmt.Errorf("Agent 连接失败: %w", err))
			return
		}
		if ctx.Err() != nil {
			fail(ctx.Err())
			return
		}
	}
	if ctx.Err() != nil {
		fail(ctx.Err())
		return
	}
	if err = adapter.InitTasker(); err != nil {
		fail(err)
		return
	}
	tasker := adapter.GetTasker()
	s.attachLogs(tasker)
	err = s.executeTasks(ctx, plans, func(plan *pi.RuntimePlan) (taskJob, error) {
		job, err := adapter.PostTask(plan.Entry, mergeOverrides(plan.PipelineOverrides))
		if job == nil {
			return nil, err
		}
		return job, err
	}, func() {
		waitForTaskerStop(func() taskJob {
			job := tasker.PostStop()
			if job == nil {
				return nil
			}
			return job
		}, tasker.Running)
	})
	if err != nil {
		fail(err)
		return
	}
}
func mergeOverrides(values []map[string]any) map[string]any {
	result := map[string]any{}
	for _, value := range values {
		name, _ := value["runtimeName"].(string)
		pipeline, _ := value["pipeline"].(map[string]any)
		if name != "" && pipeline != nil {
			mergeMap(result, map[string]any{name: pipeline})
		}
	}
	return result
}
func mergeMap(dst, src map[string]any) {
	for key, value := range src {
		if nested, ok := value.(map[string]any); ok {
			existing, _ := dst[key].(map[string]any)
			if existing == nil {
				existing = map[string]any{}
			}
			mergeMap(existing, nested)
			dst[key] = existing
		} else {
			dst[key] = value
		}
	}
}
