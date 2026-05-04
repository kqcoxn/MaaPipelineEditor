package runtime

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/protocol"
)

func TestPipelineOverrideSandboxUsesTargetSnapshotOnly(t *testing.T) {
	req := protocol.RunRequest{
		Profile: protocol.RunProfile{
			SavePolicy: "sandbox",
			Entry: protocol.NodeTarget{
				FileID:      "shop.json",
				NodeID:      "shop-node",
				RuntimeName: "ShopEntry",
			},
		},
		Mode: protocol.RunModeRunFromNode,
		GraphSnapshot: protocol.GraphSnapshot{
			RootFileID: "shop.json",
			Files: []protocol.GraphFileSnapshot{
				{
					FileID: "start.json",
					Pipeline: map[string]interface{}{
						"StartEntry": map[string]interface{}{"action": "start"},
					},
				},
				{
					FileID: "shop.json",
					Pipeline: map[string]interface{}{
						"ShopEntry": map[string]interface{}{"action": "shop"},
					},
				},
			},
		},
		Target: &protocol.NodeTarget{
			FileID:      "shop.json",
			NodeID:      "shop-node",
			RuntimeName: "ShopEntry",
		},
	}

	override, err := PipelineOverride("", req)
	if err != nil {
		t.Fatalf("PipelineOverride returned error: %v", err)
	}
	if _, ok := override["ShopEntry"]; !ok {
		t.Fatalf("expected ShopEntry in override, got %#v", override)
	}
	if _, ok := override["StartEntry"]; ok {
		t.Fatalf("did not expect StartEntry in override, got %#v", override)
	}
}

func TestPipelineOverrideUseDiskLoadsCurrentDiskFile(t *testing.T) {
	root := t.TempDir()
	targetPath := filepath.Join(root, "pipeline", "shop.json")
	if err := os.MkdirAll(filepath.Dir(targetPath), 0o755); err != nil {
		t.Fatalf("MkdirAll failed: %v", err)
	}
	if err := os.WriteFile(
		targetPath,
		[]byte("{\n  \"ShopEntry\": {\"action\": \"disk\"}\n}\n"),
		0o644,
	); err != nil {
		t.Fatalf("WriteFile failed: %v", err)
	}

	req := protocol.RunRequest{
		Profile: protocol.RunProfile{
			SavePolicy: "use-disk",
			Entry: protocol.NodeTarget{
				FileID:      "shop.json",
				NodeID:      "shop-node",
				RuntimeName: "ShopEntry",
				SourcePath:  targetPath,
			},
		},
		Mode: protocol.RunModeRunFromNode,
		GraphSnapshot: protocol.GraphSnapshot{
			RootFileID: "shop.json",
			Files: []protocol.GraphFileSnapshot{
				{
					FileID: "shop.json",
					Path:   targetPath,
					Pipeline: map[string]interface{}{
						"ShopEntry": map[string]interface{}{"action": "snapshot"},
					},
				},
			},
		},
		Target: &protocol.NodeTarget{
			FileID:      "shop.json",
			NodeID:      "shop-node",
			RuntimeName: "ShopEntry",
			SourcePath:  targetPath,
		},
	}

	override, err := PipelineOverride(root, req)
	if err != nil {
		t.Fatalf("PipelineOverride returned error: %v", err)
	}
	entry, ok := override["ShopEntry"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected ShopEntry object, got %#v", override["ShopEntry"])
	}
	if got, _ := entry["action"].(string); got != "disk" {
		t.Fatalf("expected disk action, got %#v", entry["action"])
	}
}

