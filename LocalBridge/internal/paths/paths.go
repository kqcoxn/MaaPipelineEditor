package paths

import (
	"os"
	"path/filepath"
	"runtime"
	"sync"
)

const (
	AppName = "MaaPipelineEditor"
	SubName = "LocalBridge"
)

// 运行模式
type Mode int

const (
	ModeUser     Mode = iota // 用户模式：使用系统用户数据目录
	ModeDev                  // 开发模式：使用可执行文件同目录
	ModePortable             // 便携模式：使用可执行文件同目录（用户指定）
)

var (
	once        sync.Once
	currentMode Mode
	dataDir     string
	exeDir      string

	// 是否强制使用便携模式
	forcePortable bool
)

// SetPortableMode 设置便携模式
func SetPortableMode(portable bool) {
	forcePortable = portable
}

// Init 初始化路径系统
func Init() {
	once.Do(func() {
		initPaths()
	})
}

// initPaths 初始化路径
func initPaths() {
	// 获取可执行文件目录
	exePath, err := os.Executable()
	if err != nil {
		// 回退到当前工作目录
		exeDir, _ = os.Getwd()
	} else {
		exeDir = filepath.Dir(exePath)
	}

	// 确定运行模式
	currentMode = detectMode()

	// 根据模式设置数据目录
	switch currentMode {
	case ModeDev, ModePortable:
		dataDir = exeDir
	case ModeUser:
		dataDir = getUserDataDir()
	}

	// 确保数据目录存在
	ensureDir(dataDir)
}

// detectMode 检测运行模式
func detectMode() Mode {
	// 1. 命令行参数优先
	if forcePortable {
		return ModePortable
	}

	// 2. 检查可执行文件旁是否有 config 目录
	configDir := filepath.Join(exeDir, "config")
	if info, err := os.Stat(configDir); err == nil && info.IsDir() {
		return ModeDev
	}

	// 3. 默认使用用户模式
	return ModeUser
}

// getUserDataDir 获取用户数据目录
func getUserDataDir() string {
	var baseDir string

	switch runtime.GOOS {
	case "windows":
		// Windows: %APPDATA%\MaaPipelineEditor\LocalBridge
		baseDir = os.Getenv("APPDATA")
		if baseDir == "" {
			baseDir = filepath.Join(os.Getenv("USERPROFILE"), "AppData", "Roaming")
		}
	case "darwin":
		// macOS: ~/Library/Application Support/MaaPipelineEditor/LocalBridge
		homeDir, _ := os.UserHomeDir()
		baseDir = filepath.Join(homeDir, "Library", "Application Support")
	default:
		// Linux: ~/.config/MaaPipelineEditor/LocalBridge 或 $XDG_CONFIG_HOME
		baseDir = os.Getenv("XDG_CONFIG_HOME")
		if baseDir == "" {
			homeDir, _ := os.UserHomeDir()
			baseDir = filepath.Join(homeDir, ".config")
		}
	}

	return filepath.Join(baseDir, AppName, SubName)
}

// ensureDir 确保目录存在
func ensureDir(dir string) error {
	return os.MkdirAll(dir, 0755)
}

// GetMode 获取当前运行模式
func GetMode() Mode {
	Init()
	return currentMode
}

// GetModeName 获取模式名称
func GetModeName() string {
	switch GetMode() {
	case ModeDev:
		return "开发模式"
	case ModePortable:
		return "便携模式"
	default:
		return "用户模式"
	}
}

// GetDataDir 获取数据目录根路径
func GetDataDir() string {
	Init()
	return dataDir
}

// GetExeDir 获取可执行文件所在目录
func GetExeDir() string {
	Init()
	return exeDir
}

// GetConfigDir 获取配置文件目录
func GetConfigDir() string {
	Init()
	return filepath.Join(dataDir, "config")
}

// GetConfigFile 获取配置文件路径
func GetConfigFile() string {
	configDir := GetConfigDir()

	// 开发模式下优先查找 default.json
	if currentMode == ModeDev {
		defaultJson := filepath.Join(configDir, "default.json")
		if _, err := os.Stat(defaultJson); err == nil {
			return defaultJson
		}
	}

	return filepath.Join(configDir, "config.json")
}

// GetLogDir 获取日志目录
func GetLogDir() string {
	Init()
	return filepath.Join(dataDir, "logs")
}

// EnsureAllDirs 确保所有必要目录存在
func EnsureAllDirs() error {
	dirs := []string{
		GetConfigDir(),
		GetLogDir(),
	}
	for _, dir := range dirs {
		if err := ensureDir(dir); err != nil {
			return err
		}
	}
	return nil
}

// GetDefaultConfigContent 获取默认配置内容
func GetDefaultConfigContent() []byte {
	return []byte(`{
  "server": {
    "port": 9066,
    "host": "localhost"
  },
  "file": {
    "root": "./",
    "exclude": ["node_modules", ".git", "dist", "build"],
    "extensions": [".json", ".jsonc"]
  },
  "log": {
    "level": "INFO",
    "push_to_client": false
  },
  "maafw": {
    "enabled": false,
    "lib_dir": "",
    "resource_dir": ""
  }
}
`)
}

// EnsureConfigFile 确保配置文件存在，不存在则创建默认配置
func EnsureConfigFile() (string, error) {
	configFile := GetConfigFile()

	// 确保目录存在
	if err := ensureDir(filepath.Dir(configFile)); err != nil {
		return "", err
	}

	// 检查文件是否存在
	if _, err := os.Stat(configFile); os.IsNotExist(err) {
		// 创建默认配置
		if err := os.WriteFile(configFile, GetDefaultConfigContent(), 0644); err != nil {
			return "", err
		}
	}

	return configFile, nil
}
