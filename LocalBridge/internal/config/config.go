package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/paths"
	"github.com/spf13/viper"
)

// 服务器配置
type ServerConfig struct {
	Port int    `mapstructure:"port" json:"port"`
	Host string `mapstructure:"host" json:"host"`
}

// 文件相关配置
type FileConfig struct {
	Root       string   `mapstructure:"root" json:"root"`
	Exclude    []string `mapstructure:"exclude" json:"exclude"`
	Extensions []string `mapstructure:"extensions" json:"extensions"`
	MaxDepth   int      `mapstructure:"max_depth" json:"max_depth"` // 最大扫描深度，0 表示无限制
	MaxFiles   int      `mapstructure:"max_files" json:"max_files"` // 最大文件数量，0 表示无限制
}

// 日志配置
type LogConfig struct {
	Level        string `mapstructure:"level" json:"level"`
	Dir          string `mapstructure:"dir" json:"dir"`
	PushToClient bool   `mapstructure:"push_to_client" json:"push_to_client"`
}

// MaaFramework配置
type MaaFWConfig struct {
	Enabled     bool   `mapstructure:"enabled" json:"enabled"`
	LibDir      string `mapstructure:"lib_dir" json:"lib_dir"`
	ResourceDir string `mapstructure:"resource_dir" json:"resource_dir"`
}

// 全局配置
type Config struct {
	Server ServerConfig `mapstructure:"server" json:"server"`
	File   FileConfig   `mapstructure:"file" json:"file"`
	Log    LogConfig    `mapstructure:"log" json:"log"`
	MaaFW  MaaFWConfig  `mapstructure:"maafw" json:"maafw"`
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
		// 确保配置文件存在
		defaultConfigPath, err := paths.EnsureConfigFile()
		if err != nil {
			return nil, fmt.Errorf("创建配置文件失败: %w", err)
		}
		v.SetConfigFile(defaultConfigPath)
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
	v.SetDefault("file.exclude", []string{"node_modules", ".git", "dist", "build", ".cache", ".venv", "__pycache__", ".idea", ".vscode"})
	v.SetDefault("file.extensions", []string{".json", ".jsonc"})
	v.SetDefault("file.max_depth", 10)    // 默认最大深度 10 层
	v.SetDefault("file.max_files", 10000) // 默认最大文件数 10000

	// 日志配置
	v.SetDefault("log.level", "INFO")
	v.SetDefault("log.dir", paths.GetLogDir())
	v.SetDefault("log.push_to_client", true)

	// MaaFramework 配置
	v.SetDefault("maafw.enabled", false)
	v.SetDefault("maafw.lib_dir", "")
	v.SetDefault("maafw.resource_dir", "")
}

