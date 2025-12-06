package config

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/viper"
)

// ServerConfig 服务器配置
type ServerConfig struct {
	Port int    `mapstructure:"port"`
	Host string `mapstructure:"host"`
}

// FileConfig 文件相关配置
type FileConfig struct {
	Root       string   `mapstructure:"root"`
	Exclude    []string `mapstructure:"exclude"`
	Extensions []string `mapstructure:"extensions"`
}

// LogConfig 日志配置
type LogConfig struct {
	Level        string `mapstructure:"level"`
	Dir          string `mapstructure:"dir"`
	PushToClient bool   `mapstructure:"push_to_client"`
}

// MaaFWConfig MaaFramework配置 - TODO
type MaaFWConfig struct {
	Enabled bool   `mapstructure:"enabled"`
	LibDir  string `mapstructure:"lib_dir"`
}

// Config 全局配置
type Config struct {
	Server ServerConfig `mapstructure:"server"`
	File   FileConfig   `mapstructure:"file"`
	Log    LogConfig    `mapstructure:"log"`
	MaaFW  MaaFWConfig  `mapstructure:"maafw"`
}

// 全局单例
var globalConfig *Config

// 加载配置
func Load(configPath string) (*Config, error) {
	v := viper.New()

	// 设置默认值
	setDefaults(v)

	// 指定配置文件路径
	if configPath != "" {
		v.SetConfigFile(configPath)
	} else {
		// 查找默认配置文件
		v.SetConfigName("default")
		v.SetConfigType("json")
		v.AddConfigPath("./config")
		v.AddConfigPath(".")
	}

	// 读取配置文件
	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("读取配置文件失败: %w", err)
		}
	}

	// 解析配置
	cfg := &Config{}
	if err := v.Unmarshal(cfg); err != nil {
		return nil, fmt.Errorf("解析配置失败: %w", err)
	}

	// 处理相对路径
	if err := cfg.normalize(); err != nil {
		return nil, err
	}

	globalConfig = cfg
	return cfg, nil
}

// 获取全局配置
func GetGlobal() *Config {
	return globalConfig
}

// 设置默认值
func setDefaults(v *viper.Viper) {
	// 服务器配置
	v.SetDefault("server.port", 9066)
	v.SetDefault("server.host", "localhost")

	// 文件相关配置
	v.SetDefault("file.root", "./")
	v.SetDefault("file.exclude", []string{"node_modules", ".git", "dist", "build"})
	v.SetDefault("file.extensions", []string{".json", ".jsonc"})

	// 日志配置
	v.SetDefault("log.level", "INFO")
	v.SetDefault("log.dir", "./logs")
	v.SetDefault("log.push_to_client", false)

	// MaaFramework 配置
	v.SetDefault("maafw.enabled", false)
	v.SetDefault("maafw.lib_dir", "")
}

// 规范化配置路径
func (c *Config) normalize() error {
	// 处理文件根目录路径
	if !filepath.IsAbs(c.File.Root) {
		absPath, err := filepath.Abs(c.File.Root)
		if err != nil {
			return fmt.Errorf("解析根目录路径失败: %w", err)
		}
		c.File.Root = absPath
	}

	// 验证根目录是否存在
	if _, err := os.Stat(c.File.Root); os.IsNotExist(err) {
		return fmt.Errorf("根目录不存在: %s", c.File.Root)
	}

	// 处理日志目录路径
	if c.Log.Dir != "" && !filepath.IsAbs(c.Log.Dir) {
		absPath, err := filepath.Abs(c.Log.Dir)
		if err != nil {
			return fmt.Errorf("解析日志目录路径失败: %w", err)
		}
		c.Log.Dir = absPath
	}

	return nil
}

// 从命令行参数覆盖配置
func (c *Config) OverrideFromFlags(root, logDir, logLevel string, port int) {
	if root != "" {
		c.File.Root = root
	}
	if logDir != "" {
		c.Log.Dir = logDir
	}
	if logLevel != "" {
		c.Log.Level = logLevel
	}
	if port > 0 {
		c.Server.Port = port
	}

	// 重新规范化路径
	c.normalize()
}
