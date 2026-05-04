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
