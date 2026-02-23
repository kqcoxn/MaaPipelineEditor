package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/kqcoxn/MaaPipelineEditor/Extremer/internal/bridge"
	"github.com/kqcoxn/MaaPipelineEditor/Extremer/internal/ports"
	"github.com/kqcoxn/MaaPipelineEditor/Extremer/internal/splash"
	"github.com/kqcoxn/MaaPipelineEditor/Extremer/internal/updater"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// Extremer 客户端配置
type ExstremerConfig struct {
	MPELBPath           string `json:"mpelb_path"`
	DefaultMFWPath      string `json:"default_mfw_path"`
	DefaultResourcePath string `json:"default_resource_path"`
	RootDir             string `json:"root_dir"` // 用户自定义根目录
}

// 客户端配置文件结构
type ClientConfig struct {
	Server struct {
		Port int    `json:"port"`
		Host string `json:"host"`
	} `json:"server"`
	File struct {
		Exclude    []string `json:"exclude"`
		Extensions []string `json:"extensions"`
	} `json:"file"`
	Log struct {
		Level        string `json:"level"`
		PushToClient bool   `json:"push_to_client"`
	} `json:"log"`
	MaaFW struct {
		Enabled     bool   `json:"enabled"`
		LibDir      string `json:"lib_dir"`
		ResourceDir string `json:"resource_dir"`
	} `json:"maafw"`
	Extremer ExstremerConfig `json:"extremer"`
}

// App 应用主结构
type App struct {
	ctx        context.Context
	port       int
	bridge     *bridge.SubprocessManager
	exeDir     string
	workDir    string
	logsDir    string
	configDir  string
	configPath string
	config     *ClientConfig
	splash     splash.Splash
}

// NewApp 创建应用实例
func NewApp() *App {
	return &App{}
}

// isDevMode 检测是否在开发模式下运行
func isDevMode(exePath string) bool {
	// Wails 开发模式下，可执行文件通常在临时目录中
	// 检查路径中是否包含 Temp 目录或 wails 相关目录
	lower := strings.ToLower(exePath)
	return strings.Contains(lower, "temp") ||
		strings.Contains(lower, "tmp") ||
		strings.Contains(lower, "wailsbindings")
}

// loadConfig 加载配置文件
func (a *App) loadConfig() error {
	// 尝试加载配置文件
	configPath := filepath.Join(a.exeDir, "config", "config.json")

	// 如果不存在，使用默认配置
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		configPath = filepath.Join(a.exeDir, "config", "default.json")
	}

	// 读取配置文件
	data, err := os.ReadFile(configPath)
	if err != nil {
		// 配置文件不存在时，使用内置默认配置
		return a.useDefaultConfig()
	}

	// 解析配置
	var config ClientConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return fmt.Errorf("解析配置文件失败: %w", err)
	}

	a.config = &config
	a.configPath = configPath

	// 处理相对路径，转为绝对路径
	if config.MaaFW.LibDir != "" && !filepath.IsAbs(config.MaaFW.LibDir) {
		a.config.MaaFW.LibDir = filepath.Join(a.exeDir, config.MaaFW.LibDir)
	}
	if config.MaaFW.ResourceDir != "" && !filepath.IsAbs(config.MaaFW.ResourceDir) {
		a.config.MaaFW.ResourceDir = filepath.Join(a.exeDir, config.MaaFW.ResourceDir)
	}

	// 使用默认路径（如果配置中为空）
	if a.config.MaaFW.LibDir == "" && config.Extremer.DefaultMFWPath != "" {
		a.config.MaaFW.LibDir = filepath.Join(a.exeDir, config.Extremer.DefaultMFWPath)
	}
	if a.config.MaaFW.ResourceDir == "" && config.Extremer.DefaultResourcePath != "" {
		a.config.MaaFW.ResourceDir = filepath.Join(a.exeDir, config.Extremer.DefaultResourcePath)
	}

	return nil
}

