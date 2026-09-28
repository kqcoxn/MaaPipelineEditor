package diagnostics

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func put(t *testing.T, root, name, content string) string {
	t.Helper()
	path := filepath.Join(root, filepath.FromSlash(name))
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0600); err != nil {
		t.Fatal(err)
	}
	return path
}

func Build(snapshot Snapshot) ([]byte, error) {
	var destination bytes.Buffer
	err := Write(&destination, snapshot)
	return destination.Bytes(), err
}

func unpack(t *testing.T, data []byte) map[string]string {
	t.Helper()
	r, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		t.Fatal(err)
	}
	files := map[string]string{}
	for _, file := range r.File {
		if _, exists := files[file.Name]; exists {
			t.Fatalf("duplicate ZIP entry: %s", file.Name)
		}
		reader, err := file.Open()
		if err != nil {
			t.Fatal(err)
		}
		content, err := io.ReadAll(reader)
		reader.Close()
		if err != nil {
			t.Fatal(err)
		}
		files[file.Name] = string(content)
	}
	return files
}

func TestArchiveIncludesAllDiagnosticSourcesAndOfflineSnapshot(t *testing.T) {
	root, logs, mfw, desktop := t.TempDir(), t.TempDir(), t.TempDir(), t.TempDir()
	opened := put(t, root, "resource/pipeline/main.json", `{"Entry": {}}`)
	put(t, logs, "lb.log", "backend content")
	put(t, logs, "vision/nested/frame.png", "excluded default recognition image")
	put(t, logs, "nested/VISION/frame.png", "excluded nested recognition image")
	put(t, logs, "on_error/nested/failed.png", "excluded default error screenshot")
	put(t, logs, "nested/ON_ERROR/failed.png", "excluded nested error screenshot")
	put(t, logs, "vision.log", "unrelated log")
	put(t, logs, "on_error.log", "error text log")
	for name, content := range map[string]string{
		"maafw.log": "framework content", "maafw.log.1": "history", "custom.log": "agent",
		"vision/frame.webp": "recognition image", "vision/nested/result.json": "recognition details",
		"on_error/failed.png": "failure image", "vision-cache/keep.png": "other image",
	} {
		put(t, mfw, name, content)
	}
	put(t, desktop, "launcher.log", "launcher content")
	put(t, desktop, "mpelb.previous.log", "previous output")
	put(t, desktop, "settings.json", "DO NOT EXPORT")
	context := Snapshot{Root: root, LogDir: logs, MFWDir: mfw, DesktopDir: desktop, Version: "test-version"}
	path := filepath.Join(t.TempDir(), "diagnostics-session.json")
	recorder, err := NewRecorder(path, context)
	if err != nil {
		t.Fatal(err)
	}
	live, err := recorder.Capture(Payload{
		FrontendLogs:  map[string]interface{}{"operation": []string{"edited"}},
		FrontendState: map[string]interface{}{"unsaved": "current content"},
		OpenedFiles:   []OpenedFile{{FilePath: opened, FileName: "main.json", Current: true}},
		Manifest:      map[string]interface{}{"editorVersion": "test-editor"},
	})
	if err != nil {
		t.Fatal(err)
	}
	offline, err := ReadSnapshot(path)
	if err != nil {
		t.Fatal(err)
	}
	for _, snapshot := range []Snapshot{live, offline} {
		data, err := Build(snapshot)
		if err != nil {
			t.Fatal(err)
		}
		files := unpack(t, data)
		for name, content := range map[string]string{
			"localbridge/lb.log": "backend content", "localbridge/vision.log": "unrelated log",
			"debug/maafw.log": "framework content", "debug/maafw.log.1": "history", "debug/custom.log": "agent",
			"localbridge/on_error.log": "error text log", "debug/vision-cache/keep.png": "other image",
			"desktop/launcher.log": "launcher content", "desktop/mpelb.previous.log": "previous output",
			"mpe/open-files/disk/resource/pipeline/main.json": `{"Entry": {}}`,
		} {
			if files[name] != content {
				t.Errorf("%s = %q, want %q", name, files[name], content)
			}
		}
		for _, name := range []string{
			"debug/vision/frame.webp", "localbridge/default/vision/nested/result.json",
			"localbridge/vision/nested/frame.png", "localbridge/nested/VISION/frame.png",
			"debug/on_error/failed.png", "localbridge/on_error/nested/failed.png", "localbridge/nested/ON_ERROR/failed.png",
		} {
			if _, exists := files[name]; exists {
				t.Errorf("exported excluded diagnostic file: %s", name)
			}
		}
		if strings.Contains(string(data), "DO NOT EXPORT") || files["desktop/settings.json"] != "" {
			t.Fatal("exported settings")
		}
		if !strings.Contains(files["mpe/frontend-state.json"], "current content") || !strings.Contains(files["mpe/frontend-logs.json"], "edited") {
			t.Fatal("missing frontend snapshot content")
		}
		var manifest map[string]interface{}
		if err := json.Unmarshal([]byte(files["manifest.json"]), &manifest); err != nil {
			t.Fatal(err)
		}
		if manifest["localBridgeVersion"] != "test-version" || manifest["editorVersion"] != "test-editor" || manifest["frontendCapturedAt"] != live.CapturedAt || live.CapturedAt == "" {
			t.Fatalf("wrong provenance: %v", manifest)
		}
		if len(manifest["warnings"].([]interface{})) != 0 {
			t.Fatalf("unexpected warnings: %v", manifest)
		}
	}
	// Starting another project must not reuse the previous project's frontend state.
	if _, err = NewRecorder(path, Snapshot{Root: t.TempDir()}); err != nil {
		t.Fatal(err)
	}
	reset, err := ReadSnapshot(path)
	if err != nil {
		t.Fatal(err)
	}
	if reset.Payload.FrontendState != nil || reset.CapturedAt != "" {
		t.Fatal("retained stale frontend state")
	}
}

