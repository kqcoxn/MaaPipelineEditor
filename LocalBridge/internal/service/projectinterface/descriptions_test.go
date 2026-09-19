package projectinterface

import (
	"os"
	"path/filepath"
	"testing"
)

func TestDisplaySnapshotTaskDescription(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "task.md"), []byte("\ufeff# 任务说明\n\n**正文**"), 0644); err != nil {
		t.Fatal(err)
	}
	snapshot := &ProjectSnapshot{InterfaceRoot: root, EntryPath: filepath.Join(root, "interface.json"), Document: map[string]any{"task": []any{
		map[string]any{"name": "file", "description": "task.md"},
		map[string]any{"name": "inline", "description": "# 内联说明\n正文"},
		map[string]any{"name": "missing", "description": "missing.md"},
		map[string]any{"name": "url", "description": "https://example.com/task.md"},
	}}}
	result := snapshot.displaySnapshot("zh_cn")
	tasks := objectArray(result.Document["task"])
	if tasks[0]["description"] != "# 任务说明\n\n**正文**" {
		t.Fatalf("did not resolve markdown: %v", tasks[0])
	}
	if tasks[1]["description"] != "# 内联说明\n正文" {
		t.Fatal("inline text changed")
	}
	if tasks[2]["description"] == "missing.md" || len(result.Diagnostics) != 1 {
		t.Fatal("missing file not reported")
	}
	if tasks[3]["description"] != "https://example.com/task.md" {
		t.Fatal("URL interpreted as local path")
	}
	if objectArray(snapshot.Document["task"])[0]["description"] != "task.md" {
		t.Fatal("source document mutated")
	}
}

func TestTaskDescriptionRejectsOutsideRoot(t *testing.T) {
	root := t.TempDir()
	if _, err := readTaskDescription(root, filepath.Join(filepath.Dir(root), "outside.md")); err == nil {
		t.Fatal("outside path accepted")
	}
}
