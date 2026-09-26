package install

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"math"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"
)

func TestDownloadReportsBeforeTransferCompletes(t *testing.T) {
	for _, knownSize := range []bool{true, false} {
		name := "unknown size"
		if knownSize {
			name = "known size"
		}
		t.Run(name, func(t *testing.T) {
			allowFinish := make(chan struct{})
			var once sync.Once
			server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if knownSize {
					w.Header().Set("Content-Length", "6")
				}
				_, _ = w.Write([]byte("abc"))
				w.(http.Flusher).Flush()
				select {
				case <-allowFinish:
					_, _ = w.Write([]byte("def"))
				case <-r.Context().Done():
				}
			}))
			defer server.Close()
			original := http.DefaultTransport
			http.DefaultTransport = server.Client().Transport
			defer func() { http.DefaultTransport = original }()
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			hash := sha256.Sum256([]byte("abcdef"))
			destination := filepath.Join(t.TempDir(), "bundle.zip")
			var events []DownloadProgress
			err := downloadWithProgress(ctx, Artifact{server.URL, hex.EncodeToString(hash[:])}, destination, func(p DownloadProgress) {
				events = append(events, p)
				if p.Downloaded == 3 {
					once.Do(func() { close(allowFinish) })
				}
			})
			if err != nil {
				t.Fatal(err)
			}
			data, err := os.ReadFile(destination)
			if err != nil || string(data) != "abcdef" {
				t.Fatalf("download corrupted: %q, %v", data, err)
			}
			live := false
			for _, event := range events {
				if event.Downloaded == 3 && event.BytesPerSecond > 0 {
					live = true
				}
				if math.IsNaN(event.BytesPerSecond) || math.IsInf(event.BytesPerSecond, 0) {
					t.Fatalf("invalid speed: %+v", event)
				}
			}
			if len(events) < 3 || events[0].Downloaded != 0 || !live {
				t.Fatalf("missing live transfer progress: %+v", events)
			}
			last := events[len(events)-1]
			wantTotal := int64(0)
			if knownSize {
				wantTotal = 6
			}
			if last.Downloaded != 6 || last.Total != wantTotal {
				t.Fatalf("incorrect final counters: %+v", last)
			}
		})
	}
}

func TestDownloadReportsWhileWaitingAndStopsOnCancellation(t *testing.T) {
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { <-r.Context().Done() }))
	defer server.Close()
	original := http.DefaultTransport
	http.DefaultTransport = server.Client().Transport
	defer func() { http.DefaultTransport = original }()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var events []DownloadProgress
	err := downloadWithProgress(ctx, Artifact{server.URL, string(make([]byte, 64))}, filepath.Join(t.TempDir(), "bundle.zip"), func(p DownloadProgress) {
		events = append(events, p)
		if p.ElapsedSeconds >= 1 {
			cancel()
		}
	})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected callback cancellation, got %v", err)
	}
	if len(events) < 2 {
		t.Fatalf("no waiting updates: %+v", events)
	}
	for _, p := range events {
		if p.Downloaded != 0 || p.Total != 0 || p.BytesPerSecond != 0 {
			t.Fatalf("invented download progress: %+v", p)
		}
	}
}
