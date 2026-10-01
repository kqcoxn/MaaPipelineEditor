package file

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/eventbus"
)

func TestExtendedRootWithCanonicalPipelineRoots(t *testing.T) {
	root := t.TempDir()
	pipeline := filepath.Join(root, "resource", "base", "pipeline")
	path := filepath.Join(pipeline, "main.json")
	if err := os.MkdirAll(pipeline, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(`{"Start":{"action":"DoNothing"}}`), 0o644); err != nil {
		t.Fatal(err)
	}
	service, err := NewService(`\\?\`+root, nil, []string{".json"}, 10, 100, eventbus.New())
	if err != nil {
		t.Fatal(err)
	}
	defer service.Stop()
	if err := service.Rescan(); err != nil {
		t.Fatal(err)
	}
	if got := len(service.GetFileList()); got != 1 {
		t.Fatalf("initial scan: got %d files", got)
	}
	service.SetPipelineRoots([]string{pipeline})
	files := service.GetFileList()
	if len(files) != 1 {
		t.Fatalf("PI filtering lost the Pipeline file: %#v", files)
	}
	if _, err := service.ReadFile(files[0].FilePath); err != nil {
		t.Fatal(err)
	}
	if dirs := service.GetDirectories(); len(dirs) != 1 {
		t.Fatalf("PI filtering lost the Pipeline directory: %#v", dirs)
	}
	if !isWithinPath(`\\?\`+pipeline, path) {
		t.Fatal("extended Pipeline root rejected an ordinary file path")
	}
	if isWithinPath(pipeline, `\\?\`+filepath.Join(root, "resource", "base", "pipeline-other", "main.json")) {
		t.Fatal("accepted a sibling directory sharing the Pipeline prefix")
	}
}
