package config

import (
	"fmt"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/utils"
)

type InterfaceProject struct {
	Root string `mapstructure:"root" json:"root"`
	Path string `mapstructure:"path" json:"path"`
}

func interfaceRootKey(root string) string {
	if resolved, err := filepath.EvalSymlinks(root); err == nil {
		root = resolved
	}
	root = filepath.Clean(utils.NormalizeWindowsPath(root))
	if runtime.GOOS == "windows" {
		root = strings.ToLower(root)
	}
	return root
}

func (c *Config) projectInterfacePath() string {
	key := interfaceRootKey(c.EffectiveRoot())
	for _, project := range c.Interface.Projects {
		if interfaceRootKey(project.Root) == key {
			return strings.TrimSpace(project.Path)
		}
	}
	return ""
}

// UpdateInterfacePath 修改当前运行项目的入口，不影响其他项目。
func (c *Config) UpdateInterfacePath(value string) error {
	root := c.EffectiveRoot()
	if root == "" {
		return fmt.Errorf("尚未解析当前项目根目录")
	}
	value = strings.TrimSpace(value)
	key := interfaceRootKey(root)
	projects := make([]InterfaceProject, 0, len(c.Interface.Projects)+1)
	for _, project := range c.Interface.Projects {
		if interfaceRootKey(project.Root) != key {
			projects = append(projects, project)
		}
	}
	if value != "" {
		projects = append(projects, InterfaceProject{Root: root, Path: value})
	}
	c.Interface.Projects = projects
	c.Interface.Path = value
	return nil
}
