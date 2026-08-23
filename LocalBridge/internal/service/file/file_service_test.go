package file

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestValidatePathUsesRootBoundary(t *testing.T) {
	root := t.TempDir()
	service := &Service{root: root}

	insidePath := filepath.Join(root, "pipeline", "main.json")
	if err := service.validatePath(insidePath); err != nil {
		t.Fatalf("validatePath() rejected a path inside root: %v", err)
	}

	rootSibling := filepath.Join(filepath.Dir(root), filepath.Base(root)+"-old")
	siblingPath := filepath.Join(rootSibling, "pipeline", "main.json")
	if err := service.validatePath(siblingPath); err == nil {
		t.Fatalf("validatePath() accepted a sibling path sharing the root prefix: %s", siblingPath)
	}

	outsidePath := filepath.Join(t.TempDir(), "main.json")
	if err := service.validatePath(outsidePath); err == nil {
		t.Fatalf("validatePath() accepted a path outside root: %s", outsidePath)
	}

	// The comparison is case-insensitive on Windows, matching the frontend cache repair.
	if err := service.validatePath(strings.ToUpper(insidePath)); err != nil {
		t.Fatalf("validatePath() rejected a case-variant path inside root: %v", err)
	}
}
