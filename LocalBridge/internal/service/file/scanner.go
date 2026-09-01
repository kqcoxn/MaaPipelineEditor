package file

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
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

		if !s.IsIndexablePath(path) {
			return nil
		}

		// 检查文件数量限制
		if s.maxFiles > 0 && len(result.Files) >= s.maxFiles {
			result.Truncated = true
			result.LimitReason = fmt.Sprintf("已达到最大文件数量限制 (%d)", s.maxFiles)
			return errors.New("stop") // 用于停止遍历
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

		var nodes []models.FileNode
		var prefix, contentHash string
		if IsPipelineFile(s.root, path) && !isInterfaceFile(path) {
			nodes, prefix = s.parseFileNodes(path)
			contentHash = fileContentHash(path)
		}

		// 添加到文件列表
		result.Files = append(result.Files, models.File{
			AbsPath:      path,
			RelPath:      relPath,
			Name:         info.Name(),
			LastModified: info.ModTime().UnixNano(),
			ContentHash:  contentHash,
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

// ScanDirectories 扫描根目录下所有子目录（包括空目录）
func (s *Scanner) ScanDirectories() []string {
	var dirs []string

	rootDepth := strings.Count(s.root, string(filepath.Separator))

	filepath.WalkDir(s.root, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return nil
		}

		if !d.IsDir() {
			return nil
		}

		// 跳过根目录自身
		if path == s.root {
			return nil
		}

		// 检查深度限制
		currentDepth := strings.Count(path, string(filepath.Separator)) - rootDepth
		if s.maxDepth > 0 && currentDepth > s.maxDepth {
			return filepath.SkipDir
		}

		// 检查是否在排除列表中
		if s.shouldExcludeDir(d.Name()) {
			return filepath.SkipDir
		}

		dirs = append(dirs, path)
		return nil
	})

	return dirs
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

// IsIndexablePath reports whether a file is needed by the Pipeline index or PI discovery.
func (s *Scanner) IsIndexablePath(path string) bool {
	if !s.hasValidExtension(path) {
		return false
	}
	return isInterfaceFile(path) || IsPipelineFile(s.root, path)
}

func isInterfaceFile(path string) bool {
	return strings.EqualFold(filepath.Base(path), "interface.json")
}

// IsPipelineFile identifies JSON files below a directory named pipeline.
func IsPipelineFile(root, path string) bool {
	return !strings.HasPrefix(filepath.Base(path), ".") && isPipelineDirectory(root, filepath.Dir(path))
}

func isPipelineDirectory(root, path string) bool {
	pipelineRoot, ok := pipelineRootForPath(root, path)
	if !ok {
		return false
	}

	pipelineRel, err := filepath.Rel(pipelineRoot, path)
	if err != nil || pipelineRel == ".." || strings.HasPrefix(pipelineRel, ".."+string(filepath.Separator)) {
		return false
	}
	if pipelineRel != "." {
		for _, part := range strings.Split(filepath.Clean(pipelineRel), string(filepath.Separator)) {
			if strings.HasPrefix(part, ".") {
				return false
			}
		}
	}
	return true
}

func pipelineRootForPath(root, path string) (string, bool) {
	rel, err := filepath.Rel(root, path)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", false
	}

	// The scan root may itself be pipeline/ or one of its descendants.
	pipelineRoot := ""
	for current := filepath.Clean(root); ; current = filepath.Dir(current) {
		if strings.EqualFold(filepath.Base(current), "pipeline") {
			pipelineRoot = current
			break
		}
		parent := filepath.Dir(current)
		if parent == current {
			break
		}
	}
	if pipelineRoot == "" {
		parts := strings.Split(filepath.Clean(rel), string(filepath.Separator))
		current := filepath.Clean(root)
		for _, part := range parts {
			current = filepath.Join(current, part)
			if strings.EqualFold(part, "pipeline") {
				pipelineRoot = current
				break
			}
		}
		if pipelineRoot == "" {
			return "", false
		}
	}
	return pipelineRoot, true
}

func isWithinPath(root, path string) bool {
	rootResolved, rootErr := filepath.EvalSymlinks(root)
	pathResolved, pathErr := filepath.EvalSymlinks(path)
	if rootErr == nil && pathErr == nil {
		root = rootResolved
		path = pathResolved
	}
	rel, err := filepath.Rel(root, path)
	return err == nil && rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))
}

