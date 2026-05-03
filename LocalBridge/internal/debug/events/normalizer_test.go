package events

import (
	"testing"

	maa "github.com/MaaXYZ/maa-framework-go/v4"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/protocol"
)

func TestNormalizerMarksInitialBootstrapAsTasker(t *testing.T) {
	normalizer, emitted := newTestNormalizer()

	normalizer.OnTaskerTask(nil, maa.EventStatusStarting, maa.TaskerTaskDetail{
		TaskID: 1,
		Entry:  "A",
	})
	normalizer.OnNodePipelineNode(nil, maa.EventStatusStarting, maa.NodePipelineNodeDetail{
		TaskID: 1,
		Name:   "",
	})
	normalizer.OnNodeNextList(nil, maa.EventStatusSucceeded, maa.NodeNextListDetail{
		TaskID: 1,
		Name:   "",
		List: []maa.NextItem{
			{Name: "A"},
		},
	})
	normalizer.OnNodeRecognition(nil, maa.EventStatusSucceeded, maa.NodeRecognitionDetail{
		TaskID:        1,
		RecognitionID: 10,
		Name:          "A",
	})

	events := *emitted
	pipeline := events[1]
	if pipeline.Node == nil {
		t.Fatal("expected bootstrap pipeline node metadata")
	}
	if pipeline.Node.RuntimeName != protocol.TaskerBootstrapRuntimeName {
		t.Fatalf("unexpected bootstrap runtime name: %q", pipeline.Node.RuntimeName)
	}
	if pipeline.Node.Label != protocol.TaskerBootstrapLabel {
		t.Fatalf("unexpected bootstrap label: %q", pipeline.Node.Label)
	}
	if pipeline.Node.SyntheticKind != protocol.SyntheticNodeKindTaskerBootstrap {
		t.Fatalf("unexpected bootstrap synthetic kind: %q", pipeline.Node.SyntheticKind)
	}
	if pipeline.Node.FileID != "" || pipeline.Node.NodeID != "" {
		t.Fatalf("bootstrap node must not carry MPE mapping: %#v", pipeline.Node)
	}

	nextList := events[2]
	if nextList.Node == nil || nextList.Node.SyntheticKind != protocol.SyntheticNodeKindTaskerBootstrap {
		t.Fatalf("expected bootstrap next-list owner, got %#v", nextList.Node)
	}

	recognition := events[3]
	if recognition.Node == nil || recognition.Node.RuntimeName != "A" {
		t.Fatalf("recognition should preserve target node A, got %#v", recognition.Node)
	}
	if recognition.Node.NodeID != "node-a" {
		t.Fatalf("recognition target should stay mapped to node-a, got %#v", recognition.Node)
	}
	if recognition.Data["parentNode"] != protocol.TaskerBootstrapRuntimeName {
		t.Fatalf("recognition parent should be bootstrap, got %#v", recognition.Data["parentNode"])
	}
}

func TestNormalizerDoesNotMarkMappedFirstPipelineNodeAsBootstrap(t *testing.T) {
	normalizer, emitted := newTestNormalizer()

	normalizer.OnTaskerTask(nil, maa.EventStatusStarting, maa.TaskerTaskDetail{
		TaskID: 1,
		Entry:  "A",
	})
	normalizer.OnNodePipelineNode(nil, maa.EventStatusStarting, maa.NodePipelineNodeDetail{
		TaskID: 1,
		Name:   "A",
	})
	normalizer.OnNodeRecognition(nil, maa.EventStatusSucceeded, maa.NodeRecognitionDetail{
		TaskID:        1,
		RecognitionID: 10,
		Name:          "A",
	})

	events := *emitted
	pipeline := events[1]
	if pipeline.Node == nil || pipeline.Node.RuntimeName != "A" {
		t.Fatalf("expected mapped first pipeline node, got %#v", pipeline.Node)
	}
	if pipeline.Node.SyntheticKind != "" {
		t.Fatalf("mapped first pipeline node must not be synthetic: %#v", pipeline.Node)
	}

	recognition := events[2]
	if recognition.Data["parentNode"] != "A" {
		t.Fatalf("recognition parent should be real node A, got %#v", recognition.Data["parentNode"])
	}
}

func TestNormalizerDoesNotMarkLaterUnmappedNodeAsBootstrap(t *testing.T) {
	normalizer, emitted := newTestNormalizer()

	normalizer.OnTaskerTask(nil, maa.EventStatusStarting, maa.TaskerTaskDetail{
		TaskID: 1,
		Entry:  "A",
	})
	normalizer.OnNodePipelineNode(nil, maa.EventStatusStarting, maa.NodePipelineNodeDetail{
		TaskID: 1,
		Name:   "A",
	})
	normalizer.OnNodePipelineNode(nil, maa.EventStatusStarting, maa.NodePipelineNodeDetail{
		TaskID: 1,
		Name:   "MissingNode",
	})

	events := *emitted
	unmapped := events[2]
	if unmapped.Node == nil || unmapped.Node.RuntimeName != "MissingNode" {
		t.Fatalf("expected later runtime-only node, got %#v", unmapped.Node)
	}
	if unmapped.Node.SyntheticKind != "" {
		t.Fatalf("later unmapped node must not be bootstrap: %#v", unmapped.Node)
	}
}

func TestMergeRecognitionDetailEventData(t *testing.T) {
	eventData := map[string]interface{}{
		"recognitionId": int64(10),
		"focus":         false,
		"parentNode":    "A",
	}

	mergeRecognitionDetailEventData(eventData, map[string]interface{}{
		"id":             int64(10),
		"name":           "B",
		"algorithm":      "TemplateMatch",
		"hit":            true,
		"box":            []int{1, 2, 3, 4},
		"screenshotRef":  "shot-1",
		"combinedResult": []interface{}{},
	})

	if eventData["recognitionId"] != int64(10) || eventData["parentNode"] != "A" {
		t.Fatalf("existing recognition event fields should be preserved, got %#v", eventData)
	}
	if eventData["hit"] != true {
		t.Fatalf("hit should be copied from recognition detail, got %#v", eventData["hit"])
	}
	if eventData["algorithm"] != "TemplateMatch" {
		t.Fatalf("algorithm should be copied from recognition detail, got %#v", eventData["algorithm"])
	}
	if _, ok := eventData["screenshotRef"]; ok {
		t.Fatalf("artifact-only fields should not be copied into event data: %#v", eventData)
	}
}

func newTestNormalizer() (*Normalizer, *[]protocol.Event) {
	emitted := make([]protocol.Event, 0)
	normalizer := NewNormalizer(
		"session-1",
		"run-1",
		protocol.NodeResolverSnapshot{
			Nodes: []protocol.NodeResolverSnapshotNode{
				{
					FileID:      "main.json",
					NodeID:      "node-a",
					RuntimeName: "A",
					DisplayName: "Alpha",
				},
			},
		},
		protocol.ArtifactPolicy{},
		nil,
		func(event protocol.Event) {
			emitted = append(emitted, event)
		},
	)
	return normalizer, &emitted
}
