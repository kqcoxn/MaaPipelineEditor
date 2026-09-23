package interfacerun

import (
	"testing"

	maa "github.com/MaaXYZ/maa-framework-go/v4"
)

func TestFocusOutputsOnlyMatchingContentAsPlainText(t *testing.T) {
	for _, kind := range []string{"Node.PipelineNode", "Node.RecognitionNode", "Node.ActionNode", "Node.NextList", "Node.Recognition", "Node.Action"} {
		for status, suffix := range map[maa.EventStatus]string{maa.EventStatusStarting: "Starting", maa.EventStatusSucceeded: "Succeeded", maa.EventStatusFailed: "Failed"} {
			t.Run(kind+"."+suffix, func(t *testing.T) {
				s, _ := queueFixture()
				text := "  **原始内容** <b>{name}</b>\n$国际化 https://example.com/{image}  "
				for _, value := range []any{text, map[string]any{"content": text, "display": "modal", "trace": true}} {
					s.focus(kind, status, map[string]any{kind + "." + suffix: value, "unrelated": "不可显示"})
				}
				logs := s.Snapshot().Logs
				if len(logs) != 2 || logs[0].Message != text || logs[1].Message != text {
					t.Fatalf("focus content was lost or formatted: %#v", logs)
				}
			})
		}
	}
}

func TestFocusWithoutDisplayContentProducesNoLog(t *testing.T) {
	s, _ := queueFixture()
	for _, value := range []any{nil, false, true, "", map[string]any{}, map[string]any{"trace": true}, map[string]any{"content": 42}} {
		s.focus("Node.Action", maa.EventStatusStarting, value)
		s.focus("Node.Action", maa.EventStatusStarting, map[string]any{"Node.Action.Starting": value})
	}
	s.focus("Node.Action", maa.EventStatusSucceeded, map[string]any{"Node.Action.Starting": "不匹配"})
	if len(s.Snapshot().Logs) != 0 {
		t.Fatal("callbacks without matching text must stay silent")
	}
}