// 扫描单个文件信息
func (s *Scanner) ScanSingle(absPath string) (*models.File, error) {
	if !s.AllowsPath(absPath) {
		return nil, nil
	}
	info, err := os.Stat(absPath)
	if err != nil {
		return nil, err
	}

	// 检查是否是文件
	if info.IsDir() {
		return nil, nil
	}

	if !s.IsIndexablePath(absPath) {
		return nil, nil
	}

	// 计算相对路径
	relPath, err := filepath.Rel(s.root, absPath)
	if err != nil {
		return nil, err
	}

	var nodes []models.FileNode
	var prefix, contentHash string
	if IsPipelineFile(s.root, absPath) && !isInterfaceFile(absPath) {
		nodes, prefix = s.parseFileNodes(absPath)
		contentHash = fileContentHash(absPath)
	}

	return &models.File{
		AbsPath:      absPath,
		RelPath:      relPath,
		Name:         info.Name(),
		LastModified: info.ModTime().UnixNano(),
		ContentHash:  contentHash,
		Nodes:        nodes,
		Prefix:       prefix,
	}, nil
}

func fileContentHash(filePath string) string {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return ""
	}
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

// AllowsPath applies the same root, exclude and depth boundaries used by the initial scan.
func (s *Scanner) AllowsPath(absPath string) bool {
	return s.allowsPath(absPath, false)
}

// AllowsDir applies the same root, exclude and depth boundaries to a directory.
func (s *Scanner) AllowsDir(absPath string) bool {
	return s.allowsPath(absPath, true)
}

func (s *Scanner) allowsPath(absPath string, isDir bool) bool {
	absPath, err := filepath.Abs(absPath)
	if err != nil {
		return false
	}
	relPath, err := filepath.Rel(s.root, absPath)
	if err != nil || relPath == ".." || strings.HasPrefix(relPath, ".."+string(filepath.Separator)) {
		return false
	}
	if relPath == "." {
		return true
	}
	parts := strings.Split(filepath.Clean(relPath), string(filepath.Separator))
	if s.maxDepth > 0 && len(parts) > s.maxDepth {
		return false
	}
	partsToCheck := parts
	if !isDir {
		partsToCheck = parts[:max(0, len(parts)-1)]
	}
	for _, part := range partsToCheck {
		if s.shouldExcludeDir(part) {
			return false
		}
	}
	return true
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

		// 提取该节点的 anchor 引用
		anchors := s.extractAnchors(content[key])

		nodes = append(nodes, models.FileNode{
			Label:       key,
			Prefix:      prefix,
			Anchors:     anchors,
			FieldValues: extractFieldValues(content[key]),
		})
	}

	return nodes, prefix
}

// extractFieldValues 递归提取节点字段中的标量值，供前端跨文件搜索使用。
func extractFieldValues(nodeData interface{}) []string {
	values := make(map[string]struct{})

	var collect func(interface{})
	collect = func(value interface{}) {
		switch typed := value.(type) {
		case string:
			if typed != "" {
				values[typed] = struct{}{}
			}
		case bool, float64:
			values[fmt.Sprint(typed)] = struct{}{}
		case []interface{}:
			for _, item := range typed {
				collect(item)
			}
		case map[string]interface{}:
			for _, item := range typed {
				collect(item)
			}
		}
	}

	collect(nodeData)
	result := make([]string, 0, len(values))
	for value := range values {
		result = append(result, value)
	}
	sort.Strings(result)
	return result
}

// extractAnchors 从节点数据中提取 anchor 引用列表
// anchor 字段支持三种格式：string、[]string、map[string]interface{}
// anchor 字段在节点的顶层，不在 others 中
func (s *Scanner) extractAnchors(nodeData interface{}) []string {
	var anchors []string

	// 节点数据必须是对象
	node, ok := nodeData.(map[string]interface{})
	if !ok {
		return anchors
	}

	// 获取 anchor 字段（在节点顶层，不在 others 中）
	anchorValue, ok := node["anchor"]
	if !ok {
		return anchors
	}

	// 处理不同格式的 anchor 值
	switch v := anchorValue.(type) {
	case string:
		if v != "" {
			anchors = []string{v}
		}
	case []interface{}:
		for _, item := range v {
			if str, ok := item.(string); ok && str != "" {
				anchors = append(anchors, str)
			}
		}
	case map[string]interface{}:
		for key := range v {
			if key != "" {
				anchors = append(anchors, key)
			}
		}
	}

	return anchors
}

// extractAnchorsFromNode 从节点数据中提取 anchor 引用列表（别名）
func (s *Scanner) extractAnchorsFromNode(nodeData interface{}) []string {
	return s.extractAnchors(nodeData)
}
