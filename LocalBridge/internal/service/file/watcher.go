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
			if err := w.watcher.Add(event.Name); err != nil {
				logger.Error("FileWatcher", "添加目录监听失败: %s, %v", event.Name, err)
			} else {
				logger.Debug("FileWatcher", "新增目录监听: %s", event.Name)
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
		isDirectory = true

	} else if event.Op&fsnotify.Rename == fsnotify.Rename {
		// 重命名事件
		changeType = ChangeTypeRenamed
		oldPath = event.Name
		isDirectory = true

	} else {
		return
	}

	// 文件变更
	if !isDirectory && !w.hasValidExtension(event.Name) {
		return
	}

	// 防抖
	debounceKey := event.Name
	if changeType == ChangeTypeRenamed {
		debounceKey = "rename:" + event.Name
	}

	w.debouncer.debounce(debounceKey, func() {
		if w.handler != nil {
			w.handler(FileChange{
				Type:        changeType,
				FilePath:    event.Name,
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

// 清除指定键的防抖定时器
func (d *debouncer) clear(key string) {
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
