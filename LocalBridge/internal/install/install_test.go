package install

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/managed"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

type phaseWriter func([]byte) (int, error)

func (w phaseWriter) Write(p []byte) (int, error) { return w(p) }

func TestFinalValidationRollsBackReplacedResources(t *testing.T) {
	dir := t.TempDir()
	body, binaryHash := fixture(t, "1.2.3")
	m := Manifest{Version: "1.2.3", MFWVersion: "5.13.0", ManagementProtocol: Protocol, Editor: Artifact{URL: "editor"}, Platforms: map[string]Platform{PlatformKey(): {Binary: Artifact{SHA256: binaryHash}}}}
	fetch := func(_ context.Context, a Artifact, destination string) error {
		if a.URL == "editor" {
			return os.WriteFile(destination, editorFixture(t, m.Version), 0600)
		}
		return os.WriteFile(destination, body, 0600)
	}
	parts := []string{BinaryName(), "editor", "runtime", "mpe-install.json"}
	if err := installPartsWith(context.Background(), dir, m, io.Discard, parts, fetch); err != nil {
		t.Fatal(err)
	}
	body, binaryHash = fixture(t, "1.2.4")
	m.Version = "1.2.4"
	m.Platforms[PlatformKey()] = Platform{Binary: Artifact{SHA256: binaryHash}}
	writer := phaseWriter(func(p []byte) (int, error) {
		if strings.Contains(string(p), `"phase":"validating"`) {
			if err := os.WriteFile(filepath.Join(dir, "editor/mpe-build.json"), []byte(`{"version":"damaged"}`), 0600); err != nil {
				t.Fatal(err)
			}
		}
		return len(p), nil
	})
	if err := installPartsWith(context.Background(), dir, m, writer, parts, fetch); err == nil {
		t.Fatal("accepted corruption after replacement")
	}
	if restored := Inspect(dir, true); !restored.Ready || restored.Version != "1.2.3" {
		t.Fatalf("previous environment not restored: %+v", restored)
	}
}

func fixture(t *testing.T, version string) ([]byte, string) {
	t.Helper()
	var buffer bytes.Buffer
	archive := zip.NewWriter(&buffer)
	library := "libMaaFramework.so"
	if runtime.GOOS == "windows" {
		library = "MaaFramework.dll"
	} else if runtime.GOOS == "darwin" {
		library = "libMaaFramework.dylib"
	}
	files := map[string]string{BinaryName(): version, "runtime/maafw/.version": "5.13.0", "runtime/maafw/bin/" + library: "runtime", "runtime/maafw/share/MaaAgentBinary/agent": "agent", "runtime/resource/model/ocr/det.onnx": "model", "runtime/resource/model/ocr/rec.onnx": "model", "runtime/resource/model/ocr/keys.txt": "keys"}
	for name, data := range files {
		w, err := archive.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		_, _ = io.WriteString(w, data)
	}
	if err := archive.Close(); err != nil {
		t.Fatal(err)
	}
	hash := sha256.Sum256([]byte(version))
	return buffer.Bytes(), hex.EncodeToString(hash[:])
}
func TestInstallPairAndRejectCorruptDownload(t *testing.T) {
	dir := t.TempDir()
	body, binaryHash := fixture(t, "1.2.3")
	editorBody := editorFixture(t, "1.2.3")
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/editor" {
			_, _ = w.Write(editorBody)
			return
		}
		_, _ = w.Write(body)
	}))
	defer server.Close()
	original := http.DefaultTransport
	http.DefaultTransport = server.Client().Transport
	defer func() { http.DefaultTransport = original }()
	hash := sha256.Sum256(body)
	editorHash := sha256.Sum256(editorBody)
	m := Manifest{Version: "1.2.3", MFWVersion: "5.13.0", ManagementProtocol: 1, Editor: Artifact{server.URL + "/editor", hex.EncodeToString(editorHash[:])}, Platforms: map[string]Platform{PlatformKey(): {Bundle: Artifact{server.URL, hex.EncodeToString(hash[:])}, Binary: Artifact{SHA256: binaryHash}}}}
	if err := Install(context.Background(), dir, m, true, io.Discard); err != nil {
		t.Fatal(err)
	}
	if env := Inspect(dir, true); !env.Ready || env.Version != "1.2.3" {
		t.Fatalf("invalid installed pair: %+v", env)
	}
	cli := t.TempDir()
	validEditor := editorBody
	editorBody = []byte("corrupt editor")
	if err := Install(context.Background(), cli, m, false, io.Discard); err != nil {
		t.Fatalf("CLI install depended on Editor download: %v", err)
	}
	if exists(filepath.Join(cli, "editor")) || !Inspect(cli, false).Ready {
		t.Fatal("CLI install contains Editor or is not ready")
	}
	if err := Install(context.Background(), cli, m, true, io.Discard); err == nil {
		t.Fatal("accepted corrupt Editor download")
	}
	if exists(filepath.Join(cli, "editor")) || !Inspect(cli, false).Ready {
		t.Fatal("failed Editor download changed the CLI installation")
	}
	editorBody = validEditor
	body = []byte("corrupt update")
	if err := Install(context.Background(), dir, m, true, io.Discard); err == nil {
		t.Fatal("accepted corrupt download")
	}
	data, _ := os.ReadFile(filepath.Join(dir, BinaryName()))
	if string(data) != "1.2.3" {
		t.Fatal("corrupt update replaced active binary")
	}
	if exists(filepath.Join(dir, ".mpe-transaction")) {
		t.Fatal("failed download left incomplete transaction")
	}
	lock, err := managed.InstallationLock(dir, true)
	if err != nil {
		t.Fatal(err)
	}
	if err := Install(context.Background(), dir, m, true, io.Discard); err == nil {
		t.Fatal("installed while service held resources")
	}
	lock.Close()
}
func TestInspectRejectsMismatchedEditor(t *testing.T) {
	dir := t.TempDir()
	_ = os.MkdirAll(filepath.Join(dir, "editor"), 0755)
	_ = os.WriteFile(filepath.Join(dir, "editor/mpe-build.json"), []byte(`{"version":"wrong"}`), 0600)
	_ = writeJSON(filepath.Join(dir, "mpe-install.json"), Manifest{Version: "1.2.3"})
	environment := Inspect(dir, true)
	if environment.Ready {
		t.Fatal("mismatched editor accepted")
	}
}
