package file

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/pkg/models"
)

// 文件扫描器
type Scanner struct {
	root       string   // 根目录
	exclude    []string // 排除目录列表
	extensions []string // 包含的文件扩展名
}

// 创建文件扫描器
func NewScanner(root string, exclude []string, extensions []string) *Scanner {
	return &Scanner{
		root:       root,
		exclude:    exclude,
		extensions: extensions,
	}
}

// 扫描根目录下所有符合条件的文件
func (s *Scanner) Scan() ([]models.File, error) {
	var files []models.File

	err := filepath.Walk(s.root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// 跳过目录
		if info.IsDir() {
			// 检查是否在排除列表中
			if s.shouldExcludeDir(info.Name()) {
				return filepath.SkipDir
			}
			return nil
		}

		// 检查文件扩展名
		if !s.hasValidExtension(path) {
			return nil
		}

		// 计算相对路径
		relPath, err := filepath.Rel(s.root, path)
		if err != nil {
			return err
		}

		// 添加到文件列表
		files = append(files, models.File{
			AbsPath:      path,
			RelPath:      relPath,
			Name:         info.Name(),
			LastModified: info.ModTime().Unix(),
		})

		return nil
	})

	return files, err
}

// 检查目录是否应该被排除
func (s *Scanner) shouldExcludeDir(dirName string) bool {
	for _, excluded := range s.exclude {
		if dirName == excluded {
			return true
		}
	}
	return false
}

// 检查文件是否具有有效的扩展名
func (s *Scanner) hasValidExtension(path string) bool {
	// 过滤 .mpe.json 分离配置文件
	fileName := filepath.Base(path)
	if strings.HasPrefix(fileName, ".") && strings.HasSuffix(strings.ToLower(fileName), ".mpe.json") {
		return false
	}
	// 检查其他扩展名
	ext := strings.ToLower(filepath.Ext(path))
	for _, validExt := range s.extensions {
		if ext == validExt {
			return true
		}
	}
	return false
}

// 扫描单个文件信息
func (s *Scanner) ScanSingle(absPath string) (*models.File, error) {
	info, err := os.Stat(absPath)
	if err != nil {
		return nil, err
	}

	// 检查是否是文件
	if info.IsDir() {
		return nil, nil
	}

	// 检查扩展名
	if !s.hasValidExtension(absPath) {
		return nil, nil
	}

	// 计算相对路径
	relPath, err := filepath.Rel(s.root, absPath)
	if err != nil {
		return nil, err
	}

	return &models.File{
		AbsPath:      absPath,
		RelPath:      relPath,
		Name:         info.Name(),
		LastModified: info.ModTime().Unix(),
	}, nil
}
