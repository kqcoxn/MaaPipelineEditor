package resource

import (
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/eventbus"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/pkg/models"
)

// 资源扫描服务
type Service struct {
	root      string
	bundles   []models.ResourceBundle
	imageDirs []string // 所有 image 目录的绝对路径
	mu        sync.RWMutex
	eventBus  *eventbus.EventBus
}

// 创建资源服务
func NewService(root string, eb *eventbus.EventBus) *Service {
	return &Service{
		root:      root,
		bundles:   make([]models.ResourceBundle, 0),
		imageDirs: make([]string, 0),
		eventBus:  eb,
	}
}

// 启动资源扫描服务
func (s *Service) Start() error {
	// 初始扫描
	if err := s.Scan(); err != nil {
		return err
	}

	logger.Info("ResourceService", "资源扫描完成，发现 %d 个资源包，%d 个 image 目录", len(s.bundles), len(s.imageDirs))

	// 发布扫描完成事件
	s.eventBus.Publish(eventbus.EventResourceScanCompleted, s.GetBundleList())

	return nil
}

// 扫描资源目录
func (s *Service) Scan() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.bundles = make([]models.ResourceBundle, 0)
	s.imageDirs = make([]string, 0)

	// 检查根目录本身是否是资源包
	if bundle := s.checkResourceBundle(s.root, ""); bundle != nil {
		s.bundles = append(s.bundles, *bundle)
		if bundle.HasImage && bundle.ImageDir != "" {
			s.imageDirs = append(s.imageDirs, bundle.ImageDir)
		}
	}

	// 递归扫描子目录（最多2层）
	s.scanDirectory(s.root, "", 0, 2)

	return nil
}

// 递归扫描目录
func (s *Service) scanDirectory(absPath, relPath string, depth, maxDepth int) {
	if depth >= maxDepth {
		return
	}

	entries, err := os.ReadDir(absPath)
	if err != nil {
		return
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		name := entry.Name()
		// 跳过隐藏目录和常见非资源目录
		if strings.HasPrefix(name, ".") || s.shouldSkipDir(name) {
			continue
		}

		subAbsPath := filepath.Join(absPath, name)
		subRelPath := name
		if relPath != "" {
			subRelPath = filepath.Join(relPath, name)
		}

		// 检查是否是资源包
		if bundle := s.checkResourceBundle(subAbsPath, subRelPath); bundle != nil {
			// 检查是否已存在
			exists := false
			for _, b := range s.bundles {
				if b.AbsPath == bundle.AbsPath {
					exists = true
					break
				}
			}
			if !exists {
				s.bundles = append(s.bundles, *bundle)
				if bundle.HasImage && bundle.ImageDir != "" {
					s.imageDirs = append(s.imageDirs, bundle.ImageDir)
				}
			}
		}

		// 继续递归
		s.scanDirectory(subAbsPath, subRelPath, depth+1, maxDepth)
	}
}

// 检查目录是否是 MaaFramework 资源包
func (s *Service) checkResourceBundle(absPath, relPath string) *models.ResourceBundle {
	hasPipeline := s.dirExists(filepath.Join(absPath, "pipeline"))
	hasImage := s.dirExists(filepath.Join(absPath, "image"))
	hasModel := s.dirExists(filepath.Join(absPath, "model"))
	hasDefaultPipeline := s.fileExists(filepath.Join(absPath, "default_pipeline.json"))

	// 至少有一个标志性目录或文件才认为是资源包
	if !hasPipeline && !hasImage && !hasModel && !hasDefaultPipeline {
		return nil
	}

	name := filepath.Base(absPath)
	if relPath == "" {
		name = "(root)"
	}

	imageDir := ""
	if hasImage {
		imageDir = filepath.Join(absPath, "image")
	}

	return &models.ResourceBundle{
		AbsPath:            absPath,
		RelPath:            relPath,
		Name:               name,
		HasPipeline:        hasPipeline,
		HasImage:           hasImage,
		HasModel:           hasModel,
		HasDefaultPipeline: hasDefaultPipeline,
		ImageDir:           imageDir,
	}
}

// 获取资源包列表
func (s *Service) GetBundleList() models.ResourceBundleListData {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return models.ResourceBundleListData{
		Root:      s.root,
		Bundles:   s.bundles,
		ImageDirs: s.imageDirs,
	}
}

// 获取所有 image 目录
func (s *Service) GetImageDirs() []string {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return s.imageDirs
}

// 在所有 image 目录中查找图片
func (s *Service) FindImage(relativePath string) (absPath, bundleName string, found bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// 按顺序在各个 image 目录中查找
	for _, bundle := range s.bundles {
		if !bundle.HasImage || bundle.ImageDir == "" {
			continue
		}

		imagePath := filepath.Join(bundle.ImageDir, relativePath)
		if s.fileExists(imagePath) {
			return imagePath, bundle.Name, true
		}
	}

	return "", "", false
}

// 判断目录是否存在
func (s *Service) dirExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.IsDir()
}

// 判断文件是否存在
func (s *Service) fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}

// 应该跳过的目录
func (s *Service) shouldSkipDir(name string) bool {
	skipDirs := []string{
		"node_modules",
		"__pycache__",
		"venv",
		".venv",
		".git",
		".idea",
		".vscode",
		"debug",
		"logs",
		"cache",
		"config",
	}
	for _, skip := range skipDirs {
		if name == skip {
			return true
		}
	}
	return false
}