// useDefaultConfig 使用内置默认配置
func (a *App) useDefaultConfig() error {
	// 创建默认配置
	config := ClientConfig{
		Server: struct {
			Port int    `json:"port"`
			Host string `json:"host"`
		}{
			Port: 9066,
			Host: "localhost",
		},
		File: struct {
			Exclude    []string `json:"exclude"`
			Extensions []string `json:"extensions"`
		}{
			Exclude:    []string{"node_modules", ".git", "dist", "build"},
			Extensions: []string{".json", ".jsonc"},
		},
		Log: struct {
			Level        string `json:"level"`
			PushToClient bool   `json:"push_to_client"`
		}{
			Level:        "INFO",
			PushToClient: true,
		},
		MaaFW: struct {
			Enabled     bool   `json:"enabled"`
			LibDir      string `json:"lib_dir"`
			ResourceDir string `json:"resource_dir"`
		}{
			Enabled:     true,
			LibDir:      "",
			ResourceDir: "",
		},
		Extremer: ExstremerConfig{
			MPELBPath:           "resources/mpelb.exe",
			DefaultMFWPath:      "resources/maafw/bin",
			DefaultResourcePath: "resources/resource",
		},
	}

	// 处理默认路径
	if runtime.GOOS != "windows" {
		config.Extremer.MPELBPath = "resources/mpelb"
	}

	a.config = &config
	a.configPath = "" // 标记为使用默认配置

	// 设置默认路径
	a.config.MaaFW.LibDir = filepath.Join(a.exeDir, config.Extremer.DefaultMFWPath)
	a.config.MaaFW.ResourceDir = filepath.Join(a.exeDir, config.Extremer.DefaultResourcePath)

	return nil
}

// startup 应用启动时调用
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// 获取可执行文件目录
	exePath, err := os.Executable()
	if err != nil {
		wailsRuntime.LogError(ctx, fmt.Sprintf("获取可执行文件路径失败: %v", err))
		return
	}

	// 检测开发模式
	if isDevMode(exePath) {
		// 开发模式下，使用当前工作目录下的 build/bin
		cwd, err := os.Getwd()
		if err != nil {
			wailsRuntime.LogError(ctx, fmt.Sprintf("获取工作目录失败: %v", err))
			a.exeDir = filepath.Dir(exePath)
		} else {
			a.exeDir = filepath.Join(cwd, "build", "bin")
			wailsRuntime.LogInfo(ctx, fmt.Sprintf("开发模式，使用目录: %s", a.exeDir))
		}
	} else {
		a.exeDir = filepath.Dir(exePath)
	}

	// 加载配置文件
	if err := a.loadConfig(); err != nil {
		wailsRuntime.LogError(ctx, fmt.Sprintf("加载配置文件失败: %v，将使用内置默认配置", err))
	}

	if a.configPath != "" {
		wailsRuntime.LogInfo(ctx, fmt.Sprintf("配置文件已加载: %s", a.configPath))
	} else {
		wailsRuntime.LogWarning(ctx, "使用内置默认配置")
	}

	// 设置工作目录（优先使用配置中的根目录，否则使用默认目录）
	if a.config.Extremer.RootDir != "" {
		// 使用用户配置的根目录
		a.workDir = a.config.Extremer.RootDir
		wailsRuntime.LogInfo(ctx, fmt.Sprintf("使用配置的根目录: %s", a.workDir))
	} else {
		// 使用默认工作目录（用户文档目录下的 MaaPipeline）
		homeDir, err := os.UserHomeDir()
		if err != nil {
			wailsRuntime.LogError(ctx, fmt.Sprintf("获取用户目录失败: %v", err))
			homeDir = a.exeDir
		}

		// 跨平台文档目录
		var documentsDir string
		switch runtime.GOOS {
		case "windows":
			documentsDir = filepath.Join(homeDir, "Documents")
		case "darwin":
			documentsDir = filepath.Join(homeDir, "Documents")
		default:
			documentsDir = homeDir
		}

		a.workDir = filepath.Join(documentsDir, "MaaPipeline")
		wailsRuntime.LogInfo(ctx, fmt.Sprintf("使用默认根目录: %s", a.workDir))
	}
	a.logsDir = filepath.Join(a.exeDir, "logs")
	a.configDir = a.exeDir

	// 确保目录存在
	os.MkdirAll(a.workDir, 0755)
	os.MkdirAll(a.logsDir, 0755)

	// 分配端口（优先使用配置文件中的端口）
	defaultPort := 9066
	if a.config.Server.Port > 0 {
		defaultPort = a.config.Server.Port
	}
	a.port, err = ports.Allocate(defaultPort)
	if err != nil {
		wailsRuntime.LogError(ctx, fmt.Sprintf("端口分配失败: %v", err))
		return
	}
	wailsRuntime.LogInfo(ctx, fmt.Sprintf("分配端口: %d", a.port))

	// 准备 LocalBridge 配置文件路径
	lbConfigPath := filepath.Join(a.workDir, "config.json")

	// 检查配置文件是否存在，以及路径是否有效
	needCreate := false
	if _, err := os.Stat(lbConfigPath); os.IsNotExist(err) {
		needCreate = true
	} else {
		// 配置文件存在，验证路径是否有效
		if a.validateLBConfig(lbConfigPath) {
			wailsRuntime.LogInfo(ctx, "LocalBridge 配置文件路径验证通过")
		} else {
			// 路径无效，重新创建配置文件
			wailsRuntime.LogWarning(ctx, "LocalBridge 配置文件路径无效，将重新创建")
			needCreate = true
		}
	}

	if needCreate {
		if err := a.createLBConfig(lbConfigPath); err != nil {
			wailsRuntime.LogError(ctx, fmt.Sprintf("创建 LocalBridge 配置失败: %v", err))
		} else {
			wailsRuntime.LogInfo(ctx, "已创建 LocalBridge 配置文件")
		}
	}

	// 启动 LocalBridge 子进程
	a.bridge = bridge.NewSubprocessManager(
		a.exeDir,
		a.port,
		a.workDir,
		lbConfigPath,
		a.logsDir,
	)

	if err := a.bridge.Start(); err != nil {
		wailsRuntime.LogError(ctx, fmt.Sprintf("LocalBridge 启动失败: %v", err))
	} else {
		wailsRuntime.LogInfo(ctx, "LocalBridge 启动成功")
	}
}

