package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/paths"
	"github.com/spf13/viper"
)

// 服务器配置
type ServerConfig struct {
	Port           int      `mapstructure:"port" json:"port"`
	Host           string   `mapstructure:"host" json:"host"`
	AllowedOrigins []string `mapstructure:"allowed_origins" json:"allowed_origins"`
}

// 文件相关配置
type FileConfig struct {
	Root       string   `mapstructure:"root" json:"root,omitempty"`
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

// InterfaceConfig 配置 Project Interface V2 入口。Path 为空时自动检索。
type InterfaceConfig struct {
	Path string `mapstructure:"path" json:"path"`
}

// 全局配置
type Config struct {
	Server    ServerConfig    `mapstructure:"server" json:"server"`
	File      FileConfig      `mapstructure:"file" json:"file"`
	Log       LogConfig       `mapstructure:"log" json:"log"`
	MaaFW     MaaFWConfig     `mapstructure:"maafw" json:"maafw"`
	Interface InterfaceConfig `mapstructure:"interface" json:"interface"`

	configFilePath string
	runtime        RuntimeConfig
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

	// 解析配置
	cfg := &Config{}
	if err := v.Unmarshal(cfg); err != nil {
		return nil, fmt.Errorf("解析配置失败: %w", err)
	}

	cfg.configFilePath = v.ConfigFileUsed()
	if err := cfg.normalizePersistent(); err != nil {
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
	v.SetDefault("server.allowed_origins", []string{
		"https://mpe.codax.site",
		"http://localhost",
		"http://127.0.0.1",
		"http://[::1]",
	})

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

	// Project Interface 配置
	v.SetDefault("interface.path", "")
}

// normalizePersistent 只规范化磁盘配置，不解析运行时文件根目录。
func (c *Config) normalizePersistent() error {
	c.File.Root = normalizeConfiguredRoot(c.File.Root)

	// 处理日志目录路径
	if c.Log.Dir != "" && !filepath.IsAbs(c.Log.Dir) {
		absPath, err := filepath.Abs(c.Log.Dir)
		if err != nil {
			return fmt.Errorf("解析日志目录路径失败: %w", err)
		}
		c.Log.Dir = absPath
	}

	c.Interface.Path = strings.TrimSpace(c.Interface.Path)

	return nil
}

func (c *Config) ResolvedMaaFWLibDir() string {
	if pathExists(c.MaaFW.LibDir) {
		return strings.TrimSpace(c.MaaFW.LibDir)
	}
	if defaultLibDir := bundledMaaFWLibDir(); pathExists(defaultLibDir) {
		return defaultLibDir
	}
	return strings.TrimSpace(c.MaaFW.LibDir)
}

func (c *Config) ResolvedMaaFWResourceDir() string {
	if pathExists(c.MaaFW.ResourceDir) {
		return strings.TrimSpace(c.MaaFW.ResourceDir)
	}
	if defaultResourceDir := bundledMaaFWResourceDir(); pathExists(defaultResourceDir) {
		return defaultResourceDir
	}
	return strings.TrimSpace(c.MaaFW.ResourceDir)
}

// ResolvedMaaFWAgentDir 返回 MaaFramework 发行包中的 MaaAgentBinary 目录。
func (c *Config) ResolvedMaaFWAgentDir() string {
	libDir := c.ResolvedMaaFWLibDir()
	if libDir == "" {
		return ""
	}
	candidate := filepath.Join(filepath.Dir(libDir), "share", "MaaAgentBinary")
	if pathExists(candidate) {
		return candidate
	}
	return ""
}

func pathExists(path string) bool {
	trimmed := strings.TrimSpace(path)
	if trimmed == "" {
		return false
	}
	_, err := os.Stat(trimmed)
	return err == nil
}

func bundledMaaFWLibDir() string {
	return filepath.Join(paths.GetExeDir(), "runtime", "maafw", "bin")
}

func bundledMaaFWResourceDir() string {
	return filepath.Join(paths.GetExeDir(), "runtime", "resource")
}

// OverrideFromFlags 解析当前进程的有效配置。命令行值只在运行时生效。
func (c *Config) OverrideFromFlags(
	root, interfacePath, logDir, logLevel string,
	port int,
	rootSpecified, interfaceSpecified bool,
) error {
	cwd, err := os.Getwd()
	if err != nil {
		return fmt.Errorf("获取当前工作目录失败: %w", err)
	}

	runtime, err := resolveFileRoot(c.File.Root, root, rootSpecified, c.configFilePath, cwd)
	if err != nil {
		return err
	}
	c.runtime = runtime

	if logDir != "" {
		c.Log.Dir = logDir
	}
	if logLevel != "" {
		c.Log.Level = logLevel
	}
	if port > 0 {
		c.Server.Port = port
	}
	if interfaceSpecified {
		c.Interface.Path = strings.TrimSpace(interfacePath)
	}

	return c.normalizeRuntimePaths()
}

func (c *Config) normalizeRuntimePaths() error {
	if c.Log.Dir != "" && !filepath.IsAbs(c.Log.Dir) {
		absPath, err := filepath.Abs(c.Log.Dir)
		if err != nil {
			return fmt.Errorf("解析日志目录路径失败: %w", err)
		}
		c.Log.Dir = absPath
	}
	return nil
}

// 返回当前配置文件路径
func GetConfigFilePath() string {
	if globalConfig != nil && globalConfig.configFilePath != "" {
		return globalConfig.configFilePath
	}
	return paths.GetConfigFile()
}

// 保存配置到文件
func (c *Config) Save() error {
	if c.configFilePath == "" {
		return fmt.Errorf("配置文件路径未知，无法保存")
	}

	persistent := *c
	persistent.File.Root = normalizeConfiguredRoot(persistent.File.Root)
	data, err := json.MarshalIndent(&persistent, "", "    ")
	if err != nil {
		return fmt.Errorf("序列化配置失败: %w", err)
	}

	if err := os.WriteFile(c.configFilePath, data, 0644); err != nil {
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

// SetInterfacePath 设置 PI 入口；空值恢复自动检索。
func (c *Config) SetInterfacePath(interfacePath string) error {
	c.Interface.Path = strings.TrimSpace(interfacePath)
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

	if c.EffectiveRoot() == "" {
		return result
	}

	root := filepath.Clean(c.EffectiveRoot())

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
