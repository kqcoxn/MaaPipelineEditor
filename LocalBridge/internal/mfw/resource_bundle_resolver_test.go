package mfw

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestResolveResourceBundlePath_UpwardStrategies(t *testing.T) {
	root := t.TempDir()
	bundle := createTestBundle(t, root, "resource", "base")

	testCases := []struct {
		name     string
		path     string
		strategy ResourceBundleResolveStrategy
	}{
		{
			name:     "bundle root",
			path:     bundle,
			strategy: ResourceBundleResolveExactRoot,
		},
		{
			name:     "pipeline dir",
			path:     filepath.Join(bundle, "pipeline"),
			strategy: ResourceBundleResolveAncestorPipeline,
		},
		{
			name:     "pipeline file",
			path:     filepath.Join(bundle, "pipeline", "main.json"),
			strategy: ResourceBundleResolveAncestorPipeline,
		},
		{
			name:     "image file",
			path:     filepath.Join(bundle, "image", "main", "home.png"),
			strategy: ResourceBundleResolveAncestorImage,
		},
		{
			name:     "ocr model file",
			path:     filepath.Join(bundle, "model", "ocr", "det.onnx"),
			strategy: ResourceBundleResolveAncestorModel,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			resolution, err := ResolveResourceBundlePath(tc.path)
			if err != nil {
				t.Fatalf("ResolveResourceBundlePath() error = %v", err)
			}
			if resolution.ResolvedPath != bundle {
				t.Fatalf("resolved path = %s, want %s", resolution.ResolvedPath, bundle)
			}
			if resolution.Strategy != tc.strategy {
				t.Fatalf("strategy = %s, want %s", resolution.Strategy, tc.strategy)
			}
		})
	}
}

func TestResolveResourceBundlePath_DescendantUnique(t *testing.T) {
	root := t.TempDir()
	workspace := filepath.Join(root, "workspace")
	bundle := createTestBundle(t, workspace, "resource", "base")

	resolution, err := ResolveResourceBundlePath(workspace)
	if err != nil {
		t.Fatalf("ResolveResourceBundlePath() error = %v", err)
	}
	if resolution.ResolvedPath != bundle {
		t.Fatalf("resolved path = %s, want %s", resolution.ResolvedPath, bundle)
	}
	if resolution.Strategy != ResourceBundleResolveDescendantUnique {
		t.Fatalf("strategy = %s, want %s", resolution.Strategy, ResourceBundleResolveDescendantUnique)
	}
}

func TestResolveResourceBundlePath_Ambiguous(t *testing.T) {
	root := t.TempDir()
	workspace := filepath.Join(root, "workspace")
	createTestBundle(t, workspace, "resource-a")
	createTestBundle(t, workspace, "resource-b")

	_, err := ResolveResourceBundlePath(workspace)
	if err == nil {
		t.Fatal("ResolveResourceBundlePath() error = nil, want ambiguity error")
	}
	var resolveErr *ResourceBundleResolveError
	if !errors.As(err, &resolveErr) {
		t.Fatalf("error type = %T, want *ResourceBundleResolveError", err)
	}
	if resolveErr.Code != "bundle_ambiguous" {
		t.Fatalf("error code = %s, want bundle_ambiguous", resolveErr.Code)
	}
	if len(resolveErr.Candidates) != 2 {
		t.Fatalf("candidate count = %d, want 2", len(resolveErr.Candidates))
	}
}

func TestResolveResourceBundlePath_NotFound(t *testing.T) {
	root := t.TempDir()
	plainDir := filepath.Join(root, "plain")
	if err := os.MkdirAll(plainDir, 0o755); err != nil {
		t.Fatalf("mkdir plain dir: %v", err)
	}

	_, err := ResolveResourceBundlePath(plainDir)
	if err == nil {
		t.Fatal("ResolveResourceBundlePath() error = nil, want not found error")
	}
	var resolveErr *ResourceBundleResolveError
	if !errors.As(err, &resolveErr) {
		t.Fatalf("error type = %T, want *ResourceBundleResolveError", err)
	}
	if resolveErr.Code != "bundle_not_found" {
		t.Fatalf("error code = %s, want bundle_not_found", resolveErr.Code)
	}
}

func TestResolveResourceBundlePathsDetailed_ReturnsResolvedPrefixBeforeError(t *testing.T) {
	root := t.TempDir()
	bundle := createTestBundle(t, root, "resource")
	plainDir := filepath.Join(root, "plain")
	if err := os.MkdirAll(plainDir, 0o755); err != nil {
		t.Fatalf("mkdir plain dir: %v", err)
	}

	resolutions, err := ResolveResourceBundlePathsDetailed([]string{
		filepath.Join(bundle, "pipeline", "main.json"),
		plainDir,
	})
	if err == nil {
		t.Fatal("ResolveResourceBundlePathsDetailed() error = nil, want not found error")
	}
	if len(resolutions) != 1 {
		t.Fatalf("resolved count = %d, want 1", len(resolutions))
	}
	if resolutions[0].ResolvedPath != bundle {
		t.Fatalf("resolved path = %s, want %s", resolutions[0].ResolvedPath, bundle)
	}
	var resolveErr *ResourceBundleResolveError
	if !errors.As(err, &resolveErr) {
		t.Fatalf("error type = %T, want *ResourceBundleResolveError", err)
	}
	if resolveErr.Code != "bundle_not_found" {
		t.Fatalf("error code = %s, want bundle_not_found", resolveErr.Code)
	}
}

func createTestBundle(t *testing.T, root string, parts ...string) string {
	t.Helper()

	bundle := filepath.Join(append([]string{root}, parts...)...)
	mustMkdirAll(t, filepath.Join(bundle, "pipeline"))
	mustMkdirAll(t, filepath.Join(bundle, "image", "main"))
	mustMkdirAll(t, filepath.Join(bundle, "model", "ocr"))
	mustWriteFile(t, filepath.Join(bundle, "default_pipeline.json"), "{}")
	mustWriteFile(t, filepath.Join(bundle, "pipeline", "main.json"), "{}")
	mustWriteFile(t, filepath.Join(bundle, "image", "main", "home.png"), "png")
	mustWriteFile(t, filepath.Join(bundle, "model", "ocr", "det.onnx"), "onnx")
	return bundle
}

func mustMkdirAll(t *testing.T, path string) {
	t.Helper()
	if err := os.MkdirAll(path, 0o755); err != nil {
		t.Fatalf("mkdir %s: %v", path, err)
	}
}

func mustWriteFile(t *testing.T, path string, content string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("write file %s: %v", path, err)
	}
}
