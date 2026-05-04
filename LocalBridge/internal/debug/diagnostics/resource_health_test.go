package diagnostics

import (
	"testing"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/protocol"
)

func TestCheckGraphHealth_DetectsResolverConflicts(t *testing.T) {
	service := NewService(nil, "")
	diagnostics := service.checkGraphHealth(protocol.ResourceHealthRequest{
		GraphSnapshot: protocol.GraphSnapshot{
			RootFileID: "main.json",
			Files: []protocol.GraphFileSnapshot{
				{
					FileID:   "main.json",
					Pipeline: map[string]interface{}{},
				},
			},
		},
		ResolverSnapshot: protocol.NodeResolverSnapshot{
			RootFileID: "main.json",
			Nodes: []protocol.NodeResolverSnapshotNode{
				{
					FileID:      "main.json",
					NodeID:      "node-a",
					RuntimeName: "Alpha",
				},
				{
					FileID:      "main.json",
					NodeID:      "node-b",
					RuntimeName: "Alpha",
				},
			},
			Edges: []protocol.NodeResolverSnapshotEdge{
				{
					EdgeID:          "edge-1",
					FromRuntimeName: "Alpha",
					ToRuntimeName:   "Missing",
				},
			},
		},
		Target: &protocol.NodeTarget{
			FileID:      "main.json",
			NodeID:      "node-a",
			RuntimeName: "Alpha",
		},
	})

	assertDiagnosticCode(t, diagnostics, "debug.resolver.runtime_duplicate")
	assertDiagnosticCode(t, diagnostics, "debug.resolver.edge_target_unknown")
}

func TestCheckGraphHealth_ReportsMissingTarget(t *testing.T) {
	service := NewService(nil, "")
	diagnostics := service.checkGraphHealth(protocol.ResourceHealthRequest{
		GraphSnapshot: protocol.GraphSnapshot{
			RootFileID: "main.json",
			Files: []protocol.GraphFileSnapshot{
				{
					FileID:   "main.json",
					Pipeline: map[string]interface{}{},
				},
			},
		},
		ResolverSnapshot: protocol.NodeResolverSnapshot{
			RootFileID: "main.json",
			Nodes: []protocol.NodeResolverSnapshotNode{
				{
					FileID:      "main.json",
					NodeID:      "node-a",
					RuntimeName: "Alpha",
				},
			},
		},
	})

	assertDiagnosticCode(t, diagnostics, "debug.target.missing")
}

func TestCheckGraphHealth_ReturnsReadyWhenStaticChecksPass(t *testing.T) {
	service := NewService(nil, "")
	diagnostics := service.checkGraphHealth(protocol.ResourceHealthRequest{
		GraphSnapshot: protocol.GraphSnapshot{
			RootFileID: "main.json",
			Files: []protocol.GraphFileSnapshot{
				{
					FileID:   "main.json",
					Pipeline: map[string]interface{}{},
				},
			},
		},
		ResolverSnapshot: protocol.NodeResolverSnapshot{
			RootFileID: "main.json",
			Nodes: []protocol.NodeResolverSnapshotNode{
				{
					FileID:      "main.json",
					NodeID:      "node-a",
					RuntimeName: "Alpha",
				},
			},
		},
		Target: &protocol.NodeTarget{
			FileID:      "main.json",
			NodeID:      "node-a",
			RuntimeName: "Alpha",
		},
	})

	if len(diagnostics) != 1 {
		t.Fatalf("diagnostic count = %d, want 1", len(diagnostics))
	}
	if diagnostics[0].Code != "debug.graph.ready" {
		t.Fatalf("diagnostic code = %s, want debug.graph.ready", diagnostics[0].Code)
	}
}

func assertDiagnosticCode(
	t *testing.T,
	diagnostics []protocol.Diagnostic,
	code string,
) {
	t.Helper()
	for _, diagnostic := range diagnostics {
		if diagnostic.Code == code {
			return
		}
	}
	t.Fatalf("diagnostics do not contain %s: %+v", code, diagnostics)
}
