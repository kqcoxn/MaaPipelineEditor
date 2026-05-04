package mfw

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	maa "github.com/MaaXYZ/maa-framework-go/v4"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
)

const maxResourceBundleSearchDepth = 4

type ResourceBundleResolveStrategy string

const (
	ResourceBundleResolveExactRoot        ResourceBundleResolveStrategy = "exact_root"
	ResourceBundleResolveAncestorPipeline ResourceBundleResolveStrategy = "ancestor_pipeline"
	ResourceBundleResolveAncestorImage    ResourceBundleResolveStrategy = "ancestor_image"
	ResourceBundleResolveAncestorModel    ResourceBundleResolveStrategy = "ancestor_model"
	ResourceBundleResolveAncestorChild    ResourceBundleResolveStrategy = "ancestor_child"
	ResourceBundleResolveDescendantUnique ResourceBundleResolveStrategy = "descendant_unique"
)

type ResourceBundleResolution struct {
	InputPath    string
	InputAbsPath string
	ResolvedPath string
	Strategy     ResourceBundleResolveStrategy
}

func (r ResourceBundleResolution) DisplayLabel() string {
	if sameCleanPath(r.InputAbsPath, r.ResolvedPath) {
		return r.ResolvedPath
	}
	return fmt.Sprintf("%s -> %s", r.InputPath, r.ResolvedPath)
}

func (r ResourceBundleResolution) DiagnosticData() map[string]interface{} {
	return map[string]interface{}{
		"inputPath":           r.InputPath,
		"inputAbsPath":        r.InputAbsPath,
		"resolvedPath":        r.ResolvedPath,
		"strategy":            string(r.Strategy),
		"strategyDescription": r.Strategy.Description(),
	}
}

func (s ResourceBundleResolveStrategy) Description() string {
	switch s {
	case ResourceBundleResolveExactRoot:
		return "路径本身就是 bundle 根目录"
	case ResourceBundleResolveAncestorPipeline:
		return "从 pipeline 子路径向上回溯到 bundle 根目录"
	case ResourceBundleResolveAncestorImage:
		return "从 image 子路径向上回溯到 bundle 根目录"
	case ResourceBundleResolveAncestorModel:
		return "从 model 子路径向上回溯到 bundle 根目录"
	case ResourceBundleResolveDescendantUnique:
		return "在子目录中唯一命中 bundle 根目录"
	default:
		return "从 bundle 子路径向上回溯到 bundle 根目录"
	}
}

type ResourceBundleResolveError struct {
	InputPath    string
	InputAbsPath string
	Code         string
	Message      string
	Candidates   []string
}

func (e *ResourceBundleResolveError) Error() string {
	switch e.Code {
	case "bundle_ambiguous":
		return fmt.Sprintf("%s: %s。候选 bundle: %s", e.Message, preferResourcePathLabel(e.InputAbsPath, e.InputPath), strings.Join(e.Candidates, "; "))
	case "empty_path":
		return e.Message
	default:
		return fmt.Sprintf("%s: %s", e.Message, preferResourcePathLabel(e.InputAbsPath, e.InputPath))
	}
}

func (e *ResourceBundleResolveError) DiagnosticData() map[string]interface{} {
	data := map[string]interface{}{
		"reason": e.Code,
	}
	if e.InputPath != "" {
		data["inputPath"] = e.InputPath
	}
	if e.InputAbsPath != "" {
		data["inputAbsPath"] = e.InputAbsPath
	}
	if len(e.Candidates) > 0 {
		candidates := make([]string, len(e.Candidates))
		copy(candidates, e.Candidates)
		data["candidates"] = candidates
	}
	return data
}

func ResolveResourceBundlePaths(paths []string) ([]ResourceBundleResolution, error) {
	resolutions, err := ResolveResourceBundlePathsDetailed(paths)
	if err != nil {
		return nil, err
	}
	return resolutions, nil
}

func ResolveResourceBundlePathsDetailed(paths []string) ([]ResourceBundleResolution, error) {
	if len(paths) == 0 {
		return nil, &ResourceBundleResolveError{
			Code:    "empty_path",
			Message: "资源路径不能为空",
		}
	}
	resolutions := make([]ResourceBundleResolution, 0, len(paths))
	for _, path := range paths {
		resolution, err := ResolveResourceBundlePath(path)
		if err != nil {
			return resolutions, err
		}
		resolutions = append(resolutions, resolution)
	}
	return resolutions, nil
}

func ResolveResourceBundlePath(path string) (ResourceBundleResolution, error) {
	trimmed := strings.TrimSpace(path)
	if trimmed == "" {
		return ResourceBundleResolution{}, &ResourceBundleResolveError{
			Code:    "empty_path",
			Message: "资源路径不能为空",
		}
	}

	absPath, err := filepath.Abs(trimmed)
	if err != nil {
		return ResourceBundleResolution{}, &ResourceBundleResolveError{
			InputPath: trimmed,
			Code:      "invalid_path",
			Message:   "资源路径无法解析",
		}
	}

	info, err := os.Stat(absPath)
	if err != nil {
		message := "资源路径无法读取"
		if os.IsNotExist(err) {
			message = "资源路径不存在"
		}
		return ResourceBundleResolution{}, &ResourceBundleResolveError{
			InputPath:    trimmed,
			InputAbsPath: absPath,
			Code:         "path_not_found",
			Message:      message,
		}
	}

	searchStart := absPath
	if !info.IsDir() {
		searchStart = filepath.Dir(absPath)
	}

	if root := findBundleRoot(searchStart); root != "" {
		return ResourceBundleResolution{
			InputPath:    trimmed,
			InputAbsPath: absPath,
			ResolvedPath: root,
			Strategy:     classifyResourceBundleStrategy(absPath, info.IsDir(), root),
		}, nil
	}

	if info.IsDir() {
		candidates := findDescendantBundleRoots(absPath, maxResourceBundleSearchDepth)
		switch len(candidates) {
		case 1:
			return ResourceBundleResolution{
				InputPath:    trimmed,
				InputAbsPath: absPath,
				ResolvedPath: candidates[0],
				Strategy:     ResourceBundleResolveDescendantUnique,
			}, nil
		case 0:
		default:
			return ResourceBundleResolution{}, &ResourceBundleResolveError{
				InputPath:    trimmed,
				InputAbsPath: absPath,
				Code:         "bundle_ambiguous",
				Message:      "资源路径命中了多个 bundle 候选，无法自动选择",
				Candidates:   candidates,
			}
		}
	}

	return ResourceBundleResolution{}, &ResourceBundleResolveError{
		InputPath:    trimmed,
		InputAbsPath: absPath,
		Code:         "bundle_not_found",
		Message:      "未能解析到包含 pipeline 目录的 bundle 根目录",
	}
}

