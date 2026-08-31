package file

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/fsnotify/fsnotify"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
)

type watcherBackend interface {
	Add(string) error
	Close() error
	Events() <-chan fsnotify.Event
	Errors() <-chan error
}

type fsnotifyBackend struct {
	watcher *fsnotify.Watcher
}

func (b *fsnotifyBackend) Add(path string) error { return b.watcher.Add(path) }

func (b *fsnotifyBackend) Close() error { return b.watcher.Close() }

func (b *fsnotifyBackend) Events() <-chan fsnotify.Event { return b.watcher.Events }

func (b *fsnotifyBackend) Errors() <-chan error { return b.watcher.Errors }

func (w *Watcher) handleRegistrations() {
	defer w.workers.Done()
	for {
		registration, ok := w.registrations.next(w.stopCh)
		if !ok {
			return
		}
		err := w.registerDirectoryTree(registration.root)
		if registration.result != nil {
			registration.result <- err
			continue
		}
		if err != nil {
			logger.Error("FileWatcher", "添加目录监听失败: %s, %v", registration.root, err)
		}
	}
}

func (w *Watcher) registerDirectoryTree(root string) error {
	return filepath.WalkDir(root, func(path string, entry os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !entry.IsDir() {
			return nil
		}
		if w.allowDir != nil && !w.allowDir(path) {
			return filepath.SkipDir
		}

		path = filepath.Clean(path)
		w.watchedMu.Lock()
		_, exists := w.watchedDirs[path]
		w.watchedMu.Unlock()
		if exists {
			return nil
		}
		if err := w.backend.Add(path); err != nil {
			return fmt.Errorf("添加目录监听失败 %s: %w", path, err)
		}
		w.watchedMu.Lock()
		w.watchedDirs[path] = struct{}{}
		w.watchedMu.Unlock()
		return nil
	})
}

func (w *Watcher) forgetWatchedTree(root string) {
	root = filepath.Clean(root)
	prefix := root + string(filepath.Separator)
	w.watchedMu.Lock()
	defer w.watchedMu.Unlock()
	for path := range w.watchedDirs {
		if path == root || strings.HasPrefix(path, prefix) {
			delete(w.watchedDirs, path)
		}
	}
}

type directoryRegistration struct {
	root   string
	result chan<- error
}

type directoryRegistrationQueue struct {
	mu      sync.Mutex
	pending []directoryRegistration
	wake    chan struct{}
	closed  bool
}

func newDirectoryRegistrationQueue() *directoryRegistrationQueue {
	return &directoryRegistrationQueue{wake: make(chan struct{}, 1)}
}

func (q *directoryRegistrationQueue) enqueue(registration directoryRegistration) bool {
	q.mu.Lock()
	if q.closed {
		q.mu.Unlock()
		return false
	}
	q.pending = append(q.pending, registration)
	q.mu.Unlock()

	select {
	case q.wake <- struct{}{}:
	default:
	}
	return true
}

func (q *directoryRegistrationQueue) next(stop <-chan struct{}) (directoryRegistration, bool) {
	for {
		q.mu.Lock()
		if len(q.pending) > 0 {
			registration := q.pending[0]
			q.pending[0] = directoryRegistration{}
			q.pending = q.pending[1:]
			q.mu.Unlock()
			return registration, true
		}
		closed := q.closed
		q.mu.Unlock()
		if closed {
			return directoryRegistration{}, false
		}

		select {
		case <-q.wake:
		case <-stop:
			return directoryRegistration{}, false
		}
	}
}

func (q *directoryRegistrationQueue) close() {
	q.mu.Lock()
	q.closed = true
	q.pending = nil
	q.mu.Unlock()
	select {
	case q.wake <- struct{}{}:
	default:
	}
}