// validateLBConfig 验证 LocalBridge 配置文件中的路径是否有效
func (a *App) validateLBConfig(path string) bool {
	data, err := os.ReadFile(path)
	if err != nil {
		return false
	}

	var config struct {
		MaaFW struct {
			LibDir      string `json:"lib_dir"`
			ResourceDir string `json:"resource_dir"`
		} `json:"maafw"`
	}

	if err := json.Unmarshal(data, &config); err != nil {
		return false
	}

	// 检查 lib_dir 是否有效
	if config.MaaFW.LibDir != "" {
		if _, err := os.Stat(config.MaaFW.LibDir); os.IsNotExist(err) {
			// 路径不存在，检查默认路径是否可用
			defaultLibDir := filepath.Join(a.exeDir, a.config.Extremer.DefaultMFWPath)
			if _, defaultErr := os.Stat(defaultLibDir); defaultErr == nil {
				// 默认路径可用，说明配置路径无效
				return false
			}
			// 默认路径也不可用，可能是资源未安装，不算配置错误
		}
	}

	// 检查 resource_dir 是否有效
	if config.MaaFW.ResourceDir != "" {
		if _, err := os.Stat(config.MaaFW.ResourceDir); os.IsNotExist(err) {
			// 路径不存在，检查默认路径是否可用
			defaultResourceDir := filepath.Join(a.exeDir, a.config.Extremer.DefaultResourcePath)
			if _, defaultErr := os.Stat(defaultResourceDir); defaultErr == nil {
				// 默认路径可用，说明配置路径无效
				return false
			}
			// 默认路径也不可用，可能是资源未安装，不算配置错误
		}
	}

	return true
}

