package install

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func editorFixture(t *testing.T, version string) []byte {
	t.Helper()
	var buffer bytes.Buffer
	w := zip.NewWriter(&buffer)
	build, _ := json.Marshal(map[string]string{"version": version})
	for name, data := range map[string]string{"index.html": "editor " + version, "mpe-build.json": string(build)} {
		entry, err := w.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := io.WriteString(entry, data); err != nil {
			t.Fatal(err)
		}
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	return buffer.Bytes()
}

func TestCLIInstallThenDesktopAndCLIUpgrade(t *testing.T) {
	dir := t.TempDir()
	version := "1.2.3"
	editorDownloads := 0
	run := func(withEditor bool, writer io.Writer) error {
		body, hash := fixture(t, version)
		m := Manifest{Version: version, MFWVersion: "5.13.0", ManagementProtocol: Protocol,
			Editor: Artifact{URL: "editor"}, Platforms: map[string]Platform{PlatformKey(): {Binary: Artifact{SHA256: hash}}}}
		parts := []string{BinaryName(), "runtime", "mpe-install.json"}
		if withEditor {
			parts = append(parts, "editor")
		}
		return installPartsWith(context.Background(), dir, m, writer, parts, func(_ context.Context, a Artifact, destination string) error {
			if a.URL == "editor" {
				editorDownloads++
				return os.WriteFile(destination, editorFixture(t, version), 0600)
			}
			return os.WriteFile(destination, body, 0600)
		})
	}
	if err := run(false, io.Discard); err != nil {
		t.Fatal(err)
	}
	if editorDownloads != 0 || exists(filepath.Join(dir, "editor")) {
		t.Fatal("CLI downloaded or installed Editor")
	}
	if e := Inspect(dir, false); !e.Ready {
		t.Fatalf("CLI environment not ready: %+v", e)
	}
	if Inspect(dir, true).Ready {
		t.Fatal("Desktop accepted a CLI-only environment")
	}
	version = "1.2.4"
	if err := run(false, io.Discard); err != nil {
		t.Fatal(err)
	}
	if editorDownloads != 0 {
		t.Fatal("CLI upgrade downloaded Editor")
	}
	if err := run(true, io.Discard); err != nil {
		t.Fatal(err)
	}
	if editorDownloads != 1 || !Inspect(dir, true).Ready {
		t.Fatal("Desktop did not add the matching Editor")
	}
	version = "1.2.5"
	if err := run(false, io.Discard); err != nil {
		t.Fatal(err)
	}
	if editorDownloads != 2 || !Inspect(dir, true).Ready {
		t.Fatal("CLI upgrade broke an existing Desktop pair")
	}
	// A partial switch from CLI to Desktop must not leave an Editor behind.
	cliDir := t.TempDir()
	dir = cliDir
	if err := run(false, io.Discard); err != nil {
		t.Fatal(err)
	}
	writer := phaseWriter(func(p []byte) (int, error) {
		if strings.Contains(string(p), `"phase":"validating"`) {
			if err := os.WriteFile(filepath.Join(dir, "editor/mpe-build.json"), []byte(`{}`), 0600); err != nil {
				t.Fatal(err)
			}
		}
		return len(p), nil
	})
	if err := run(true, writer); err == nil {
		t.Fatal("accepted corrupt Editor")
	}
	if exists(filepath.Join(dir, "editor")) || !Inspect(dir, false).Ready {
		t.Fatal("failed desktop install did not restore CLI environment")
	}
}

func TestDependencyRepairDoesNotDownloadOrRequireEditor(t *testing.T) {
	for _, desktop := range []bool{false, true} {
		t.Run(fmt.Sprint(desktop), func(t *testing.T) {
			dir := t.TempDir()
			body, hash := fixture(t, "1.2.3")
			m := Manifest{Version: "1.2.3", MFWVersion: "5.13.0", ManagementProtocol: Protocol,
				Editor: Artifact{URL: "editor"}, Platforms: map[string]Platform{PlatformKey(): {Binary: Artifact{SHA256: hash}}}}
			fetch := func(_ context.Context, a Artifact, destination string) error {
				if a.URL == "editor" {
					t.Fatal("dependency repair requested Editor")
				}
				return os.WriteFile(destination, body, 0600)
			}
			if err := installPartsWith(context.Background(), dir, m, io.Discard, []string{BinaryName(), "runtime", "mpe-install.json"}, fetch); err != nil {
				t.Fatal(err)
			}
			if desktop {
				// Repair must not depend on Editor being intact or matching.
				if err := os.MkdirAll(filepath.Join(dir, "editor"), 0755); err != nil {
					t.Fatal(err)
				}
				if err := os.WriteFile(filepath.Join(dir, "editor/index.html"), []byte("keep"), 0600); err != nil {
					t.Fatal(err)
				}
			}
			for _, part := range []string{"runtime/maafw", "runtime/resource/model/ocr", "runtime"} {
				if err := os.RemoveAll(filepath.Join(dir, part)); err != nil {
					t.Fatal(err)
				}
				if err := installPartsWith(context.Background(), dir, m, io.Discard, []string{part}, fetch); err != nil {
					t.Fatal(err)
				}
				if !Inspect(dir, false).Ready {
					t.Fatal("repair did not restore runtime")
				}
			}
			if desktop {
				data, _ := os.ReadFile(filepath.Join(dir, "editor/index.html"))
				if string(data) != "keep" {
					t.Fatal("repair modified Editor")
				}
			}
		})
	}
}

func TestInspectCLIAllowsMissingOrMismatchedEditor(t *testing.T) {
	dir := t.TempDir()
	body, hash := fixture(t, "1.2.3")
	archive := filepath.Join(t.TempDir(), "core.zip")
	if err := os.WriteFile(archive, body, 0600); err != nil {
		t.Fatal(err)
	}
	if err := extract(archive, dir); err != nil {
		t.Fatal(err)
	}
	m := Manifest{Version: "1.2.3", MFWVersion: "5.13.0", ManagementProtocol: Protocol, Platforms: map[string]Platform{PlatformKey(): {Binary: Artifact{SHA256: hash}}}}
	if err := writeJSON(filepath.Join(dir, "mpe-install.json"), m); err != nil {
		t.Fatal(err)
	}
	for _, version := range []string{"", "wrong"} {
		if version != "" {
			if err := os.WriteFile(archive, editorFixture(t, version), 0600); err != nil {
				t.Fatal(err)
			}
			if err := extract(archive, filepath.Join(dir, "editor")); err != nil {
				t.Fatal(err)
			}
		}
		if !Inspect(dir, false).Ready {
			t.Fatal("CLI check requires Editor")
		}
		if Inspect(dir, true).Ready {
			t.Fatal("Desktop check accepted missing or mismatched Editor")
		}
	}
}
