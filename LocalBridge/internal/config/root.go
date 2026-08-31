package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// RootSource 表示当前文件根目录的来源。
type RootSource string

const (
	RootSourceCLI    RootSource = "cli"
	RootSourceConfig RootSource = "config"
	RootSourceCWD    RootSource = "cwd"
)

// RuntimeConfig 保存仅在当前进程生效、不会写入配置文件的值。
type RuntimeConfig struct {
	FileRoot   string     `json:"file_root"`
	RootSource RootSource `json:"root_source"`
}

// Runtime 返回当前进程实际使用的运行时配置。
func (c *Config) Runtime() RuntimeConfig {
	return c.runtime
}

// EffectiveRoot 返回当前进程实际使用的文件根目录。
func (c *Config) EffectiveRoot() string {
	return c.runtime.FileRoot
}

// SetFileRoot 更新需要持久化的文件根目录。运行中的服务仍使用启动时解析出的根目录。
func (c *Config) SetFileRoot(root string) {
	c.File.Root = normalizeConfiguredRoot(root)
}

func resolveFileRoot(
	configuredRoot, cliRoot string,
	cliSpecified bool,
	configPath, cwd string,
) (RuntimeConfig, error) {
	configuredRoot = normalizeConfiguredRoot(configuredRoot)

	var root string
	var source RootSource
	switch {
	case cliSpecified:
		root = strings.TrimSpace(cliRoot)
		if root == "" {
			return RuntimeConfig{}, fmt.Errorf("--root 不能为空")
		}
		source = RootSourceCLI
	case configuredRoot != "":
		root = configuredRoot
		source = RootSourceConfig
	default:
		root = cwd
		source = RootSourceCWD
	}

	baseDir := cwd
	if source == RootSourceConfig && configPath != "" {
		baseDir = filepath.Dir(configPath)
	}
	resolvedRoot, err := resolvePathFromBase(root, baseDir)
	if err != nil {
		return RuntimeConfig{}, fmt.Errorf("解析文件根目录失败（来源: %s）: %w", source, err)
	}
	info, err := os.Stat(resolvedRoot)
	if err != nil {
		return RuntimeConfig{}, fmt.Errorf("文件根目录不可用（来源: %s）: %s: %w", source, resolvedRoot, err)
	}
	if !info.IsDir() {
		return RuntimeConfig{}, fmt.Errorf("文件根目录不是目录（来源: %s）: %s", source, resolvedRoot)
	}

	return RuntimeConfig{FileRoot: resolvedRoot, RootSource: source}, nil
}

func resolvePathFromBase(path, baseDir string) (string, error) {
	if filepath.VolumeName(path) != "" && !filepath.IsAbs(path) {
		return "", fmt.Errorf("不支持带盘符的相对路径: %s", path)
	}
	if !filepath.IsAbs(path) {
		path = filepath.Join(baseDir, path)
	}
	absPath, err := filepath.Abs(path)
	if err != nil {
		return "", err
	}
	return filepath.Clean(absPath), nil
}

func normalizeConfiguredRoot(root string) string {
	root = strings.TrimSpace(root)
	if root == "" || filepath.Clean(root) == "." {
		return ""
	}
	return root
}
