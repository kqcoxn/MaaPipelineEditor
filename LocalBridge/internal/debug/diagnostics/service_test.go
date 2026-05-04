package diagnostics

import (
	"os"
	"path/filepath"
	"testing"
)

func TestCheckResources_ResolvesPipelineFilePath(t *testing.T) {
	root := t.TempDir()
	bundle := createDiagnosticsTestBundle(t, root, "resource")

	service := NewService(nil, root)
	diagnostics := service.checkResources([]string{
		filepath.Join(bundle, "pipeline", "main.json"),
	})

	if len(diagnostics) != 1 {
		t.Fatalf("diagnostic count = %d, want 1", len(diagnostics))
	}
	diagnostic := diagnostics[0]
	if diagnostic.Code != "debug.resource.resolved" {
		t.Fatalf("diagnostic code = %s, want debug.resource.resolved", diagnostic.Code)
	}
	if got := diagnostic.Data["resolvedPath"]; got != bundle {
		t.Fatalf("resolvedPath = %v, want %s", got, bundle)
	}
	if got := diagnostic.Data["strategy"]; got != "ancestor_pipeline" {
		t.Fatalf("strategy = %v, want ancestor_pipeline", got)
	}
}

func TestCheckResources_WarnsWhenDifferentInputsResolveToSameBundle(t *testing.T) {
	root := t.TempDir()
	bundle := createDiagnosticsTestBundle(t, root, "resource")

	service := NewService(nil, root)
	diagnostics := service.checkResources([]string{
		bundle,
		filepath.Join(bundle, "pipeline", "main.json"),
	})

	if len(diagnostics) != 3 {
		t.Fatalf("diagnostic count = %d, want 3", len(diagnostics))
	}
	if diagnostics[2].Code != "debug.resource.duplicate" {
		t.Fatalf("last diagnostic code = %s, want debug.resource.duplicate", diagnostics[2].Code)
	}
	if got := diagnostics[2].Data["resolvedPath"]; got != bundle {
		t.Fatalf("duplicate resolvedPath = %v, want %s", got, bundle)
	}
}

func TestCheckResources_ReportsResolverFailures(t *testing.T) {
	root := t.TempDir()
	workspace := filepath.Join(root, "workspace")
	createDiagnosticsTestBundle(t, workspace, "resource-a")
	createDiagnosticsTestBundle(t, workspace, "resource-b")

	service := NewService(nil, root)
	diagnostics := service.checkResources([]string{workspace})

	if len(diagnostics) != 1 {
		t.Fatalf("diagnostic count = %d, want 1", len(diagnostics))
	}
	diagnostic := diagnostics[0]
	if diagnostic.Code != "debug.resource.resolve_failed" {
		t.Fatalf("diagnostic code = %s, want debug.resource.resolve_failed", diagnostic.Code)
	}
	if got := diagnostic.Data["reason"]; got != "bundle_ambiguous" {
		t.Fatalf("reason = %v, want bundle_ambiguous", got)
	}
}

func createDiagnosticsTestBundle(t *testing.T, root string, parts ...string) string {
	t.Helper()

	bundle := filepath.Join(append([]string{root}, parts...)...)
	mustDiagnosticsMkdirAll(t, filepath.Join(bundle, "pipeline"))
	mustDiagnosticsMkdirAll(t, filepath.Join(bundle, "image", "main"))
	mustDiagnosticsMkdirAll(t, filepath.Join(bundle, "model", "ocr"))
	mustDiagnosticsWriteFile(t, filepath.Join(bundle, "pipeline", "main.json"), "{}")
	mustDiagnosticsWriteFile(t, filepath.Join(bundle, "image", "main", "home.png"), "png")
	mustDiagnosticsWriteFile(t, filepath.Join(bundle, "model", "ocr", "det.onnx"), "onnx")
	return bundle
}

func mustDiagnosticsMkdirAll(t *testing.T, path string) {
	t.Helper()
	if err := os.MkdirAll(path, 0o755); err != nil {
		t.Fatalf("mkdir %s: %v", path, err)
	}
}

func mustDiagnosticsWriteFile(t *testing.T, path string, content string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("write file %s: %v", path, err)
	}
}
