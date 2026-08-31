package file

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/fsnotify/fsnotify"
)

type fakeWatcherBackend struct {
	events chan fsnotify.Event
	errors chan error
	stop   chan struct{}

	mu      sync.Mutex
	added   []string
	addHook func(string)
	addErr  error
}

func newFakeWatcherBackend() *fakeWatcherBackend {
	return &fakeWatcherBackend{
		events: make(chan fsnotify.Event),
		errors: make(chan error),
		stop:   make(chan struct{}),
	}
}

func (b *fakeWatcherBackend) Add(path string) error {
	b.mu.Lock()
	b.added = append(b.added, path)
	hook := b.addHook
	b.mu.Unlock()
	if hook != nil {
		hook(path)
	}
	return b.addErr
}

func (b *fakeWatcherBackend) Close() error {
	select {
	case <-b.stop:
	default:
		close(b.stop)
	}
	return nil
}

func (b *fakeWatcherBackend) Events() <-chan fsnotify.Event { return b.events }

func (b *fakeWatcherBackend) Errors() <-chan error { return b.errors }

func (b *fakeWatcherBackend) addedPaths() []string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return append([]string(nil), b.added...)
}

func TestWatcherConsumesEventsBeforeInitialRegistration(t *testing.T) {
	root := t.TempDir()
	backend := newFakeWatcherBackend()
	backend.addHook = func(path string) {
		select {
		case backend.events <- fsnotify.Event{Name: filepath.Join(root, "during-start.json"), Op: fsnotify.Write}:
		case <-backend.stop:
		}
	}

	watcher := newWatcherWithBackend(root, []string{".json"}, nil, nil, backend)
	startDone := make(chan error, 1)
	go func() {
		startDone <- watcher.Start()
	}()

	select {
	case err := <-startDone:
		if err != nil {
			t.Fatalf("Start() error = %v", err)
		}
	case <-time.After(time.Second):
		t.Fatal("Start() blocked while Add waited for an event consumer")
	}
	watcher.Stop()
}

func TestWatcherKeepsConsumingEventsDuringDynamicRegistration(t *testing.T) {
	root := t.TempDir()
	createdDir := filepath.Join(root, "created")
	nestedDir := filepath.Join(createdDir, "nested")
	backend := newFakeWatcherBackend()
	dynamicAddDone := make(chan struct{})
	backend.addHook = func(path string) {
		if path != createdDir {
			return
		}
		select {
		case backend.events <- fsnotify.Event{Name: filepath.Join(createdDir, "nested.json"), Op: fsnotify.Write}:
			close(dynamicAddDone)
		case <-backend.stop:
		}
	}

	watcher := newWatcherWithBackend(root, []string{".json"}, nil, nil, backend)
	if err := watcher.Start(); err != nil {
		t.Fatalf("Start() error = %v", err)
	}
	defer watcher.Stop()
	if err := os.MkdirAll(nestedDir, 0o755); err != nil {
		t.Fatalf("create watched directory: %v", err)
	}

	select {
	case backend.events <- fsnotify.Event{Name: createdDir, Op: fsnotify.Create}:
	case <-time.After(time.Second):
		t.Fatal("create event was not consumed")
	}

	select {
	case <-dynamicAddDone:
	case <-time.After(time.Second):
		t.Fatal("dynamic Add blocked the event consumer")
	}

	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		for _, path := range backend.addedPaths() {
			if path == nestedDir {
				return
			}
		}
		time.Sleep(time.Millisecond)
	}
	t.Fatalf("added paths = %#v, nested directory was not registered", backend.addedPaths())
}

func TestWatcherStartFailureClosesBackend(t *testing.T) {
	backend := newFakeWatcherBackend()
	backend.addErr = errors.New("add failed")
	watcher := newWatcherWithBackend(t.TempDir(), []string{".json"}, nil, nil, backend)

	if err := watcher.Start(); err == nil {
		t.Fatal("Start() error = nil, want registration failure")
	}
	select {
	case <-backend.stop:
	case <-time.After(time.Second):
		t.Fatal("backend was not closed after Start() failed")
	}
}

func TestWatcherRegistrationHonorsScannerDirectoryBoundaries(t *testing.T) {
	root := t.TempDir()
	allowed := filepath.Join(root, "allowed")
	excluded := filepath.Join(root, "node_modules")
	tooDeep := filepath.Join(allowed, "too-deep")
	for _, dir := range []string{allowed, excluded, tooDeep} {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			t.Fatalf("create test directory: %v", err)
		}
	}

	scanner := NewScanner(root, []string{"node_modules"}, []string{".json"})
	scanner.SetMaxDepth(1)
	backend := newFakeWatcherBackend()
	watcher := newWatcherWithBackend(root, []string{".json"}, scanner.AllowsDir, nil, backend)
	if err := watcher.Start(); err != nil {
		t.Fatalf("Start() error = %v", err)
	}
	watcher.Stop()

	added := make(map[string]bool)
	for _, path := range backend.addedPaths() {
		added[path] = true
	}
	if !added[root] || !added[allowed] {
		t.Fatalf("registered paths = %#v, want root and allowed directory", added)
	}
	if added[excluded] || added[tooDeep] {
		t.Fatalf("registered paths = %#v, excluded or deep directory was watched", added)
	}
}

func TestDebouncerConcurrentStopAndDebounce(t *testing.T) {
	debouncer := newDebouncer(time.Millisecond)
	var workers sync.WaitGroup
	for worker := 0; worker < 8; worker++ {
		workers.Add(1)
		go func(worker int) {
			defer workers.Done()
			for index := 0; index < 100; index++ {
				debouncer.debounce(fmt.Sprintf("%d-%d", worker, index), func() {})
			}
		}(worker)
	}
	debouncer.stop()
	workers.Wait()
}
