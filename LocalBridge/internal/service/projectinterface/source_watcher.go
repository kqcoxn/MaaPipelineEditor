package projectinterface

import (
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
)

type sourceWatcher struct {
	mu          sync.Mutex
	watcher     *fsnotify.Watcher
	watchedDirs map[string]string
	sources     map[string]bool
	timer       *time.Timer
	onChange    func()
	closed      bool
}

func newSourceWatcher(onChange func()) (*sourceWatcher, error) {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, err
	}
	result := &sourceWatcher{
		watcher: watcher, watchedDirs: map[string]string{}, sources: map[string]bool{}, onChange: onChange,
	}
	go result.run()
	return result, nil
}

func (w *sourceWatcher) Update(paths []string) {
	sources := make(map[string]bool, len(paths))
	dirs := map[string]string{}
	for _, path := range paths {
		if strings.TrimSpace(path) == "" {
			continue
		}
		cleaned := filepath.Clean(path)
		sources[normalizedPathKey(cleaned)] = true
		dir := filepath.Dir(cleaned)
		dirs[normalizedPathKey(dir)] = dir
	}

	w.mu.Lock()
	defer w.mu.Unlock()
	if w.closed {
		return
	}
	for key, dir := range dirs {
		if _, exists := w.watchedDirs[key]; exists {
			continue
		}
		if err := w.watcher.Add(dir); err != nil {
			logger.Warn("ProjectInterface", "监听 PI 来源目录失败: %s: %v", dir, err)
			continue
		}
		w.watchedDirs[key] = dir
	}
	for key, dir := range w.watchedDirs {
		if _, keep := dirs[key]; keep {
			continue
		}
		_ = w.watcher.Remove(dir)
		delete(w.watchedDirs, key)
	}
	w.sources = sources
}

func (w *sourceWatcher) Close() {
	w.mu.Lock()
	if w.closed {
		w.mu.Unlock()
		return
	}
	w.closed = true
	if w.timer != nil {
		w.timer.Stop()
	}
	w.mu.Unlock()
	_ = w.watcher.Close()
}

func (w *sourceWatcher) run() {
	for {
		select {
		case event, ok := <-w.watcher.Events:
			if !ok {
				return
			}
			if event.Op&(fsnotify.Write|fsnotify.Create|fsnotify.Remove|fsnotify.Rename) != 0 {
				w.handleEvent(event.Name)
			}
		case err, ok := <-w.watcher.Errors:
			if !ok {
				return
			}
			logger.Warn("ProjectInterface", "PI 文件监听失败: %v", err)
		}
	}
}

func (w *sourceWatcher) handleEvent(path string) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.closed || !w.sources[normalizedPathKey(path)] {
		return
	}
	if w.timer != nil {
		w.timer.Stop()
	}
	w.timer = time.AfterFunc(200*time.Millisecond, func() {
		w.mu.Lock()
		if w.closed {
			w.mu.Unlock()
			return
		}
		onChange := w.onChange
		w.mu.Unlock()
		if onChange != nil {
			onChange()
		}
	})
}

func normalizedPathKey(path string) string {
	return strings.ToLower(filepath.Clean(path))
}