func TestArchiveReportsMissingFilesAndRejectsOutsideRoot(t *testing.T) {
	root := t.TempDir()
	outside := put(t, t.TempDir(), "secret.json", "outside secret")
	snapshot := Snapshot{Root: root, LogDir: filepath.Join(root, "missing"), MFWDir: filepath.Join(root, "missing"), Payload: Payload{OpenedFiles: []OpenedFile{{FilePath: outside}}}}
	data, err := Build(snapshot)
	if err != nil {
		t.Fatal(err)
	}
	files := unpack(t, data)
	if len(files) != 1 {
		t.Fatalf("unexpected files: %v", files)
	}
	for _, warning := range []string{"文件不在收集目录内", "未取得前端状态快照", "未找到 maafw.log"} {
		if !strings.Contains(files["manifest.json"], warning) {
			t.Fatalf("missing warning %s", warning)
		}
	}
}

func TestArchiveRefusesSymlinkEscape(t *testing.T) {
	root := t.TempDir()
	outside := put(t, t.TempDir(), "secret.log", "secret")
	link := filepath.Join(root, "link.log")
	if err := os.Symlink(outside, link); err == nil {
		data, err := Build(Snapshot{Root: root, LogDir: root, MFWDir: root})
		if err != nil {
			t.Fatal(err)
		}
		if files := unpack(t, data); files["localbridge/link.log"] != "" {
			t.Fatal("exported external symlink")
		}
	}
}

func TestArchiveStreamsFullFileLargerThan128MiB(t *testing.T) {
	root := t.TempDir()
	f, err := os.Create(filepath.Join(root, "large.log"))
	if err != nil {
		t.Fatal(err)
	}
	const size = 128*1024*1024 + 1
	err = f.Truncate(size)
	if err == nil {
		_, err = f.WriteAt([]byte("last byte"), size-9)
	}
	f.Close()
	if err != nil {
		t.Fatal(err)
	}
	output := filepath.Join(t.TempDir(), "logs.zip")
	if err := Save(output, Snapshot{LogDir: root, MFWDir: root}); err != nil {
		t.Fatal(err)
	}
	r, err := zip.OpenReader(output)
	if err != nil {
		t.Fatal(err)
	}
	defer r.Close()
	for _, entry := range r.File {
		if entry.Name != "localbridge/large.log" {
			continue
		}
		if entry.UncompressedSize64 != size {
			t.Fatalf("size = %d", entry.UncompressedSize64)
		}
		reader, err := entry.Open()
		if err != nil {
			t.Fatal(err)
		}
		defer reader.Close()
		if _, err := io.CopyN(io.Discard, reader, size-9); err != nil {
			t.Fatal(err)
		}
		tail, err := io.ReadAll(reader)
		if err != nil || string(tail) != "last byte" {
			t.Fatalf("tail = %q, error = %v", tail, err)
		}
		return
	}
	t.Fatal("large log missing")
}

func TestSaveWithinLogsExcludesOutputAndPreservesPreviousArchiveOnFailure(t *testing.T) {
	root := t.TempDir()
	put(t, root, "maafw.log", "complete log")
	output := put(t, root, "logs.zip", "previous archive")
	if err := Save(output, Snapshot{LogDir: root, MFWDir: root, Payload: Payload{FrontendLogs: map[string]interface{}{"invalid": make(chan int)}}}); err == nil {
		t.Fatal("expected encoding error")
	}
	data, err := os.ReadFile(output)
	if err != nil || string(data) != "previous archive" {
		t.Fatalf("previous archive changed: %q, %v", data, err)
	}
	if err := Save(output, Snapshot{LogDir: root, MFWDir: root}); err != nil {
		t.Fatal(err)
	}
	data, err = os.ReadFile(output)
	if err != nil {
		t.Fatal(err)
	}
	files := unpack(t, data)
	if len(files) != 2 || files["debug/maafw.log"] != "complete log" {
		t.Fatalf("archive includes its own output: %v", files)
	}
	entries, err := os.ReadDir(root)
	if err != nil || len(entries) != 2 {
		t.Fatalf("temporary output retained: %v, %v", entries, err)
	}
}