func TestPipelineOverrideMergesRequestOverridesOntoBase(t *testing.T) {
	req := protocol.RunRequest{
		Profile: protocol.RunProfile{
			SavePolicy: "sandbox",
			Entry: protocol.NodeTarget{
				FileID:      "shop.json",
				NodeID:      "shop-node",
				RuntimeName: "ShopEntry",
			},
		},
		Mode: protocol.RunModeRunFromNode,
		GraphSnapshot: protocol.GraphSnapshot{
			RootFileID: "shop.json",
			Files: []protocol.GraphFileSnapshot{
				{
					FileID: "shop.json",
					Pipeline: map[string]interface{}{
						"ShopEntry": map[string]interface{}{
							"recognition": map[string]interface{}{
								"type": "OCR",
								"param": map[string]interface{}{
									"lang":      "en",
									"threshold": 0.8,
								},
							},
							"action": map[string]interface{}{
								"type": "Tap",
								"param": map[string]interface{}{
									"x": 1,
									"y": 2,
								},
							},
							"next": []interface{}{"NextEntry"},
						},
					},
				},
			},
		},
		Target: &protocol.NodeTarget{
			FileID:      "shop.json",
			NodeID:      "shop-node",
			RuntimeName: "ShopEntry",
		},
		Overrides: []protocol.PipelineOverride{
			{
				RuntimeName: "ShopEntry",
				Pipeline: map[string]interface{}{
					"recognition": map[string]interface{}{
						"param": map[string]interface{}{
							"threshold": 0.95,
						},
					},
					"action": map[string]interface{}{
						"param": map[string]interface{}{
							"x": 9,
						},
					},
					"next": []interface{}{},
				},
			},
			{
				RuntimeName: "InsertedEntry",
				Pipeline: map[string]interface{}{
					"action": map[string]interface{}{
						"type": "DoNothing",
					},
				},
			},
		},
	}

	override, err := PipelineOverride("", req)
	if err != nil {
		t.Fatalf("PipelineOverride returned error: %v", err)
	}

	shopEntry, ok := override["ShopEntry"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected ShopEntry object, got %#v", override["ShopEntry"])
	}
	recognition, ok := shopEntry["recognition"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected recognition object, got %#v", shopEntry["recognition"])
	}
	recognitionParam, ok := recognition["param"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected recognition.param object, got %#v", recognition["param"])
	}
	if got, _ := recognitionParam["lang"].(string); got != "en" {
		t.Fatalf("expected lang to be preserved, got %#v", recognitionParam["lang"])
	}
	if got, _ := recognitionParam["threshold"].(float64); got != 0.95 {
		t.Fatalf("expected threshold override, got %#v", recognitionParam["threshold"])
	}

	action, ok := shopEntry["action"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected action object, got %#v", shopEntry["action"])
	}
	actionParam, ok := action["param"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected action.param object, got %#v", action["param"])
	}
	if got := numericValue(actionParam["x"]); got != 9 {
		t.Fatalf("expected x override, got %#v", actionParam["x"])
	}
	if got := numericValue(actionParam["y"]); got != 2 {
		t.Fatalf("expected y to be preserved, got %#v", actionParam["y"])
	}
	next, ok := shopEntry["next"].([]interface{})
	if !ok || len(next) != 0 {
		t.Fatalf("expected next to be replaced by empty list, got %#v", shopEntry["next"])
	}
	if _, ok := override["InsertedEntry"].(map[string]interface{}); !ok {
		t.Fatalf("expected InsertedEntry to be appended, got %#v", override["InsertedEntry"])
	}
}

func TestPipelineOverrideAllowsRequestOverridesWithoutBasePipeline(t *testing.T) {
	req := protocol.RunRequest{
		Profile: protocol.RunProfile{
			SavePolicy: "sandbox",
			Entry: protocol.NodeTarget{
				FileID:      "empty.json",
				NodeID:      "entry-node",
				RuntimeName: "InsertedEntry",
			},
		},
		Mode: protocol.RunModeRunFromNode,
		GraphSnapshot: protocol.GraphSnapshot{
			RootFileID: "empty.json",
			Files: []protocol.GraphFileSnapshot{
				{
					FileID:   "empty.json",
					Pipeline: nil,
				},
			},
		},
		Target: &protocol.NodeTarget{
			FileID:      "empty.json",
			NodeID:      "entry-node",
			RuntimeName: "InsertedEntry",
		},
		Overrides: []protocol.PipelineOverride{
			{
				RuntimeName: "InsertedEntry",
				Pipeline: map[string]interface{}{
					"action": map[string]interface{}{
						"type": "DoNothing",
					},
				},
			},
		},
	}

	override, err := PipelineOverride("", req)
	if err != nil {
		t.Fatalf("PipelineOverride returned error: %v", err)
	}
	inserted, ok := override["InsertedEntry"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected InsertedEntry object, got %#v", override["InsertedEntry"])
	}
	action, ok := inserted["action"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected action object, got %#v", inserted["action"])
	}
	if got, _ := action["type"].(string); got != "DoNothing" {
		t.Fatalf("expected override action, got %#v", action["type"])
	}
}

func numericValue(value interface{}) float64 {
	switch typed := value.(type) {
	case int:
		return float64(typed)
	case int64:
		return float64(typed)
	case float64:
		return typed
	default:
		return 0
	}
}
