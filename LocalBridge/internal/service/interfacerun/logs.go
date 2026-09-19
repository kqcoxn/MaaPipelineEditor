package interfacerun

import (
	"strings"
	"sync"

	maa "github.com/MaaXYZ/maa-framework-go/v4"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/eventbus"
	pi "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/service/projectinterface"
)

// GUI owns its Agent output stream; no events enter the debug context service.
func (s *Service) agentBus() *eventbus.EventBus {
	bus := eventbus.New()
	var mu sync.Mutex
	previous := map[string][]string{}
	bus.Subscribe(eventbus.EventProjectInterfaceAgent, func(event eventbus.Event) {
		status, ok := event.Data.(pi.AgentProcessStatus)
		if !ok {
			return
		}
		mu.Lock()
		defer mu.Unlock()
		old := previous[status.AgentID]
		overlap := 0
		for n := len(old); n > 0; n-- {
			if n <= len(status.Output) && sameLines(old[len(old)-n:], status.Output[:n]) {
				overlap = n
				break
			}
		}
		lines := []string{}
		for _, line := range status.Output[overlap:] {
			lines = append(lines, status.AgentID+" · "+line)
		}
		if len(lines) > 0 {
			s.appendLogs("info", lines)
		}
		previous[status.AgentID] = status.Output
		if status.State == "failed" || (status.ExitCode != nil && *status.ExitCode != 0) {
			s.log("error", "Agent "+status.AgentID+" · "+status.Message)
		}
	})
	return bus
}
func sameLines(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
func (s *Service) attachLogs(tasker *maa.Tasker) {
	tasker.OnNodePipelineNodeInContext(func(_ *maa.Context, status maa.EventStatus, detail maa.NodePipelineNodeDetail) {
		if status == maa.EventStatusStarting {
			s.log("info", "执行节点 · "+detail.Name)
		}
		s.focus("Node.PipelineNode", status, detail.Name, detail.Focus)
	})
	tasker.OnNodeActionInContext(func(_ *maa.Context, status maa.EventStatus, detail maa.NodeActionDetail) {
		s.focus("Node.Action", status, detail.Name, detail.Focus)
	})
	tasker.OnNodeRecognitionInContext(func(_ *maa.Context, status maa.EventStatus, detail maa.NodeRecognitionDetail) {
		s.focus("Node.Recognition", status, detail.Name, detail.Focus)
	})
}
func (s *Service) focus(kind string, status maa.EventStatus, name string, focus any) {
	suffix := map[maa.EventStatus]string{maa.EventStatusStarting: "Starting", maa.EventStatusSucceeded: "Succeeded", maa.EventStatusFailed: "Failed"}[status]
	values, ok := focus.(map[string]any)
	if !ok {
		return
	}
	value := values[kind+"."+suffix]
	if object, ok := value.(map[string]any); ok {
		value = object["content"]
	}
	if text, ok := value.(string); ok && text != "" {
		s.log("info", strings.ReplaceAll(text, "{name}", name))
	}
}