// 规范化配置路径
func (c *Config) normalize() error {
	// 处理文件根目录路径
	if c.File.Root != "" && !filepath.IsAbs(c.File.Root) {
		absPath, err := filepath.Abs(c.File.Root)
		if err != nil {
			return fmt.Errorf("解析根目录路径失败: %w", err)
		}
		c.File.Root = absPath
	}

	// 验证根目录是否存在
	if c.File.Root != "" {
		if _, err := os.Stat(c.File.Root); os.IsNotExist(err) {
			return fmt.Errorf("根目录不存在: %s", c.File.Root)
		}
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
	} else {
		// 使用当前工作目录
		wd, err := os.Getwd()
		if err != nil {
			// 如果获取失败，回退到 "./"
			c.File.Root = "./"
		} else {
			c.File.Root = wd
		}
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
	if configFilePath != "" {
		return configFilePath
	}
	return paths.GetConfigFile()
}

// 保存配置到文件
func (c *Config) Save() error {
	if configFilePath == "" {
		return fmt.Errorf("配置文件路径未知，无法保存")
	}

	// 序列化配置
	data, err := json.MarshalIndent(c, "", "    ")
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

// 安全检查结果
type SafetyCheckResult struct {
	IsRisky     bool     // 是否有风险
	RiskLevel   string   // 风险等级：high, medium, low
	RiskReasons []string // 风险原因
	Suggestions []string // 建议
}

// 检查根目录安全性
func (c *Config) CheckRootSafety() SafetyCheckResult {
	result := SafetyCheckResult{
		RiskReasons: []string{},
		Suggestions: []string{},
	}

	if c.File.Root == "" {
		return result
	}

	root := filepath.Clean(c.File.Root)

	// 高风险目录检测
	highRiskDirs := getHighRiskDirs()
	for _, dir := range highRiskDirs {
		if root == dir || (len(root) > len(dir) && root[:len(dir)+1] == dir+string(filepath.Separator)) {
			result.IsRisky = true
			result.RiskLevel = "high"
			result.RiskReasons = append(result.RiskReasons, "扫描目录位于高风险系统目录内")
			result.Suggestions = append(result.Suggestions, "建议指定具体的项目目录而非系统目录")
			break
		}
	}

	// 检查是否是驱动器根目录
	if isDriveRoot(root) {
		result.IsRisky = true
		result.RiskLevel = "high"
		result.RiskReasons = append(result.RiskReasons, "扫描目录是驱动器根目录")
		result.Suggestions = append(result.Suggestions, "建议指定具体的项目目录，如 'C:\\MyProject'")
	}

	// 检查是否是用户主目录（中等风险）
	homeDir, _ := os.UserHomeDir()
	if homeDir != "" && (root == homeDir || (len(root) > len(homeDir) && root[:len(homeDir)+1] == homeDir+string(filepath.Separator))) {
		if root == homeDir {
			result.IsRisky = true
			result.RiskLevel = "medium"
			result.RiskReasons = append(result.RiskReasons, "扫描目录是用户主目录")
			result.Suggestions = append(result.Suggestions, "建议指定具体的项目目录，如 '"+homeDir+"\\MyProject'")
		}
	}

	// 检查扫描限制配置
	if c.File.MaxDepth == 0 {
		result.RiskReasons = append(result.RiskReasons, "未设置扫描深度限制（max_depth=0 表示无限制）")
		result.Suggestions = append(result.Suggestions, "建议设置 max_depth 为合理值（如 15）")
		if result.RiskLevel == "" {
			result.RiskLevel = "low"
		}
	}

	if c.File.MaxFiles == 0 {
		result.RiskReasons = append(result.RiskReasons, "未设置文件数量限制（max_files=0 表示无限制）")
		result.Suggestions = append(result.Suggestions, "建议设置 max_files 为合理值（如 5000）")
		if result.RiskLevel == "" {
			result.RiskLevel = "low"
		}
	}

	return result
}

// 获取高风险目录列表
func getHighRiskDirs() []string {
	var dirs []string

	// 常见的系统目录
	switch {
	case filepath.IsAbs("C:\\Windows"):
		dirs = append(dirs, "C:\\Windows", "C:\\Program Files", "C:\\Program Files (x86)", "C:\\ProgramData")
	case filepath.IsAbs("/usr"):
		dirs = append(dirs, "/usr", "/bin", "/sbin", "/etc", "/var", "/sys", "/proc")
	case filepath.IsAbs("/System"):
		dirs = append(dirs, "/System", "/Library", "/Applications")
	}

	// 添加驱动器根目录（Windows）
	for _, drive := range []string{"C:", "D:", "E:", "F:"} {
		if filepath.IsAbs(drive + string(filepath.Separator)) {
			dirs = append(dirs, drive+string(filepath.Separator))
		}
	}

	// Unix 根目录
	if filepath.IsAbs("/") {
		dirs = append(dirs, "/")
	}

	return dirs
}

// 检查是否是驱动器根目录
func isDriveRoot(path string) bool {
	// Windows: C:\, D:\ 等
	if len(path) == 3 && path[1] == ':' && (path[2] == '\\' || path[2] == '/') {
		return true
	}
	// Unix: /
	if path == "/" {
		return true
	}
	return false
}
