package install

import (
	"context"
	"encoding/json"
	"io"
	"path/filepath"
	"sync/atomic"
	"time"
)

// Total is zero when the server does not provide a download size.
type DownloadProgress struct {
	Downloaded     int64   `json:"downloaded"`
	Total          int64   `json:"total"`
	BytesPerSecond float64 `json:"bytesPerSecond"`
	ElapsedSeconds int64   `json:"elapsedSeconds"`
}

type ProgressEvent struct {
	Phase    string `json:"phase"`
	Version  string `json:"version"`
	Artifact string `json:"artifact,omitempty"`
	*DownloadProgress
}

type downloadProgress struct {
	downloaded atomic.Int64
	total      atomic.Int64
	stop       chan struct{}
	done       chan struct{}
}

func newDownloadProgress(report func(DownloadProgress)) *downloadProgress {
	p := &downloadProgress{stop: make(chan struct{}), done: make(chan struct{})}
	if report == nil {
		close(p.done)
		return p
	}
	report(DownloadProgress{})
	go func() {
		defer close(p.done)
		start := time.Now()
		last, previous := start, int64(0)
		emit := func() {
			now, downloaded := time.Now(), p.downloaded.Load()
			speed := float64(0)
			if seconds := now.Sub(last).Seconds(); seconds > 0 {
				speed = float64(downloaded-previous) / seconds
			}
			report(DownloadProgress{downloaded, p.total.Load(), speed, int64(now.Sub(start).Seconds())})
			last, previous = now, downloaded
		}
		ticker := time.NewTicker(time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				emit()
			case <-p.stop:
				emit()
				return
			}
		}
	}()
	return p
}

func (p *downloadProgress) Write(data []byte) (int, error) {
	p.downloaded.Add(int64(len(data)))
	return len(data), nil
}

func (p *downloadProgress) close() {
	close(p.stop)
	<-p.done // Finish reporting before the next install phase or error is emitted.
}

func progressDownloader(output io.Writer, version string) func(context.Context, Artifact, string) error {
	return func(ctx context.Context, artifact Artifact, destination string) error {
		name := "bundle"
		if filepath.Base(destination) == "editor.zip" {
			name = "editor"
		}
		return downloadWithProgress(ctx, artifact, destination, func(p DownloadProgress) {
			_ = json.NewEncoder(output).Encode(ProgressEvent{"downloading", version, name, &p})
		})
	}
}