// createLBConfig 创建 LocalBridge 配置文件
func (a *App) createLBConfig(path string) error {
	// 确定 MaaFramework 路径：优先使用配置中的路径，但如果路径无效则使用默认路径
	libDir := a.config.MaaFW.LibDir
	resourceDir := a.config.MaaFW.ResourceDir

	// 验证路径是否存在，不存在则使用默认路径
	if libDir != "" {
		if _, err := os.Stat(libDir); os.IsNotExist(err) {
			// 配置的路径不存在，使用默认路径
			defaultLibDir := filepath.Join(a.exeDir, a.config.Extremer.DefaultMFWPath)
			if _, defaultErr := os.Stat(defaultLibDir); defaultErr == nil {
				libDir = defaultLibDir
			}
		}
	} else {
		// 未配置，使用默认路径
		libDir = filepath.Join(a.exeDir, a.config.Extremer.DefaultMFWPath)
	}

	if resourceDir != "" {
		if _, err := os.Stat(resourceDir); os.IsNotExist(err) {
			// 配置的路径不存在，使用默认路径
			defaultResourceDir := filepath.Join(a.exeDir, a.config.Extremer.DefaultResourcePath)
			if _, defaultErr := os.Stat(defaultResourceDir); defaultErr == nil {
				resourceDir = defaultResourceDir
			}
		}
	} else {
		// 未配置，使用默认路径
		resourceDir = filepath.Join(a.exeDir, a.config.Extremer.DefaultResourcePath)
	}

	config := map[string]interface{}{
		"server": map[string]interface{}{
			"port": a.config.Server.Port,
			"host": a.config.Server.Host,
		},
		"file": map[string]interface{}{
			"exclude":    a.config.File.Exclude,
			"extensions": a.config.File.Extensions,
		},
		"log": map[string]interface{}{
			"level":          a.config.Log.Level,
			"dir":            a.logsDir,
			"push_to_client": a.config.Log.PushToClient,
		},
		"maafw": map[string]interface{}{
			"enabled":      a.config.MaaFW.Enabled,
			"lib_dir":      libDir,
			"resource_dir": resourceDir,
		},
	}

	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return fmt.Errorf("序列化配置失败: %w", err)
	}

	return os.WriteFile(path, data, 0644)
}

// domReady DOM 加载完成时调用
func (a *App) domReady(ctx context.Context) {
	// 等待 LocalBridge 启动完成后再通知前端连接
	go func() {
		// 检测 LocalBridge 是否就绪
		maxRetries := 30
		for i := 0; i < maxRetries; i++ {
			if a.bridge != nil && a.bridge.IsRunning() {
				// 等待额外 1 秒确保 WebSocket 服务完全启动
				time.Sleep(1000 * time.Millisecond)

				// 关闭启动画面并显示主窗口
				a.showMainWindow(ctx)

				// Bridge 就绪后才发送端口信息，前端收到后会自动连接
				wailsRuntime.EventsEmit(ctx, "bridge:port", a.port)
				wailsRuntime.EventsEmit(ctx, "bridge:ready", true)
				wailsRuntime.LogInfo(ctx, "LocalBridge 就绪，前端可以连接")
				return
			}
			time.Sleep(500 * time.Millisecond)
		}

		// 超时仍未就绪，也要显示主窗口，并发送端口让前端可以手动重试
		a.showMainWindow(ctx)
		wailsRuntime.EventsEmit(ctx, "bridge:port", a.port)
		wailsRuntime.EventsEmit(ctx, "bridge:ready", false)
		wailsRuntime.LogWarning(ctx, "LocalBridge 启动超时")
	}()
}

// showMainWindow 关闭启动画面并显示主窗口
func (a *App) showMainWindow(ctx context.Context) {
	// 关闭启动画面
	if a.splash != nil {
		wailsRuntime.LogInfo(ctx, "正在关闭启动画面...")
		a.splash.Close()
		a.splash = nil
		wailsRuntime.LogInfo(ctx, "启动画面已关闭")
		time.Sleep(100 * time.Millisecond)
	}

	// 显示并最大化主窗口
	wailsRuntime.LogInfo(ctx, "正在显示主窗口...")
	wailsRuntime.WindowShow(ctx)
	// 稍微延迟确保窗口显示后再最大化
	time.Sleep(50 * time.Millisecond)
	wailsRuntime.WindowMaximise(ctx)
	wailsRuntime.LogInfo(ctx, "主窗口已最大化")
}

