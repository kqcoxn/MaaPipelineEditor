package config

import (
	"os"
	"path/filepath"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/paths"
)

// bundledDirectory 仅解析可执行文件旁的自带依赖，不搜索外部目录。
func bundledDirectory(parts ...string) string {
	dir := filepath.Join(append([]string{paths.GetExeDir(), "runtime"}, parts...)...)
	info, err := os.Stat(dir)
	if err != nil || !info.IsDir() {
		return ""
	}
	return dir
}

func (c *Config) ResolvedMaaFWLibDir() string {
	return bundledDirectory("maafw", "bin")
}

func (c *Config) ResolvedMaaFWResourceDir() string {
	return bundledDirectory("resource")
}

func (c *Config) ResolvedMaaFWAgentDir() string {
	return bundledDirectory("maafw", "share", "MaaAgentBinary")
}
