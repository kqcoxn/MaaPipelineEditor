package file

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/utils"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/pkg/models"
)

// 扫描限制错误
var (
	ErrMaxFilesExceeded = errors.New("扫描文件数量超过限制")
	ErrMaxDepthExceeded = errors.New("扫描深度超过限制")
)

// 文件扫描器
type Scanner struct {
	root       string   // 根目录
	exclude    []string // 排除目录列表
	extensions []string // 包含的文件扩展名
	maxDepth   int      // 最大扫描深度，0 表示无限制
	maxFiles   int      // 最大文件数量，0 表示无限制
}

// 创建文件扫描器
func NewScanner(root string, exclude []string, extensions []string) *Scanner {
	return &Scanner{
		root:       root,
		exclude:    exclude,
		extensions: extensions,
		maxDepth:   0, // 默认无限制
		maxFiles:   0, // 默认无限制
	}
}

// SetMaxDepth 设置最大扫描深度
func (s *Scanner) SetMaxDepth(depth int) {
	s.maxDepth = depth
}

// SetMaxFiles 设置最大文件数量
func (s *Scanner) SetMaxFiles(count int) {
	s.maxFiles = count
}

// 扫描结果
type ScanResult struct {
	Files       []models.File
	TotalCount  int
	Truncated   bool   // 是否因限制而截断
	LimitReason string // 截断原因
}

// Scan 扫描根目录下所有符合条件的文件
func (s *Scanner) Scan() ([]models.File, error) {
	result, err := s.ScanWithLimit()
	return result.Files, err
}

// ScanWithLimit 扫描并返回详细结果（包含限制信息）
func (s *Scanner) ScanWithLimit() (*ScanResult, error) {
	result := &ScanResult{
		Files:     []models.File{},
		Truncated: false,
	}

	// 计算根目录深度用于相对深度计算
	rootDepth := strings.Count(s.root, string(filepath.Separator))

	err := filepath.WalkDir(s.root, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			// 忽略访问错误的目录/文件，继续扫描
			return nil
		}

		// 计算当前深度
		currentDepth := strings.Count(path, string(filepath.Separator)) - rootDepth

		// 检查深度限制
		if s.maxDepth > 0 && currentDepth > s.maxDepth {
			if d.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}

		// 处理目录
		if d.IsDir() {
			// 检查是否在排除列表中
			if s.shouldExcludeDir(d.Name()) {
				return filepath.SkipDir
			}
			return nil
		}

		// 检查文件数量限制
		if s.maxFiles > 0 && len(result.Files) >= s.maxFiles {
			result.Truncated = true
			result.LimitReason = fmt.Sprintf("已达到最大文件数量限制 (%d)", s.maxFiles)
			return errors.New("stop") // 用于停止遍历
		}

		// 检查文件扩展名
		if !s.hasValidExtension(path) {
			return nil
		}

		// 获取文件信息
		info, err := d.Info()
		if err != nil {
			return nil
		}

		// 计算相对路径
		relPath, err := filepath.Rel(s.root, path)
		if err != nil {
			return nil
		}

		// 解析文件节点列表和前缀
		nodes, prefix := s.parseFileNodes(path)

		// 添加到文件列表
		result.Files = append(result.Files, models.File{
			AbsPath:      path,
			RelPath:      relPath,
			Name:         info.Name(),
			LastModified: info.ModTime().Unix(),
			Nodes:        nodes,
			Prefix:       prefix,
		})

		return nil
	})

	// 忽略 stop 错误（用于提前终止遍历）
	if err != nil && err.Error() == "stop" {
		err = nil
	}

	result.TotalCount = len(result.Files)
	return result, err
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

	// 解析文件节点列表和前缀
	nodes, prefix := s.parseFileNodes(absPath)

	return &models.File{
		AbsPath:      absPath,
		RelPath:      relPath,
		Name:         info.Name(),
		LastModified: info.ModTime().Unix(),
		Nodes:        nodes,
		Prefix:       prefix,
	}, nil
}

// 解析文件节点列表和前缀
func (s *Scanner) parseFileNodes(filePath string) ([]models.FileNode, string) {
	var nodes []models.FileNode
	var prefix string

	// 读取文件内容
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nodes, prefix
	}

	// 尝试解析JSONC
	var content map[string]interface{}
	if err := utils.ParseJSONC(data, &content); err != nil {
		return nodes, prefix
	}

	// 获取前缀
	if mpeConfig, ok := content["$mpe"].(map[string]interface{}); ok {
		if p, ok := mpeConfig["prefix"].(string); ok {
			prefix = p
		}
	}

	// 遍历所有顶层key作为节点名
	for key := range content {
		// 跳过以$开头的特殊key
		if strings.HasPrefix(key, "$") {
			continue
		}
		nodes = append(nodes, models.FileNode{
			Label:  key,
			Prefix: prefix,
		})
	}

	return nodes, prefix
}
