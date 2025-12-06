package file

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/errors"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/eventbus"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
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
}

// 创建文件服务实例
func NewService(root string, exclude []string, extensions []string, eb *eventbus.EventBus) (*Service, error) {
	s := &Service{
		root:      root,
		scanner:   NewScanner(root, exclude, extensions),
		fileIndex: make(map[string]*models.File),
		eventBus:  eb,
	}

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
	files, err := s.scanner.Scan()
	if err != nil {
		return err
	}

	// 构建文件索引
	s.mu.Lock()
	for i := range files {
		s.fileIndex[files[i].AbsPath] = &files[i]
	}
	s.mu.Unlock()

	logger.Info("FileService", "初始扫描完成，发现 %d 个文件", len(files))

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

	return fileList
}

// 读取文件内容
func (s *Service) ReadFile(filePath string) (interface{}, error) {
	// 验证路径安全性
	if err := s.validatePath(filePath); err != nil {
		return nil, err
	}

	// 检查文件是否存在于索引中
	s.mu.RLock()
	_, exists := s.fileIndex[filePath]
	s.mu.RUnlock()

	if !exists {
		return nil, errors.NewFileNotFoundError(filePath)
	}

	// 读取文件内容
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, errors.NewFileReadError(filePath, err)
	}

	// 解析JSON
	var content interface{}
	if err := json.Unmarshal(data, &content); err != nil {
		return nil, errors.NewInvalidJSONError(err)
	}

	return content, nil
}

// 保存文件
func (s *Service) SaveFile(filePath string, content interface{}) error {
	// 验证路径安全性
	if err := s.validatePath(filePath); err != nil {
		return err
	}

	// 序列化 JSON
	data, err := json.MarshalIndent(content, "", "  ")
	if err != nil {
		return errors.NewInvalidJSONError(err)
	}

	// 写入文件
	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return errors.NewFileWriteError(filePath, err)
	}

	logger.Info("FileService", "文件保存成功: %s", filePath)
	return nil
}

// 创建新文件
func (s *Service) CreateFile(directory, fileName string, content interface{}) error {
	// 验证目录路径安全性
	if err := s.validatePath(directory); err != nil {
		return err
	}

	// 验证文件名
	if strings.ContainsAny(fileName, `/\:*?"<>|`) {
		return errors.NewInvalidRequestError("文件名包含非法字符")
	}

	// 构造完整路径
	filePath := filepath.Join(directory, fileName)

	// 检查文件是否已存在
	if _, err := os.Stat(filePath); err == nil {
		return errors.NewFileNameConflictError(filePath)
	}

	// 序列化初始内容
	var data []byte
	var err error
	if content != nil {
		data, err = json.MarshalIndent(content, "", "  ")
		if err != nil {
			return errors.NewInvalidJSONError(err)
		}
	} else {
		// 默认空对象
		data = []byte("{}")
	}

	// 创建文件
	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return errors.NewFileWriteError(filePath, err)
	}

	logger.Info("FileService", "文件创建成功: %s", filePath)

	// 添加新文件到索引
	if fileInfo, err := s.scanner.ScanSingle(filePath); err == nil && fileInfo != nil {
		s.mu.Lock()
		s.fileIndex[filePath] = fileInfo
		s.mu.Unlock()
	}

	return nil
}

// 处理文件变化事件
func (s *Service) handleFileChange(change FileChange) {
	filePath := change.FilePath

	switch change.Type {
	case ChangeTypeCreated:
		// 添加到索引
		if fileInfo, err := s.scanner.ScanSingle(filePath); err == nil && fileInfo != nil {
			s.mu.Lock()
			s.fileIndex[filePath] = fileInfo
			s.mu.Unlock()

			logger.Info("FileService", "检测到新文件: %s", filePath)
		}

	case ChangeTypeModified:
		logger.Warn("FileService", "文件已被外部修改: %s", filePath)

	case ChangeTypeDeleted:
		// 从索引移除
		s.mu.Lock()
		delete(s.fileIndex, filePath)
		s.mu.Unlock()

		logger.Info("FileService", "文件已删除: %s", filePath)
	}

	// 发布文件变化事件
	s.eventBus.Publish(eventbus.EventFileChanged, map[string]interface{}{
		"type":      string(change.Type),
		"file_path": filePath,
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
