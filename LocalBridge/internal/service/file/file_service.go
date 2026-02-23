package file

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/errors"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/eventbus"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/utils"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/pkg/models"
)

// 文件服务
type Service struct {
	root      string
	scanner   *Scanner
	watcher   *Watcher
	fileIndex map[string]*models.File // key: 文件绝对路径
	mu        sync.RWMutex
	eventBus  *eventbus.EventBus
	maxDepth  int
	maxFiles  int

	// 最近写入的文件记录（用于忽略自身触发的文件变化）
	recentlyWrittenFiles map[string]int64 // key: 文件路径, value: 写入时间戳
	writtenMu            sync.RWMutex
	// 自身写入忽略窗口时间
	selfWriteIgnoreWindow time.Duration
}

// 创建文件服务实例
func NewService(root string, exclude []string, extensions []string, maxDepth, maxFiles int, eb *eventbus.EventBus) (*Service, error) {
	s := &Service{
		root:                  root,
		scanner:               NewScanner(root, exclude, extensions),
		fileIndex:             make(map[string]*models.File),
		eventBus:              eb,
		maxDepth:              maxDepth,
		maxFiles:              maxFiles,
		recentlyWrittenFiles:  make(map[string]int64),
		selfWriteIgnoreWindow: 2 * time.Second, // 2秒窗口期忽略自身写入
	}

	// 设置扫描限制
	s.scanner.SetMaxDepth(maxDepth)
	s.scanner.SetMaxFiles(maxFiles)

	// 创建文件监听器
	watcher, err := NewWatcher(root, extensions, s.handleFileChange)
	if err != nil {
		return nil, err
	}
	s.watcher = watcher

	return s, nil
}

// 启动文件服务
func (s *Service) Start() error {
	// 初始扫描
	result, err := s.scanner.ScanWithLimit()
	if err != nil {
		return err
	}

	// 构建文件索引
	s.mu.Lock()
	for i := range result.Files {
		s.fileIndex[result.Files[i].AbsPath] = &result.Files[i]
	}
	s.mu.Unlock()

	// 记录扫描结果
	if result.Truncated {
		logger.Warn("FileService", "初始扫描完成，发现 %d 个文件（%s）", len(result.Files), result.LimitReason)
	} else {
		logger.Info("FileService", "初始扫描完成，发现 %d 个文件", len(result.Files))
	}

	// 发布扫描完成事件
	s.eventBus.Publish(eventbus.EventFileScanCompleted, s.GetFileList())

	// 启动文件监听
	if err := s.watcher.Start(); err != nil {
		return err
	}

	return nil
}

// 停止文件服务
func (s *Service) Stop() {
	if s.watcher != nil {
		s.watcher.Stop()
	}
}

// 获取文件列表
func (s *Service) GetFileList() []models.FileInfo {
	s.mu.RLock()
	defer s.mu.RUnlock()

	fileList := make([]models.FileInfo, 0, len(s.fileIndex))
	for _, file := range s.fileIndex {
		fileList = append(fileList, file.ToFileInfo())
	}

	// 按相对路径排序，确保列表顺序稳定
	sort.Slice(fileList, func(i, j int) bool {
		return fileList[i].RelativePath < fileList[j].RelativePath
	})

	return fileList
}

// 读取文件内容
func (s *Service) ReadFile(filePath string) (interface{}, error) {
	// 验证路径安全性
	if err := s.validatePath(filePath); err != nil {
		return nil, err
	}

	// 允许直接读取 .mpe.json 配置文件，
	isConfigFile := strings.HasPrefix(filepath.Base(filePath), ".") && strings.HasSuffix(strings.ToLower(filePath), ".mpe.json")

	// 检查文件是否存在于索引中
	if !isConfigFile {
		s.mu.RLock()
		_, exists := s.fileIndex[filePath]
		s.mu.RUnlock()

		if !exists {
			return nil, errors.NewFileNotFoundError(filePath)
		}
	}

	// 读取文件内容
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, errors.NewFileReadError(filePath, err)
	}

	// 解析JSONC
	var content interface{}
	if err := utils.ParseJSONC(data, &content); err != nil {
		return nil, errors.NewInvalidJSONError(err)
	}

	return content, nil
}

// 保存文件
func (s *Service) SaveFile(filePath string, content interface{}, indent int) error {
	// 验证路径安全性
	if err := s.validatePath(filePath); err != nil {
		return err
	}

	// 构建缩进字符串
	var indentStr string
	for i := 0; i < indent; i++ {
		indentStr += " "
	}
	if indentStr == "" {
		indentStr = "    "
	}

	// 序列化 JSON
	data, err := json.MarshalIndent(content, "", indentStr)
	if err != nil {
		return errors.NewInvalidJSONError(err)
	}

	// 记录即将写入的文件（用于忽略自身触发的文件变化事件）
	s.writtenMu.Lock()
	s.recentlyWrittenFiles[filePath] = time.Now().UnixMilli()
	s.writtenMu.Unlock()

	// 写入文件
	if err := os.WriteFile(filePath, data, 0644); err != nil {
		// 写入失败时移除记录
		s.writtenMu.Lock()
		delete(s.recentlyWrittenFiles, filePath)
		s.writtenMu.Unlock()
		return errors.NewFileWriteError(filePath, err)
	}

	// 清除该文件的防抖事件（防止延迟触发）
	if s.watcher != nil {
		s.watcher.ClearDebounce(filePath)
	}

	logger.Info("FileService", "文件已保存: %s", filePath)
	return nil
}

