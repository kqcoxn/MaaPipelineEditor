package file

import (
	"os"
	"path/filepath"
	"strings"
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
)

// 文件变化事件
type FileChange struct {
	Type     ChangeType
	FilePath string
}

// 文件变化处理函数类型
type ChangeHandler func(change FileChange)

// 文件监听器
type Watcher struct {
	watcher    *fsnotify.Watcher
	root       string
	extensions []string
	handler    ChangeHandler
	debouncer  *debouncer
}

// 创建文件监听器
func NewWatcher(root string, extensions []string, handler ChangeHandler) (*Watcher, error) {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, err
	}

	w := &Watcher{
		watcher:    watcher,
		root:       root,
		extensions: extensions,
		handler:    handler,
		debouncer:  newDebouncer(300 * time.Millisecond),
	}

	return w, nil
}

// 启动文件监听
func (w *Watcher) Start() error {
	// 递归添加所有子目录到监听
	err := filepath.Walk(w.root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return w.watcher.Add(path)
		}
		return nil
	})

	if err != nil {
		return err
	}

	// 启动事件处理协程
	go w.handleEvents()

	logger.Debug("FileWatcher", "文件监听器已启动，监听根目录: %s", w.root)
	return nil
}

// 停止文件监听
func (w *Watcher) Stop() {
	if w.watcher != nil {
		w.watcher.Close()
	}
	w.debouncer.stop()
	logger.Debug("FileWatcher", "文件监听器已停止")
}

// 处理文件系统事件
func (w *Watcher) handleEvents() {
	for {
		select {
		case event, ok := <-w.watcher.Events:
			if !ok {
				return
			}
			w.processEvent(event)

		case err, ok := <-w.watcher.Errors:
			if !ok {
				return
			}
			logger.Error("FileWatcher", "文件监听错误: %v", err)
		}
	}
}

// 处理单个文件系统事件
func (w *Watcher) processEvent(event fsnotify.Event) {
	// 检查文件扩展名
	if !w.hasValidExtension(event.Name) {
		return
	}

	// 确定变化类型
	var changeType ChangeType
	if event.Op&fsnotify.Create == fsnotify.Create {
		changeType = ChangeTypeCreated
	} else if event.Op&fsnotify.Write == fsnotify.Write {
		changeType = ChangeTypeModified
	} else if event.Op&fsnotify.Remove == fsnotify.Remove {
		changeType = ChangeTypeDeleted
	} else {
		return
	}

	// 使用防抖处理
	w.debouncer.debounce(event.Name, func() {
		if w.handler != nil {
			w.handler(FileChange{
				Type:     changeType,
				FilePath: event.Name,
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
	if d.stopped {
		return
	}

	// 如果已有定时器，取消它
	if timer, exists := d.timers[key]; exists {
		timer.Stop()
	}

	// 创建新的定时器
	d.timers[key] = time.AfterFunc(d.delay, func() {
		delete(d.timers, key)
		fn()
	})
}

// 停止所有定时器
func (d *debouncer) stop() {
	d.stopped = true
	for _, timer := range d.timers {
		timer.Stop()
	}
	d.timers = make(map[string]*time.Timer)
}
