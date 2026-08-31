package file

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
)

// 文件变化类型
type ChangeType string

const (
	ChangeTypeCreated  ChangeType = "created"
	ChangeTypeModified ChangeType = "modified"
	ChangeTypeDeleted  ChangeType = "deleted"
	ChangeTypeRenamed  ChangeType = "renamed"
)

// 文件变化事件
type FileChange struct {
	Type        ChangeType
	FilePath    string
	IsDirectory bool   // 是否为目录变更
	OldPath     string // 重命名时的旧路径
}

// 文件变化处理函数类型
type ChangeHandler func(change FileChange)

// 文件监听器
type Watcher struct {
	backend       watcherBackend
	root          string
	extensions    []string
	allowDir      func(string) bool
	handler       ChangeHandler
	debouncer     *debouncer
	registrations *directoryRegistrationQueue
	stopCh        chan struct{}
	stopOnce      sync.Once
	workers       sync.WaitGroup
	watchedMu     sync.Mutex
	watchedDirs   map[string]struct{}
}

// 创建文件监听器
func NewWatcher(
	root string,
	extensions []string,
	allowDir func(string) bool,
	handler ChangeHandler,
) (*Watcher, error) {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, err
	}
	return newWatcherWithBackend(
		root,
		extensions,
		allowDir,
		handler,
		&fsnotifyBackend{watcher: watcher},
	), nil
}

func newWatcherWithBackend(
	root string,
	extensions []string,
	allowDir func(string) bool,
	handler ChangeHandler,
	backend watcherBackend,
) *Watcher {
	return &Watcher{
		backend:       backend,
		root:          filepath.Clean(root),
		extensions:    extensions,
		allowDir:      allowDir,
		handler:       handler,
		debouncer:     newDebouncer(300 * time.Millisecond),
		registrations: newDirectoryRegistrationQueue(),
		stopCh:        make(chan struct{}),
		watchedDirs:   make(map[string]struct{}),
	}
}

// 启动文件监听
func (w *Watcher) Start() error {
	w.workers.Add(2)
	go w.handleEvents()
	go w.handleRegistrations()

	result := make(chan error, 1)
	if !w.registrations.enqueue(directoryRegistration{root: w.root, result: result}) {
		w.Stop()
		return fmt.Errorf("文件监听器已停止")
	}
	select {
	case err := <-result:
		if err != nil {
			w.Stop()
			return err
		}
	case <-w.stopCh:
		return fmt.Errorf("文件监听器在启动完成前已停止")
	}

	logger.Debug("FileWatcher", "文件监听器已启动，监听根目录: %s", w.root)
	return nil
}

// 停止文件监听
func (w *Watcher) Stop() {
	w.stopOnce.Do(func() {
		w.registrations.close()
		if w.backend != nil {
			_ = w.backend.Close()
		}
		close(w.stopCh)
		w.workers.Wait()
		w.debouncer.stop()
		logger.Debug("FileWatcher", "文件监听器已停止")
	})
}

// 处理文件系统事件
func (w *Watcher) handleEvents() {
	defer w.workers.Done()
	events := w.backend.Events()
	errors := w.backend.Errors()
	for {
		select {
		case event, ok := <-events:
			if !ok {
				events = nil
				if errors == nil {
					return
				}
				continue
			}
			w.processEvent(event)

		case err, ok := <-errors:
			if !ok {
				errors = nil
				if events == nil {
					return
				}
				continue
			}
			logger.Error("FileWatcher", "文件监听错误: %v", err)

		case <-w.stopCh:
			return
		}
	}
}

// 处理单个文件系统事件
func (w *Watcher) processEvent(event fsnotify.Event) {
	// 检查路径是否存在
	info, err := os.Stat(event.Name)
	exists := err == nil
	isDir := exists && info.IsDir()

	// 确定变化类型
	var changeType ChangeType
	var isDirectory bool
	var oldPath string

	if event.Op&fsnotify.Create == fsnotify.Create {
		// 创建事件
		if !exists {
			return
		}
		changeType = ChangeTypeCreated
		isDirectory = isDir

		// 新建目录添加到监听
		if isDir {
			if w.allowDir != nil && !w.allowDir(event.Name) {
				return
			}
			if w.registrations.enqueue(directoryRegistration{root: event.Name}) {
				logger.Debug("FileWatcher", "提交新增目录监听: %s", event.Name)
			}
		}

	} else if event.Op&fsnotify.Write == fsnotify.Write {
		// 修改事件
		if isDir {
			return
		}
		changeType = ChangeTypeModified
		isDirectory = false

	} else if event.Op&fsnotify.Remove == fsnotify.Remove {
		// 删除事件
		changeType = ChangeTypeDeleted
		// 通过扩展名判断是否为文件
		isDirectory = !w.hasValidExtension(event.Name)

	} else if event.Op&fsnotify.Rename == fsnotify.Rename {
		// 重命名事件
		changeType = ChangeTypeRenamed
		oldPath = filepath.Clean(event.Name)
		// 通过扩展名判断是否为文件
		isDirectory = !w.hasValidExtension(filepath.Clean(event.Name))

	} else {
		return
	}
	if isDirectory && (changeType == ChangeTypeDeleted || changeType == ChangeTypeRenamed) {
		w.forgetWatchedTree(event.Name)
	}

	// 规范化路径，确保与 FileService 中的路径格式一致
	normalizedPath := filepath.Clean(event.Name)

	// 文件变更
	if !isDirectory && !w.hasValidExtension(normalizedPath) {
		return
	}

	// 防抖
	debounceKey := normalizedPath
	if changeType == ChangeTypeRenamed {
		debounceKey = "rename:" + normalizedPath
	}

	w.debouncer.debounce(debounceKey, func() {
		if w.handler != nil {
			w.handler(FileChange{
				Type:        changeType,
				FilePath:    normalizedPath,
				IsDirectory: isDirectory,
				OldPath:     oldPath,
			})
		}
	})
}

// 检查文件是否具有有效的扩展名
func (w *Watcher) hasValidExtension(path string) bool {
	ext := strings.ToLower(filepath.Ext(path))
	for _, validExt := range w.extensions {
		if ext == validExt {
			return true
		}
	}
	return false
}

// 防抖器
type debouncer struct {
	mu      sync.Mutex
	delay   time.Duration
	timers  map[string]*time.Timer
	stopped bool
}

// 创建防抖器
func newDebouncer(delay time.Duration) *debouncer {
	return &debouncer{
		delay:  delay,
		timers: make(map[string]*time.Timer),
	}
}

// 对指定键的函数调用进行防抖
func (d *debouncer) debounce(key string, fn func()) {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.stopped {
		return
	}

	// 如果已有定时器，取消它
	if timer, exists := d.timers[key]; exists {
		timer.Stop()
	}

	// 创建新的定时器
	d.timers[key] = time.AfterFunc(d.delay, func() {
		d.mu.Lock()
		delete(d.timers, key)
		if d.stopped {
			d.mu.Unlock()
			return
		}
		d.mu.Unlock()
		fn()
	})
}

// 停止所有定时器
func (d *debouncer) stop() {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.stopped = true
	for _, timer := range d.timers {
		timer.Stop()
	}
	d.timers = make(map[string]*time.Timer)
}

// 清除指定键的防抖定时器
func (d *debouncer) clear(key string) {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.stopped {
		return
	}
	if timer, exists := d.timers[key]; exists {
		timer.Stop()
		delete(d.timers, key)
	}
}

// 清除指定文件的防抖事件
func (w *Watcher) ClearDebounce(filePath string) {
	w.debouncer.clear(filePath)
}