// 创建新文件
func (s *Service) CreateFile(directory, fileName string, content interface{}) (string, error) {
	// 验证目录路径安全性
	if err := s.validatePath(directory); err != nil {
		return "", err
	}

	// 验证文件名
	if strings.ContainsAny(fileName, `/\:*?"<>|`) {
		return "", errors.NewInvalidRequestError("文件名包含非法字符")
	}

	// 构造完整路径
	filePath := filepath.Join(directory, fileName)

	// 检查文件是否已存在
	if _, err := os.Stat(filePath); err == nil {
		return "", errors.NewFileNameConflictError(filePath)
	}

	// 序列化初始内容
	var data []byte
	var err error
	if content != nil {
		data, err = json.MarshalIndent(content, "", "    ")
		if err != nil {
			return "", errors.NewInvalidJSONError(err)
		}
	} else {
		// 默认空对象
		data = []byte("{}")
	}

	// 创建文件
	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return "", errors.NewFileWriteError(filePath, err)
	}

	logger.Info("FileService", "文件已创建: %s", filePath)

	// 添加新文件到索引
	if fileInfo, err := s.scanner.ScanSingle(filePath); err == nil && fileInfo != nil {
		s.mu.Lock()
		s.fileIndex[filePath] = fileInfo
		s.mu.Unlock()
	}

	return filePath, nil
}

// 处理文件变化事件
func (s *Service) handleFileChange(change FileChange) {
	filePath := change.FilePath

	switch change.Type {
	case ChangeTypeCreated:
		if change.IsDirectory {
			// 目录创建
			logger.Info("FileService", "检测到新目录: %s", filePath)
		} else {
			// 文件创建
			if fileInfo, err := s.scanner.ScanSingle(filePath); err == nil && fileInfo != nil {
				s.mu.Lock()
				s.fileIndex[filePath] = fileInfo
				s.mu.Unlock()
				logger.Info("FileService", "检测到新文件: %s", filePath)
			}
		}

	case ChangeTypeModified:
		if change.IsDirectory {
			// 目录修改
			return
		}

		// 检查是否是自身写入的文件（在忽略窗口期内）
		s.writtenMu.RLock()
		writeTime, wasWritten := s.recentlyWrittenFiles[filePath]
		s.writtenMu.RUnlock()

		if wasWritten {
			now := time.Now().UnixMilli()
			elapsed := time.Duration(now-writeTime) * time.Millisecond
			if elapsed < s.selfWriteIgnoreWindow {
				logger.Debug("FileService", "忽略自身写入的文件变化: %s (经过 %v)", filePath, elapsed)
				return
			}
			// 已过窗口期，清理记录
			s.writtenMu.Lock()
			delete(s.recentlyWrittenFiles, filePath)
			s.writtenMu.Unlock()
		}

		logger.Warn("FileService", "文件已被外部修改: %s", filePath)

	case ChangeTypeDeleted:
		if change.IsDirectory {
			// 目录删除
			s.mu.Lock()
			removed := 0
			for path := range s.fileIndex {
				if strings.HasPrefix(path, filePath+string(filepath.Separator)) {
					delete(s.fileIndex, path)
					removed++
				}
			}
			s.mu.Unlock()
			logger.Info("FileService", "目录已删除: %s (清理 %d 个文件索引)", filePath, removed)
		} else {
			// 文件删除
			s.mu.Lock()
			delete(s.fileIndex, filePath)
			s.mu.Unlock()
			logger.Info("FileService", "文件已删除: %s", filePath)
		}

	case ChangeTypeRenamed:
		// 重命名
		oldPath := change.OldPath
		if oldPath == "" {
			oldPath = filePath
		}
		s.mu.Lock()
		removed := 0
		for path := range s.fileIndex {
			if path == oldPath || strings.HasPrefix(path, oldPath+string(filepath.Separator)) {
				delete(s.fileIndex, path)
				removed++
			}
		}
		s.mu.Unlock()
		logger.Info("FileService", "路径已重命名: %s (清理 %d 个索引)", oldPath, removed)
	}

	// 发布文件变化事件
	s.eventBus.Publish(eventbus.EventFileChanged, map[string]interface{}{
		"type":         string(change.Type),
		"file_path":    filePath,
		"is_directory": change.IsDirectory,
	})
}

// 验证路径安全性
func (s *Service) validatePath(path string) error {
	// 转换为绝对路径
	absPath, err := filepath.Abs(path)
	if err != nil {
		return errors.NewPermissionDeniedError("无效的路径")
	}

	// 检查路径是否在根目录范围内
	if !strings.HasPrefix(absPath, s.root) {
		return errors.NewPermissionDeniedError("路径不在根目录范围内")
	}

	return nil
}
