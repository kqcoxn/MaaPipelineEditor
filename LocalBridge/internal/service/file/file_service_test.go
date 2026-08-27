package file

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/eventbus"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/pkg/models"
)

func TestMain(m *testing.M) {
	_ = logger.Init("ERROR", "", false)
	os.Exit(m.Run())
}

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

func TestPipelineRootsFilterFilesAndDirectories(t *testing.T) {
	root := t.TempDir()
	selectedRoot := filepath.Join(root, "selected", "pipeline")
	otherRoot := filepath.Join(root, "other", "pipeline")
	selectedFile := filepath.Join(selectedRoot, "nested", "selected.json")
	otherFile := filepath.Join(otherRoot, "other.json")
	for _, path := range []string{selectedFile, otherFile} {
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte(`{"Node":{}}`), 0o644); err != nil {
			t.Fatal(err)
		}
	}

	bus := eventbus.New()
	service, err := NewService(root, nil, []string{".json"}, 10, 100, bus)
	if err != nil {
		t.Fatal(err)
	}
	if err := service.Rescan(); err != nil {
		t.Fatal(err)
	}
	if files := service.GetFileList(); len(files) != 2 {
		t.Fatalf("fallback mode should expose every pipeline directory: %#v", files)
	}

	changed := 0
	bus.Subscribe(eventbus.EventFileListChanged, func(eventbus.Event) { changed++ })
	service.SetPipelineRoots([]string{selectedRoot})
	files := service.GetFileList()
	if len(files) != 1 || files[0].FilePath != selectedFile {
		t.Fatalf("PI roots did not filter files: %#v", files)
	}
	if files[0].BundleName != "selected" {
		t.Fatalf("Pipeline file should identify its resource Bundle: %#v", files[0])
	}
	directories := service.GetDirectories()
	if len(directories) != 2 || directories[0] != selectedRoot || directories[1] != filepath.Dir(selectedFile) {
		t.Fatalf("PI roots did not filter directories: %#v", directories)
	}
	if changed != 1 {
		t.Fatalf("filter change should publish one list event, got %d", changed)
	}

	service.SetPipelineRoots(nil)
	if files := service.GetFileList(); len(files) != 2 {
		t.Fatalf("nil roots should restore fallback mode: %#v", files)
	}
}

func TestPipelineBundleNameUsesTheFirstPipelineBoundary(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "base", "pipeline", "nested", "pipeline", "main.json")
	if got := pipelineBundleName(root, path); got != "base" {
		t.Fatalf("pipelineBundleName() = %q, want %q", got, "base")
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
