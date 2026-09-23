package interfacerun

import maa "github.com/MaaXYZ/maa-framework-go/v4"

func (s *Service) attachLogs(tasker *maa.Tasker) {
	tasker.OnNodePipelineNodeInContext(func(_ *maa.Context, status maa.EventStatus, detail maa.NodePipelineNodeDetail) {
		s.focus("Node.PipelineNode", status, detail.Focus)
	})
	tasker.OnNodeRecognitionNodeInContext(func(_ *maa.Context, status maa.EventStatus, detail maa.NodeRecognitionNodeDetail) {
		s.focus("Node.RecognitionNode", status, detail.Focus)
	})
	tasker.OnNodeActionNodeInContext(func(_ *maa.Context, status maa.EventStatus, detail maa.NodeActionNodeDetail) {
		s.focus("Node.ActionNode", status, detail.Focus)
	})
	tasker.OnNodeNextListInContext(func(_ *maa.Context, status maa.EventStatus, detail maa.NodeNextListDetail) {
		s.focus("Node.NextList", status, detail.Focus)
	})
	tasker.OnNodeActionInContext(func(_ *maa.Context, status maa.EventStatus, detail maa.NodeActionDetail) {
		s.focus("Node.Action", status, detail.Focus)
	})
	tasker.OnNodeRecognitionInContext(func(_ *maa.Context, status maa.EventStatus, detail maa.NodeRecognitionDetail) {
		s.focus("Node.Recognition", status, detail.Focus)
	})
}
func (s *Service) focus(kind string, status maa.EventStatus, focus any) {
	suffix := map[maa.EventStatus]string{maa.EventStatusStarting: "Starting", maa.EventStatusSucceeded: "Succeeded", maa.EventStatusFailed: "Failed"}[status]
	if suffix == "" {
		return
	}
	values, ok := focus.(map[string]any)
	if !ok {
		return
	}
	value := values[kind+"."+suffix]
	if object, ok := value.(map[string]any); ok {
		value = object["content"]
	}
	if text, ok := value.(string); ok && text != "" {
		s.log(text)
	}
}
