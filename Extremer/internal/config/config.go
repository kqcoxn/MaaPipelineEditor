package config

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// Config 主配置结构体
type Config struct {
	Version     string            `json:"version"`
	Components  ComponentsConfig  `json:"components"`
	LocalBridge LocalBridgeConfig `json:"localbridge"`
	Frontend    FrontendConfig    `json:"frontend"`
	Mfw         MfwConfig         `json:"mfw"`
	Ocr         OcrConfig         `json:"ocr"`
	Update      UpdateConfig      `json:"update"`
	Logs        LogsConfig        `json:"logs"`
}

// ComponentsConfig 组件版本配置
type ComponentsConfig struct {
	Frontend    string `json:"frontend"`
	LocalBridge string `json:"localbridge"`
	Mfw         string `json:"mfw"`
	Ocr         string `json:"ocr"`
}

// LocalBridgeConfig LocalBridge 配置
type LocalBridgeConfig struct {
	ExePath            string `json:"exePath"`
	Port               int    `json:"port"`
	ConfigPath         string `json:"configPath"`
	AutoRestart        bool   `json:"autoRestart"`
	HealthCheckTimeout int    `json:"healthCheckTimeout"`
}

// FrontendConfig 前端配置
type FrontendConfig struct {
	Mode        string `json:"mode"`
	OfflinePath string `json:"offlinePath"`
}

// MfwConfig MaaFramework 配置
type MfwConfig struct {
	BasePath string `json:"basePath"`
}

// OcrConfig OCR 配置
type OcrConfig struct {
	BasePath string `json:"basePath"`
}

// UpdateConfig 更新配置
type UpdateConfig struct {
	Enabled        bool   `json:"enabled"`
	Channel        string `json:"channel"`
	ManifestURL    string `json:"manifestUrl"`
	CheckOnStartup bool   `json:"checkOnStartup"`
	AutoDownload   bool   `json:"autoDownload"`
}

// LogsConfig 日志配置
type LogsConfig struct {
	Level              string `json:"level"`
	ExtremeLogPath     string `json:"extremerLogPath"`
	LocalBridgeLogPath string `json:"localbridgeLogPath"`
	MaxSizeMB          int    `json:"maxSizeMB"`
	MaxBackups         int    `json:"maxBackups"`
}

// Default 返回默认配置
func Default() *Config {
	return &Config{
		Version: "1.0.0",
		Components: ComponentsConfig{
			Frontend:    "1.0.0",
			LocalBridge: "1.0.0",
			Mfw:         "2.0.0",
			Ocr:         "1.0.0",
		},
		LocalBridge: LocalBridgeConfig{
			ExePath:            "./bin/localbridge.exe",
			Port:               7100,
			ConfigPath:         "./config/localbridge.json",
			AutoRestart:        true,
			HealthCheckTimeout: 10000,
		},
		Frontend: FrontendConfig{
			Mode:        "offline",
			OfflinePath: "./web/index.html",
		},
		Mfw: MfwConfig{
			BasePath: "./mfw",
		},
		Ocr: OcrConfig{
			BasePath: "./ocr",
		},
		Update: UpdateConfig{
			Enabled:        true,
			Channel:        "stable",
			ManifestURL:    "https://raw.githubusercontent.com/kqcoxn/MaaPipelineEditor/main/release/manifest.json",
			CheckOnStartup: true,
			AutoDownload:   false,
		},
		Logs: LogsConfig{
			Level:              "INFO",
			ExtremeLogPath:     "./logs/extremer.log",
			LocalBridgeLogPath: "./logs/localbridge.log",
			MaxSizeMB:          50,
			MaxBackups:         3,
		},
	}
}

// Load 从文件加载配置
func Load() (*Config, error) {
	// 获取可执行文件所在目录
	exePath, err := os.Executable()
	if err != nil {
		return nil, err
	}
	baseDir := filepath.Dir(exePath)
	configPath := filepath.Join(baseDir, "config", "extremer.json")

	return LoadFromFile(configPath)
}

// LoadFromFile 从指定文件加载配置
func LoadFromFile(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	cfg := Default()
	if err := json.Unmarshal(data, cfg); err != nil {
		return nil, err
	}

	return cfg, nil
}

// Save 保存配置到文件
func (c *Config) Save() error {
	exePath, err := os.Executable()
	if err != nil {
		return err
	}
	baseDir := filepath.Dir(exePath)
	configPath := filepath.Join(baseDir, "config", "extremer.json")

	return c.SaveToFile(configPath)
}

// SaveToFile 保存配置到指定文件
func (c *Config) SaveToFile(path string) error {
	// 确保目录存在
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(path, data, 0644)
}

// GetBasePath 获取应用基础路径
func GetBasePath() (string, error) {
	exePath, err := os.Executable()
	if err != nil {
		return "", err
	}
	return filepath.Dir(exePath), nil
}

// ResolvePath 解析相对路径为绝对路径
func ResolvePath(basePath, relativePath string) string {
	if filepath.IsAbs(relativePath) {
		return relativePath
	}
	return filepath.Join(basePath, relativePath)
}
