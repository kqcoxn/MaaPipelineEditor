package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/kqcoxn/MaaPipelineEditor/Extremer/internal/bridge"
	"github.com/kqcoxn/MaaPipelineEditor/Extremer/internal/ports"
	"github.com/kqcoxn/MaaPipelineEditor/Extremer/internal/updater"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// App 应用主结构
type App struct {
	ctx       context.Context
	port      int
	bridge    *bridge.SubprocessManager
	exeDir    string
	workDir   string
	logsDir   string
	configDir string
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

	// 设置工作目录（用户文档目录下的 MaaPipeline）
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
	a.logsDir = filepath.Join(a.exeDir, "logs")
	a.configDir = a.exeDir

	// 确保目录存在
	os.MkdirAll(a.workDir, 0755)
	os.MkdirAll(a.logsDir, 0755)

	// 分配端口
	a.port, err = ports.Allocate(9066)
	if err != nil {
		wailsRuntime.LogError(ctx, fmt.Sprintf("端口分配失败: %v", err))
		return
	}
	wailsRuntime.LogInfo(ctx, fmt.Sprintf("分配端口: %d", a.port))

	// 启动 LocalBridge 子进程
	a.bridge = bridge.NewSubprocessManager(
		a.exeDir,
		a.port,
		a.workDir,
		filepath.Join(a.exeDir, "resources", "maafw"),
		filepath.Join(a.exeDir, "resources", "resource"),
		a.logsDir,
	)

	if err := a.bridge.Start(); err != nil {
		wailsRuntime.LogError(ctx, fmt.Sprintf("LocalBridge 启动失败: %v", err))
	} else {
		wailsRuntime.LogInfo(ctx, "LocalBridge 启动成功")
	}
}

// domReady DOM 加载完成时调用
func (a *App) domReady(ctx context.Context) {
	// 发送端口信息给前端
	wailsRuntime.EventsEmit(ctx, "bridge:port", a.port)
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
func (a *App) CheckUpdate() (*updater.UpdateInfo, error) {
	return updater.CheckUpdate(version)
}

// GetUpdateDownloadURL 获取更新下载链接
func (a *App) GetUpdateDownloadURL() string {
	info, err := updater.CheckUpdate(version)
	if err != nil || info == nil || !info.HasUpdate {
		return ""
	}
	return info.DownloadURL
}

// RestartBridge 重启 LocalBridge
func (a *App) RestartBridge() error {
	if a.bridge != nil {
		a.bridge.Stop()
	}

	a.bridge = bridge.NewSubprocessManager(
		a.exeDir,
		a.port,
		a.workDir,
		filepath.Join(a.exeDir, "resources", "maafw"),
		filepath.Join(a.exeDir, "resources", "resource"),
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
