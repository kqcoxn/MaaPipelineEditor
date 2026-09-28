package server

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/eventbus"
)

func TestArchiveDownloadIsCompleteOriginCheckedAndSingleUse(t *testing.T) {
	s := NewWebSocketServer("127.0.0.1", 0, eventbus.New(), []string{"https://mpe.codax.site"})
	c := newConnection("test", nil, s)
	defer c.closeDone()
	data := bytes.Repeat([]byte("archive data\n"), 100000)
	path, err := c.PrepareDownload("logs.zip", func(w io.Writer) error { _, err := w.Write(data); return err })
	if err != nil {
		t.Fatal(err)
	}
	value, _ := s.downloads.Load(path)
	file := value.(*archiveDownload).path
	for _, test := range []struct {
		origin, method string
		status         int
	}{
		{"https://untrusted.example", "GET", http.StatusForbidden},
		{"https://mpe.codax.site", "POST", http.StatusMethodNotAllowed},
		{"https://mpe.codax.site", "GET", http.StatusOK},
		{"https://mpe.codax.site", "GET", http.StatusNotFound},
	} {
		r := httptest.NewRequest(test.method, path, nil)
		r.Header.Set("Origin", test.origin)
		w := httptest.NewRecorder()
		s.handleDownload(w, r)
		if w.Code != test.status {
			t.Fatalf("status = %d, want %d", w.Code, test.status)
		}
		if test.status == http.StatusOK {
			if !bytes.Equal(w.Body.Bytes(), data) {
				t.Fatal("archive was truncated")
			}
			if w.Header().Get("Access-Control-Allow-Origin") != test.origin || w.Header().Get("Content-Length") != fmt.Sprint(len(data)) {
				t.Fatal("invalid download headers")
			}
		}
	}
	if _, err := os.Stat(file); !os.IsNotExist(err) {
		t.Fatalf("temporary archive retained: %v", err)
	}
}

func TestArchiveDownloadCleansUpOnDisconnectAndCancelsBuild(t *testing.T) {
	s := NewWebSocketServer("127.0.0.1", 0, eventbus.New(), nil)
	c := newConnection("test", nil, s)
	path, err := c.PrepareDownload("logs.zip", func(w io.Writer) error { _, err := w.Write([]byte("data")); return err })
	if err != nil {
		t.Fatal(err)
	}
	value, _ := s.downloads.Load(path)
	file := value.(*archiveDownload).path
	c.closeDone()
	deadline := time.Now().Add(2 * time.Second)
	for {
		if _, err := os.Stat(file); os.IsNotExist(err) {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("disconnected download was not removed")
		}
		time.Sleep(10 * time.Millisecond)
	}
	if _, exists := s.downloads.Load(path); exists {
		t.Fatal("ticket retained")
	}
	if _, err := c.PrepareDownload("logs.zip", func(w io.Writer) error { _, err := w.Write([]byte("data")); return err }); err == nil {
		t.Fatal("build ignored disconnect")
	}
}

func TestArchiveDownloadCancellationDeletesTemporaryFile(t *testing.T) {
	s := NewWebSocketServer("127.0.0.1", 0, eventbus.New(), nil)
	c := newConnection("test", nil, s)
	defer c.closeDone()
	path, err := c.PrepareDownload("logs.zip", func(w io.Writer) error { _, err := w.Write([]byte("data")); return err })
	if err != nil {
		t.Fatal(err)
	}
	value, _ := s.downloads.Load(path)
	w := httptest.NewRecorder()
	s.handleDownload(w, httptest.NewRequest(http.MethodDelete, path, nil))
	if w.Code != http.StatusNoContent {
		t.Fatalf("status = %d", w.Code)
	}
	if _, err := os.Stat(value.(*archiveDownload).path); !os.IsNotExist(err) {
		t.Fatalf("temporary archive retained: %v", err)
	}
}
