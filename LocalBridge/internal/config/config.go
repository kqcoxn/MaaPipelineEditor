package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/viper"
)

// 服务器配置
type ServerConfig struct {
	Port int    `mapstructure:"port"`
	Host string `mapstructure:"host"`
}

// 文件相关配置
type FileConfig struct {
	Root       string   `mapstructure:"root"`
	Exclude    []string `mapstructure:"exclude"`
	Extensions []string `mapstructure:"extensions"`
}

// 日志配置
type LogConfig struct {
	Level        string `mapstructure:"level"`
	Dir          string `mapstructure:"dir"`
	PushToClient bool   `mapstructure:"push_to_client"`
}

// MaaFramework配置
type MaaFWConfig struct {
	Enabled     bool   `mapstructure:"enabled"`
	LibDir      string `mapstructure:"lib_dir"`
	ResourceDir string `mapstructure:"resource_dir"`
}

// 更新配置
type UpdateConfig struct {
	Enabled    bool   `mapstructure:"enabled"`     // 是否启用更新检查
	AutoUpdate bool   `mapstructure:"auto_update"` // 是否自动更新
	ProxyURL   string `mapstructure:"proxy_url"`   // HTTP(S) 代理地址，留空则使用系统代理
}

// 全局配置
type Config struct {
	Server ServerConfig `mapstructure:"server"`
	File   FileConfig   `mapstructure:"file"`
	Log    LogConfig    `mapstructure:"log"`
	MaaFW  MaaFWConfig  `mapstructure:"maafw"`
	Update UpdateConfig `mapstructure:"update"`
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

	// 记录配置文件路径
	configFilePath = v.ConfigFileUsed()

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
	v.SetDefault("maafw.lib_dir", "./deps/maafw")
	v.SetDefault("maafw.resource_dir", "./deps/ocr_model_res")

	// 更新配置
	v.SetDefault("update.enabled", true)
	v.SetDefault("update.auto_update", false)
	v.SetDefault("update.proxy_url", "")
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

// 配置文件路径
var configFilePath string

// 返回当前配置文件路径
func GetConfigFilePath() string {
	return configFilePath
}

// 保存配置到文件
func (c *Config) Save() error {
	if configFilePath == "" {
		return fmt.Errorf("配置文件路径未知，无法保存")
	}

	// 读取原始文件内容以保留格式
	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return fmt.Errorf("序列化配置失败: %w", err)
	}

	if err := os.WriteFile(configFilePath, data, 0644); err != nil {
		return fmt.Errorf("写入配置文件失败: %w", err)
	}

	return nil
}

// 设置 MaaFramework lib 目录并保存
func (c *Config) SetMaaFWLibDir(libDir string) error {
	c.MaaFW.LibDir = libDir
	return c.Save()
}

// 设置 MaaFramework 资源目录并保存
func (c *Config) SetMaaFWResourceDir(resourceDir string) error {
	c.MaaFW.ResourceDir = resourceDir
	return c.Save()
}
