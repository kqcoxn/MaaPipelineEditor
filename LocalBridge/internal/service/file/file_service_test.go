package file

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/pkg/models"
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

func TestRefreshFileIndexUpdatesNodesAndContentHash(t *testing.T) {
	root := t.TempDir()
	filePath := filepath.Join(root, "pipeline", "main.json")
	if err := os.MkdirAll(filepath.Dir(filePath), 0o755); err != nil {
		t.Fatalf("MkdirAll failed: %v", err)
	}
	if err := os.WriteFile(filePath, []byte(`{"Before": {}}`), 0o644); err != nil {
		t.Fatalf("WriteFile failed: %v", err)
	}
	scanner := NewScanner(root, nil, []string{".json"})
	initial, err := scanner.ScanSingle(filePath)
	if err != nil {
		t.Fatalf("ScanSingle failed: %v", err)
	}
	service := &Service{
		root:      root,
		scanner:   scanner,
		fileIndex: map[string]*models.File{filePath: initial},
	}

	if err := os.WriteFile(filePath, []byte(`{"After": {}}`), 0o644); err != nil {
		t.Fatalf("WriteFile failed: %v", err)
	}
	service.refreshFileIndex(filePath)
	files := service.GetFileList()
	if len(files) != 1 || len(files[0].Nodes) != 1 || files[0].Nodes[0].Label != "After" {
		t.Fatalf("file index was not refreshed: %+v", files)
	}
	if files[0].ContentHash == "" || files[0].ContentHash == initial.ContentHash {
		t.Fatalf("content hash was not refreshed: before=%q after=%q", initial.ContentHash, files[0].ContentHash)
	}
}