func CheckResourceBundlesDetailed(paths []string) (string, []ResourceBundleResolution, error) {
	resolutions, err := ResolveResourceBundlePathsDetailed(paths)
	if err != nil {
		return "", resolutions, err
	}

	res, err := maa.NewResource()
	if err != nil {
		return "", resolutions, fmt.Errorf("创建资源失败: %w", err)
	}
	defer res.Destroy()

	for i, resolution := range resolutions {
		if err := loadResolvedResourceBundle(res, resolution); err != nil {
			return "", resolutions[:i+1], err
		}
		logger.Debug("MaaFW", "资源预检加载成功 [%d/%d]: %s", i+1, len(resolutions), resolution.DisplayLabel())
	}

	if !res.Loaded() {
		return "", resolutions, fmt.Errorf("资源加载后未处于 Loaded 状态")
	}
	hash, err := res.GetHash()
	if err != nil {
		return "", resolutions, fmt.Errorf("读取资源 hash 失败: %w", err)
	}
	return hash, resolutions, nil
}

func loadResolvedResourceBundle(res *maa.Resource, resolution ResourceBundleResolution) error {
	actualPath, restore, err := prepareResourceLoadPath(resolution.ResolvedPath)
	if err != nil {
		return fmt.Errorf("准备资源加载路径失败 [%s]: %w", resolution.DisplayLabel(), err)
	}
	loadJob := res.PostBundle(actualPath)
	if loadJob == nil {
		if restore != nil {
			restore()
		}
		return fmt.Errorf("发起资源加载失败 [%s]", resolution.DisplayLabel())
	}
	loadJob.Wait()
	if restore != nil {
		restore()
	}
	if !loadJob.Success() {
		return fmt.Errorf("资源加载失败 [%s]: %v", resolution.DisplayLabel(), loadJob.Status())
	}
	return nil
}

func findBundleRoot(start string) string {
	current := filepath.Clean(start)
	for {
		if isBundleRoot(current) {
			return current
		}
		parent := filepath.Dir(current)
		if parent == current {
			return ""
		}
		current = parent
	}
}

func findDescendantBundleRoots(root string, maxDepth int) []string {
	candidates := make([]string, 0)
	seen := make(map[string]struct{})
	var scan func(dir string, depth int)
	scan = func(dir string, depth int) {
		if depth >= maxDepth {
			return
		}
		entries, err := os.ReadDir(dir)
		if err != nil {
			return
		}
		for _, entry := range entries {
			if !entry.IsDir() {
				continue
			}
			name := entry.Name()
			if strings.HasPrefix(name, ".") || shouldSkipBundleSearchDir(name) {
				continue
			}
			child := filepath.Join(dir, name)
			if isBundleRoot(child) {
				if _, ok := seen[child]; !ok {
					seen[child] = struct{}{}
					candidates = append(candidates, child)
				}
				continue
			}
			scan(child, depth+1)
		}
	}
	scan(root, 0)
	sort.Strings(candidates)
	return candidates
}

func isBundleRoot(dir string) bool {
	info, err := os.Stat(filepath.Join(dir, "pipeline"))
	return err == nil && info.IsDir()
}

func shouldSkipBundleSearchDir(name string) bool {
	switch name {
	case "node_modules",
		"__pycache__",
		"venv",
		".venv",
		".git",
		".idea",
		".vscode",
		"debug",
		"logs",
		"cache",
		"config":
		return true
	default:
		return false
	}
}

func classifyResourceBundleStrategy(absPath string, isDir bool, root string) ResourceBundleResolveStrategy {
	if isDir && sameCleanPath(absPath, root) {
		return ResourceBundleResolveExactRoot
	}

	rel, err := filepath.Rel(root, absPath)
	if err != nil {
		return ResourceBundleResolveAncestorChild
	}
	rel = filepath.ToSlash(rel)
	switch {
	case rel == ".":
		return ResourceBundleResolveAncestorChild
	case rel == "pipeline" || strings.HasPrefix(rel, "pipeline/"):
		return ResourceBundleResolveAncestorPipeline
	case rel == "image" || strings.HasPrefix(rel, "image/"):
		return ResourceBundleResolveAncestorImage
	case rel == "model" || strings.HasPrefix(rel, "model/"):
		return ResourceBundleResolveAncestorModel
	default:
		return ResourceBundleResolveAncestorChild
	}
}

func sameCleanPath(a, b string) bool {
	cleanA := filepath.Clean(a)
	cleanB := filepath.Clean(b)
	return cleanA == cleanB || strings.EqualFold(cleanA, cleanB)
}

func preferResourcePathLabel(primary, fallback string) string {
	if strings.TrimSpace(primary) != "" {
		return primary
	}
	return fallback
}
