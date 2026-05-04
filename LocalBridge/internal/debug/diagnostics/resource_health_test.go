package diagnostics

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/protocol"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/mfw"
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
	tempDir := t.TempDir()
	filePath := filepath.Join(tempDir, "broken.json")
	if err := os.WriteFile(filePath, []byte("{ invalid"), 0o644); err != nil {
		t.Fatalf("WriteFile failed: %v", err)
	}
	diagnostics := service.checkGraphHealth(protocol.ResourceHealthRequest{
		GraphSnapshot: protocol.GraphSnapshot{
			RootFileID: "broken.json",
			Files: []protocol.GraphFileSnapshot{
				{
					FileID:   "broken.json",
					Path:     filePath,
					Pipeline: map[string]interface{}{},
				},
			},
		},
		ResolverSnapshot: protocol.NodeResolverSnapshot{
			RootFileID: "broken.json",
			Nodes: []protocol.NodeResolverSnapshotNode{
				{
					FileID:      "broken.json",
					NodeID:      "node-a",
					RuntimeName: "Alpha",
				},
			},
		},
		Target: &protocol.NodeTarget{
			FileID:      "broken.json",
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

func TestCheckResourceLoadDiagnostics_SkipsChecklistWhenLoadIsSkipped(t *testing.T) {
	service := NewService(nil, "")
	result := service.checkResourceLoadDiagnostics(nil, nil)

	if result.shouldRunFailureChecklist {
		t.Fatalf("shouldRunFailureChecklist = true, want false")
	}
	assertDiagnosticCode(t, result.diagnostics, "debug.resource.load_skipped")
}

func TestCheckResourceLoadDiagnostics_SkipsChecklistWhenMaaFWUnavailable(t *testing.T) {
	service := NewService(nil, "")
	result := service.checkResourceLoadDiagnostics([]string{"C:/bundle"}, nil)

	if result.shouldRunFailureChecklist {
		t.Fatalf("shouldRunFailureChecklist = true, want false")
	}
	assertDiagnosticCode(t, result.diagnostics, "debug.resource.load_unavailable")
}

func TestRunLoadFailureChecklist_DetectsPipelineJSONErrorsFromResolvedBundle(t *testing.T) {
	service := NewService(nil, "")
	bundleDir := createResourceBundleDir(t)
	filePath := filepath.Join(bundleDir, "pipeline", "broken.jsonc")
	if err := os.WriteFile(filePath, []byte("{ invalid"), 0o644); err != nil {
		t.Fatalf("WriteFile failed: %v", err)
	}

	diagnostics := service.runLoadFailureChecklist([]mfw.ResourceBundleResolution{
		{
			InputPath:    bundleDir,
			InputAbsPath: bundleDir,
			ResolvedPath: bundleDir,
		},
	})

	assertDiagnosticCode(t, diagnostics, "debug.resource.pipeline_json_invalid")
	assertDiagnosticSuggestion(t, diagnostics, "debug.resource.pipeline_json_invalid")
	assertDiagnosticCategory(t, diagnostics, "debug.resource.pipeline_json_invalid", "loading")
}

func TestRunLoadFailureChecklist_DetectsDuplicateNodeNamesFromResolvedBundle(t *testing.T) {
	service := NewService(nil, "")
	bundleDir := createResourceBundleDir(t)
	filePath := filepath.Join(bundleDir, "pipeline", "duplicate.json")
	content := []byte(`{
  "NodeA": {},
  "NodeA": {},
  "$mpe": { "prefix": "" }
}`)
	if err := os.WriteFile(filePath, content, 0o644); err != nil {
		t.Fatalf("WriteFile failed: %v", err)
	}

	diagnostics := service.runLoadFailureChecklist([]mfw.ResourceBundleResolution{
		{
			InputPath:    bundleDir,
			InputAbsPath: bundleDir,
			ResolvedPath: bundleDir,
		},
	})

	assertDiagnosticCode(t, diagnostics, "debug.resource.pipeline_node_name_duplicate")
	assertDiagnosticSuggestion(t, diagnostics, "debug.resource.pipeline_node_name_duplicate")
	assertDiagnosticCategory(t, diagnostics, "debug.resource.pipeline_node_name_duplicate", "loading")
}

func TestRunLoadFailureChecklist_ScansFilesOutsideGraphSnapshot(t *testing.T) {
	service := NewService(nil, "")
	bundleDir := createResourceBundleDir(t)
	filePath := filepath.Join(bundleDir, "pipeline", "sub", "extra.json")
	if err := os.MkdirAll(filepath.Dir(filePath), 0o755); err != nil {
		t.Fatalf("MkdirAll failed: %v", err)
	}
	content := []byte(`{
  "NodeB": {},
  "NodeB": {}
}`)
	if err := os.WriteFile(filePath, content, 0o644); err != nil {
		t.Fatalf("WriteFile failed: %v", err)
	}

	diagnostics := service.runLoadFailureChecklist([]mfw.ResourceBundleResolution{
		{
			InputPath:    bundleDir,
			InputAbsPath: bundleDir,
			ResolvedPath: bundleDir,
		},
		{
			InputPath:    bundleDir,
			InputAbsPath: bundleDir,
			ResolvedPath: bundleDir,
		},
	})

	assertDiagnosticCode(t, diagnostics, "debug.resource.pipeline_node_name_duplicate")
	assertDiagnosticMissing(t, diagnostics, "debug.graph.file_source_missing")
	assertDiagnosticMissing(t, diagnostics, "debug.graph.file_json_invalid")
}

func createResourceBundleDir(t *testing.T) string {
	t.Helper()
	bundleDir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(bundleDir, "pipeline"), 0o755); err != nil {
		t.Fatalf("MkdirAll failed: %v", err)
	}
	if err := os.MkdirAll(filepath.Join(bundleDir, "image"), 0o755); err != nil {
		t.Fatalf("MkdirAll failed: %v", err)
	}
	return bundleDir
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

func assertDiagnosticSuggestion(
	t *testing.T,
	diagnostics []protocol.Diagnostic,
	code string,
) {
	t.Helper()
	for _, diagnostic := range diagnostics {
		if diagnostic.Code != code {
			continue
		}
		suggestion, _ := diagnostic.Data["suggestion"].(string)
		if suggestion == "" {
			t.Fatalf("diagnostic %s has empty suggestion: %+v", code, diagnostic)
		}
		return
	}
	t.Fatalf("diagnostics do not contain %s: %+v", code, diagnostics)
}

func assertDiagnosticCategory(
	t *testing.T,
	diagnostics []protocol.Diagnostic,
	code string,
	category string,
) {
	t.Helper()
	for _, diagnostic := range diagnostics {
		if diagnostic.Code != code {
			continue
		}
		value, _ := diagnostic.Data["category"].(string)
		if value != category {
			t.Fatalf(
				"diagnostic %s category = %q, want %q: %+v",
				code,
				value,
				category,
				diagnostic,
			)
		}
		return
	}
	t.Fatalf("diagnostics do not contain %s: %+v", code, diagnostics)
}

func assertDiagnosticMissing(
	t *testing.T,
	diagnostics []protocol.Diagnostic,
	code string,
) {
	t.Helper()
	for _, diagnostic := range diagnostics {
		if diagnostic.Code == code {
			t.Fatalf("diagnostics unexpectedly contain %s: %+v", code, diagnostics)
		}
	}
}
