package install

import (
	"archive/zip"
	"context"
	"io"
	"os"
	"path/filepath"
	"testing"
)

func TestRuntimeLookupExcludesMacDebugSymbols(t *testing.T) {
	dir := t.TempDir()
	name := "libMaaFramework.dylib"
	for _, parent := range []string{"bin", "symbols/libMaaFramework.dylib.dSYM/Contents/Resources/DWARF"} {
		if err := os.MkdirAll(filepath.Join(dir, parent), 0755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(dir, parent, name), []byte("fixture"), 0644); err != nil {
			t.Fatal(err)
		}
	}
	found, err := findFile(dir, name)
	if err != nil || found != filepath.Join(dir, "bin", name) {
		t.Fatalf("selected debug symbols: %s %v", found, err)
	}
}

func TestPackageEditorValidatesVersionAndCreatesIndependentArchive(t *testing.T) {
	dir := t.TempDir()
	source := filepath.Join(dir, "source.zip")
	if err := os.WriteFile(source, editorFixture(t, "2.0.0"), 0600); err != nil {
		t.Fatal(err)
	}
	artifact, err := packageEditor(source, filepath.Join(dir, "stage"), dir, "2.0.0")
	if err != nil {
		t.Fatal(err)
	}
	archive := filepath.Join(dir, "mpe-editor.zip")
	hash, err := fileHash(archive)
	if err != nil || artifact.SHA256 != hash || artifact.URL != Repository+"/download/v2.0.0/mpe-editor.zip" {
		t.Fatalf("invalid artifact: %+v %v", artifact, err)
	}
	r, err := zip.OpenReader(archive)
	if err != nil {
		t.Fatal(err)
	}
	defer r.Close()
	if len(r.File) != 2 {
		t.Fatalf("unexpected editor contents: %v", r.File)
	}
	for _, file := range r.File {
		if file.Name != "index.html" && file.Name != "mpe-build.json" {
			t.Fatalf("unexpected entry: %s", file.Name)
		}
	}
	if _, err := packageEditor(source, filepath.Join(dir, "bad-stage"), dir, "2.0.1"); err == nil {
		t.Fatal("packaged mismatched Editor")
	}
}

func TestLocalDesktopPreparationInstallsBothComponents(t *testing.T) {
	dir := t.TempDir()
	source := t.TempDir()
	body, _ := fixture(t, "2.0.0")
	archive := filepath.Join(t.TempDir(), "source.zip")
	if err := os.WriteFile(archive, body, 0600); err != nil {
		t.Fatal(err)
	}
	if err := extract(archive, source); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(archive, editorFixture(t, "2.0.0"), 0600); err != nil {
		t.Fatal(err)
	}
	editor := filepath.Join(source, "editor")
	if err := extract(archive, editor); err != nil {
		t.Fatal(err)
	}
	if err := InstallLocal(context.Background(), dir, filepath.Join(source, BinaryName()), editor, filepath.Join(source, "runtime"), "2.0.0", "5.13.0", 1, io.Discard); err != nil {
		t.Fatal(err)
	}
	if env := Inspect(dir, true); !env.Ready {
		t.Fatalf("local desktop environment not ready: %+v", env)
	}
}