// shutdown 应用关闭时调用
func (a *App) shutdown(ctx context.Context) {
	if a.bridge != nil {
		if err := a.bridge.Stop(); err != nil {
			wailsRuntime.LogError(ctx, fmt.Sprintf("LocalBridge 停止失败: %v", err))
		} else {
			wailsRuntime.LogInfo(ctx, "LocalBridge 已停止")
		}
	}
}

// GetPort 获取当前使用的端口
func (a *App) GetPort() int {
	return a.port
}

// GetVersion 获取应用版本
func (a *App) GetVersion() string {
	return version
}

// GetWorkDir 获取工作目录
func (a *App) GetWorkDir() string {
	return a.workDir
}

// saveConfig 保存配置到文件
func (a *App) saveConfig() error {
	if a.configPath == "" {
		// 使用默认配置时，创建配置文件
		a.configPath = filepath.Join(a.exeDir, "config", "config.json")
	}

	// 确保配置目录存在
	configDir := filepath.Dir(a.configPath)
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return fmt.Errorf("创建配置目录失败: %w", err)
	}

	data, err := json.MarshalIndent(a.config, "", "  ")
	if err != nil {
		return fmt.Errorf("序列化配置失败: %w", err)
	}

	if err := os.WriteFile(a.configPath, data, 0644); err != nil {
		return fmt.Errorf("写入配置文件失败: %w", err)
	}

	return nil
}

// SetRootDir 设置根目录并持久化保存
func (a *App) SetRootDir(rootDir string) error {
	if rootDir == "" {
		return fmt.Errorf("根目录不能为空")
	}

	// 验证目录是否存在
	if _, err := os.Stat(rootDir); os.IsNotExist(err) {
		return fmt.Errorf("目录不存在: %s", rootDir)
	}

	// 更新配置
	a.config.Extremer.RootDir = rootDir
	a.workDir = rootDir

	// 保存配置到文件
	if err := a.saveConfig(); err != nil {
		return err
	}

	wailsRuntime.LogInfo(a.ctx, fmt.Sprintf("根目录已保存: %s", rootDir))
	return nil
}

// GetLogsDir 获取日志目录
func (a *App) GetLogsDir() string {
	return a.logsDir
}

// OpenWorkDir 打开工作目录
func (a *App) OpenWorkDir() error {
	return openFolder(a.workDir)
}

// OpenLogsDir 打开日志目录
func (a *App) OpenLogsDir() error {
	return openFolder(a.logsDir)
}

// OpenResourcesDir 打开资源目录
func (a *App) OpenResourcesDir() error {
	return openFolder(filepath.Join(a.exeDir, "resources"))
}

// CheckUpdate 检查更新
// [DISABLED] 自动更新功能暂时禁用
func (a *App) CheckUpdate() (*updater.UpdateInfo, error) {
	// return updater.CheckUpdate(version)
	return nil, fmt.Errorf("自动更新功能已禁用")
}

// GetUpdateDownloadURL 获取更新下载链接
// [DISABLED] 自动更新功能暂时禁用
func (a *App) GetUpdateDownloadURL() string {
	// info, err := updater.CheckUpdate(version)
	// if err != nil || info == nil || !info.HasUpdate {
	// 	return ""
	// }
	// return info.DownloadURL
	return ""
}

// RestartBridge 重启 LocalBridge
func (a *App) RestartBridge() error {
	if a.bridge != nil {
		a.bridge.Stop()
	}

	// 准备 LocalBridge 配置文件路径
	lbConfigPath := filepath.Join(a.workDir, "config.json")

	a.bridge = bridge.NewSubprocessManager(
		a.exeDir,
		a.port,
		a.workDir,
		lbConfigPath,
		a.logsDir,
	)

	return a.bridge.Start()
}

// IsBridgeRunning 检查 LocalBridge 是否运行中
func (a *App) IsBridgeRunning() bool {
	if a.bridge == nil {
		return false
	}
	return a.bridge.IsRunning()
}

// openFolder 使用系统文件管理器打开文件夹
func openFolder(path string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("explorer", path)
	case "darwin":
		cmd = exec.Command("open", path)
	default:
		cmd = exec.Command("xdg-open", path)
	}
	return cmd.Start()
}
