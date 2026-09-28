package server

import (
	"crypto/rand"
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
	"time"
)

const downloadPrefix = "/diagnostics/"

type archiveDownload struct {
	path  string
	name  string
	taken chan struct{}
}

type connectedWriter struct {
	connection  *Connection
	destination *os.File
}

func (w connectedWriter) Name() string { return w.destination.Name() }

func (w connectedWriter) Write(data []byte) (int, error) {
	select {
	case <-w.connection.Done():
		return 0, fmt.Errorf("日志导出连接已断开")
	default:
		return w.destination.Write(data)
	}
}

// PrepareDownload keeps bulk data out of WebSocket/JSON. Each ticket can be
// consumed once and its temporary file is removed on completion or disconnect.
func (c *Connection) PrepareDownload(name string, build func(io.Writer) error) (string, error) {
	if !c.exporting.CompareAndSwap(false, true) {
		return "", fmt.Errorf("正在打包日志，请等待完成")
	}
	defer c.exporting.Store(false)
	f, err := os.CreateTemp("", "mpe-diagnostics-*.zip")
	if err != nil {
		return "", err
	}
	keep := false
	defer func() {
		f.Close()
		if !keep {
			os.Remove(f.Name())
		}
	}()
	if err := build(connectedWriter{c, f}); err != nil {
		return "", err
	}
	if err := f.Close(); err != nil {
		return "", err
	}
	path := downloadPrefix + rand.Text()
	download := &archiveDownload{path: f.Name(), name: name, taken: make(chan struct{})}
	c.server.downloads.Store(path, download)
	keep = true
	go func() {
		timer := time.NewTimer(30 * time.Minute)
		defer timer.Stop()
		select {
		case <-download.taken:
			return
		case <-c.Done():
		case <-c.server.done:
		case <-timer.C:
		}
		if _, owned := c.server.downloads.LoadAndDelete(path); owned {
			os.Remove(download.path)
		}
	}()
	return path, nil
}

func (s *WebSocketServer) handleDownload(w http.ResponseWriter, r *http.Request) {
	if !s.originAllowed(r.Header.Get("Origin")) {
		http.Error(w, "origin forbidden", http.StatusForbidden)
		return
	}
	if origin := r.Header.Get("Origin"); origin != "" {
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Vary", "Origin")
	}
	if r.Method != http.MethodGet && r.Method != http.MethodDelete {
		w.Header().Set("Allow", "GET, DELETE")
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	value, ok := s.downloads.LoadAndDelete(r.URL.Path)
	if !ok {
		http.NotFound(w, r)
		return
	}
	download := value.(*archiveDownload)
	close(download.taken)
	defer os.Remove(download.path)
	if r.Method == http.MethodDelete {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	f, err := os.Open(download.path)
	if err != nil {
		http.Error(w, "archive unavailable", http.StatusInternalServerError)
		return
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil {
		http.Error(w, "archive unavailable", http.StatusInternalServerError)
		return
	}
	// The server's normal 10-second write deadline is unsuitable for large downloads.
	_ = http.NewResponseController(w).SetWriteDeadline(time.Time{})
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": download.name}))
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Content-Length", fmt.Sprint(info.Size()))
	_, _ = io.Copy(w, f)
}
