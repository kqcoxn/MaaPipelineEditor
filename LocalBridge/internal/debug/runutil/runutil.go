package runutil

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/protocol"
)

func UsesLiveController(mode protocol.RunMode) bool {
	switch mode {
	case protocol.RunModeRunFromNode,
		protocol.RunModeSingleNodeRun,
		protocol.RunModeRecognitionOnly,
		protocol.RunModeActionOnly:
		return true
	default:
		return false
	}
}

func NonEmptyResourcePaths(paths []string) []string {
	result := make([]string, 0, len(paths))
	for _, path := range paths {
		if strings.TrimSpace(path) != "" {
			result = append(result, strings.TrimSpace(path))
		}
	}
	return result
}

func ResolveFixedImagePath(req protocol.RunRequest, root string) (string, error) {
	if req.Input == nil {
		return "", fmt.Errorf("fixed-image-recognition 缺少 input")
	}

	if strings.TrimSpace(req.Input.ImageRelativePath) != "" {
		return resolveRelativeImagePath(req.Input.ImageRelativePath, req.Profile.ResourcePaths)
	}

	if strings.TrimSpace(req.Input.ImagePath) != "" {
		return resolveImagePath(req.Input.ImagePath, root, req.Profile.ResourcePaths)
	}

	return "", fmt.Errorf("fixed-image-recognition 需要 input.imageRelativePath 或 input.imagePath")
}

func resolveRelativeImagePath(relativePath string, resourcePaths []string) (string, error) {
	rel := filepath.Clean(filepath.FromSlash(strings.TrimSpace(relativePath)))
	if rel == "." || filepath.IsAbs(rel) || strings.HasPrefix(rel, ".."+string(filepath.Separator)) || rel == ".." {
		return "", fmt.Errorf("无效的 imageRelativePath: %s", relativePath)
	}

	for _, resourcePath := range NonEmptyResourcePaths(resourcePaths) {
		imageDir, err := filepath.Abs(filepath.Join(resourcePath, "image"))
		if err != nil {
			continue
		}
		candidate := filepath.Join(imageDir, rel)
		if !IsPathWithin(candidate, imageDir) {
			continue
		}
		if fileExists(candidate) {
			return candidate, nil
		}
	}

	return "", fmt.Errorf("图片不存在于已选 resource image 目录: %s", relativePath)
}

func resolveImagePath(path string, root string, resourcePaths []string) (string, error) {
	raw := strings.TrimSpace(path)
	if raw == "" {
		return "", fmt.Errorf("图片路径为空")
	}

	candidate := filepath.Clean(raw)
	if !filepath.IsAbs(candidate) {
		if strings.TrimSpace(root) == "" {
			return "", fmt.Errorf("相对 imagePath 需要项目根目录")
		}
		candidate = filepath.Join(root, candidate)
	}

	abs, err := filepath.Abs(candidate)
	if err != nil {
		return "", fmt.Errorf("解析图片路径失败: %w", err)
	}

	if !isAllowedImagePath(abs, root, resourcePaths) {
		return "", fmt.Errorf("图片路径必须位于项目根目录或已选 resource 路径内: %s", abs)
	}
	if !fileExists(abs) {
		return "", fmt.Errorf("图片文件不存在: %s", abs)
	}
	return abs, nil
}

func isAllowedImagePath(path string, root string, resourcePaths []string) bool {
	if strings.TrimSpace(root) != "" && IsPathWithin(path, root) {
		return true
	}
	for _, resourcePath := range NonEmptyResourcePaths(resourcePaths) {
		if IsPathWithin(path, resourcePath) {
			return true
		}
	}
	return false
}

func IsPathWithin(path string, root string) bool {
	absPath, err := filepath.Abs(path)
	if err != nil {
		return false
	}
	absRoot, err := filepath.Abs(root)
	if err != nil {
		return false
	}
	rel, err := filepath.Rel(absRoot, absPath)
	if err != nil {
		return false
	}
	return rel == "." || (!filepath.IsAbs(rel) && rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator)))
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}
