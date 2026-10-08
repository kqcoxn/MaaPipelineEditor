package install

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func digest(data []byte) string {
	hash := sha256.Sum256(data)
	return hex.EncodeToString(hash[:])
}

func TestControlledDownloadPreservesInstalledEnvironmentAndCanRetry(t *testing.T) {
	for _, mode := range []string{"download", "commit-boundary", "disconnect"} {
		t.Run(mode, func(t *testing.T) {
			dir := t.TempDir()
			oldBody, oldHash := fixture(t, "1.2.3")
			old := Manifest{Version: "1.2.3", MFWVersion: "5.13.0", ManagementProtocol: Protocol,
				Editor: Artifact{URL: "editor"}, Platforms: map[string]Platform{PlatformKey(): {Binary: Artifact{SHA256: oldHash}}}}
			fetch := func(_ context.Context, a Artifact, destination string) error {
				body := oldBody
				if a.URL == "editor" {
					body = editorFixture(t, old.Version)
				}
				return os.WriteFile(destination, body, 0600)
			}
			parts := []string{BinaryName(), "editor", "runtime", "mpe-install.json"}
			if err := installPartsWith(context.Background(), dir, old, io.Discard, parts, fetch); err != nil {
				t.Fatal(err)
			}
			body, hash := fixture(t, "1.2.4")
			editor := editorFixture(t, "1.2.4")
			started := make(chan struct{}, 1)
			server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path == "/bundle" && mode == "download" {
					_, _ = w.Write(body[:10])
					w.(http.Flusher).Flush()
					started <- struct{}{}
					<-r.Context().Done()
					return
				}
				if r.URL.Path == "/editor" {
					_, _ = w.Write(editor)
				} else {
					_, _ = w.Write(body)
				}
			}))
			defer server.Close()
			original := http.DefaultTransport
			http.DefaultTransport = server.Client().Transport
			defer func() { http.DefaultTransport = original }()
			m := old
			m.Version = "1.2.4"
			m.Editor = Artifact{URL: server.URL + "/editor"}
			m.Platforms = map[string]Platform{PlatformKey(): {Binary: Artifact{SHA256: hash}, Bundle: Artifact{URL: server.URL + "/bundle"}}}
			// Supply the same valid SHA256 metadata used by release downloads.
			m.Editor.SHA256 = digest(editor)
			platform := m.Platforms[PlatformKey()]
			platform.Bundle.SHA256 = digest(body)
			m.Platforms[PlatformKey()] = platform
			parent, stop := context.WithTimeout(context.Background(), 5*time.Second)
			defer stop()
			input, writer := io.Pipe()
			defer input.Close()
			defer writer.Close()
			ready := make(chan struct{}, 1)
			output := phaseWriter(func(p []byte) (int, error) {
				if strings.Contains(string(p), "ready_to_install") {
					ready <- struct{}{}
				}
				return len(p), nil
			})
			ctx, cancel := WithDownloadControl(parent, input, output)
			defer cancel()
			done := make(chan error, 1)
			go func() { done <- Install(ctx, dir, m, true, output) }()
			boundary := ready
			if mode == "download" {
				boundary = started
			}
			select {
			case <-boundary:
			case err := <-done:
				t.Fatalf("installer exited before cancellation boundary: %v", err)
			case <-parent.Done():
				t.Fatal("installer did not reach cancellation boundary")
			}
			installedBinary, err := os.ReadFile(filepath.Join(dir, BinaryName()))
			if err != nil || string(installedBinary) != "1.2.3" {
				t.Fatal("replaced files before approval", err)
			}
			if mode == "disconnect" {
				_ = writer.Close()
			} else {
				_, _ = io.WriteString(writer, "cancel\n")
			}
			if err := <-done; err != context.Canceled {
				t.Fatalf("expected clean cancellation, got %v", err)
			}
			if current := Inspect(dir, true); !current.Ready || current.Version != "1.2.3" {
				t.Fatalf("old environment lost: %+v", current)
			}
			if exists(filepath.Join(dir, ".mpe-transaction")) {
				t.Fatal("cancelled transaction was not cleaned")
			}

			// Retry with a fresh control channel and explicitly approve commit.
			retryInput, retryWriter := io.Pipe()
			defer retryInput.Close()
			defer retryWriter.Close()
			retryCtx, retryCancel := WithDownloadControl(parent, retryInput, output)
			defer retryCancel()
			retryFetch := func(_ context.Context, a Artifact, destination string) error {
				data := body
				if a.URL == m.Editor.URL {
					data = editor
				}
				return os.WriteFile(destination, data, 0600)
			}
			go func() { done <- installPartsWith(retryCtx, dir, m, output, parts, retryFetch) }()
			select {
			case <-ready:
			case <-parent.Done():
				t.Fatal("retry did not reach commit boundary")
			}
			_, _ = io.WriteString(retryWriter, "install\n")
			if err := <-done; err != nil {
				t.Fatal(err)
			}
			if current := Inspect(dir, true); !current.Ready || current.Version != "1.2.4" {
				t.Fatalf("retry failed: %+v", current)
			}
		})
	}
}
