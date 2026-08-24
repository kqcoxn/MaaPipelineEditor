package utility

import (
	"archive/zip"
	"bytes"
	"os"
	"path/filepath"
	"sort"
	"testing"
)

func TestBuildMFWLogArchiveUsesMFAAFileLayout(t *testing.T) {
	logDir := t.TempDir()
	files := map[string]string{
		"maafw.log":           "framework log",
		"maafw.log.1":         "previous framework log",
		"custom.log":          "custom log",
		"on_error/failed.png": "png",
		"vision/frame.webp":   "webp",
		"captures/other.jpeg": "jpeg",
		"lb-2026-08-25.log":   "localbridge log",
		"captures/ignore.txt": "not part of an MFAA log package",
	}
	for relativePath, content := range files {
		path := filepath.Join(logDir, filepath.FromSlash(relativePath))
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
	}

	archive, count, err := buildMFWLogArchive(logDir)
	if err != nil {
		t.Fatalf("buildMFWLogArchive() error = %v", err)
	}
	if count != 6 {
		t.Fatalf("buildMFWLogArchive() count = %d, want 6", count)
	}

	reader, err := zip.NewReader(bytes.NewReader(archive), int64(len(archive)))
	if err != nil {
		t.Fatalf("zip.NewReader() error = %v", err)
	}
	entryNames := make([]string, 0, len(reader.File))
	for _, file := range reader.File {
		entryNames = append(entryNames, file.Name)
	}
	sort.Strings(entryNames)
	want := []string{
		"debug/captures/other.jpeg",
		"debug/custom.log",
		"debug/maafw.log",
		"debug/maafw.log.1",
		"debug/on_error/failed.png",
		"debug/vision/frame.webp",
	}
	for index := range want {
		if entryNames[index] != want[index] {
			t.Fatalf("entryNames[%d] = %q, want %q", index, entryNames[index], want[index])
		}
	}
}

func TestBuildMFWLogArchiveRejectsEmptyDirectory(t *testing.T) {
	_, _, err := buildMFWLogArchive(t.TempDir())
	if err == nil {
		t.Fatal("buildMFWLogArchive() error = nil, want non-nil")
	}
}

func TestMPELogExcludedDirectory(t *testing.T) {
	tests := map[string]bool{
		"vision":   true,
		"VISION":   true,
		"on_error": true,
		"ON_ERROR": true,
		"logs":     false,
	}

	for name, want := range tests {
		if got := isMPELogExcludedDirectory(name); got != want {
			t.Errorf("isMPELogExcludedDirectory(%q) = %t, want %t", name, got, want)
		}
	}
}
