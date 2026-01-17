package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/kqcoxn/MaaPipelineExtremer/internal/config"
	"github.com/kqcoxn/MaaPipelineExtremer/internal/logger"
	"github.com/kqcoxn/MaaPipelineExtremer/internal/process"
	"github.com/kqcoxn/MaaPipelineExtremer/internal/updater"
)

// App 应用程序结构体
type App struct {
	ctx     context.Context
	cfg     *config.Config
	log     *logger.Logger
	procMgr *process.Manager
	updater *updater.Updater
}

// NewApp 创建新的应用实例
func NewApp(cfg *config.Config, log *logger.Logger) *App {
	return &App{
		cfg: cfg,
		log: log,
	}
}

// startup 应用启动时调用
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.log.Info("Extremer 应用启动中...")

	// 检查组件完整性
	if err := a.checkComponents(); err != nil {
		a.log.Warnf("组件完整性检查失败: %v", err)
	} else {
		a.log.Info("组件完整性检查通过")
	}

	// 创建进程管理器
	a.procMgr = process.NewManager(a.cfg, a.log)

	// 创建更新管理器
	a.updater = updater.NewUpdater(a.cfg, a.log)

	// 启动 LocalBridge
	if err := a.startLocalBridge(); err != nil {
		a.log.Errorf("启动 LocalBridge 失败: %v", err)
	}

	a.log.Info("Extremer 启动完成")
}

// shutdown 应用关闭时调用
func (a *App) shutdown(ctx context.Context) {
	a.log.Info("Extremer 正在关闭...")

	// 停止 LocalBridge
	if a.procMgr != nil {
		if err := a.procMgr.StopLocalBridge(); err != nil {
			a.log.Warnf("停止 LocalBridge 失败: %v", err)
		}
	}

	a.log.Info("Extremer 已关闭")
}

// checkComponents 检查组件完整性
func (a *App) checkComponents() error {
	// 获取基础路径
	basePath, err := config.GetBasePath()
	if err != nil {
		return fmt.Errorf("获取基础路径失败: %v", err)
	}

	// 检查 LocalBridge
	lbPath := config.ResolvePath(basePath, a.cfg.LocalBridge.ExePath)
	if !fileExists(lbPath) {
		return fmt.Errorf("LocalBridge 可执行文件不存在: %s", lbPath)
	}

	// 检查 MaaFramework
	mfwPath := config.ResolvePath(basePath, a.cfg.Mfw.BasePath)
	if !dirExists(mfwPath) {
		a.log.Warnf("MaaFramework 目录不存在: %s", mfwPath)
	}

	// 检查 OCR
	ocrPath := config.ResolvePath(basePath, a.cfg.Ocr.BasePath)
	if !dirExists(ocrPath) {
		a.log.Warnf("OCR 目录不存在: %s", ocrPath)
	}

	return nil
}

// startLocalBridge 启动 LocalBridge 子进程
func (a *App) startLocalBridge() error {
	a.log.Infof("启动 LocalBridge: %s", a.cfg.LocalBridge.ExePath)

	if err := a.procMgr.StartLocalBridge(); err != nil {
		return err
	}

	// 等待健康检查
	a.log.Debug("等待 LocalBridge 就绪...")
	timeout := time.Duration(a.cfg.LocalBridge.HealthCheckTimeout) * time.Millisecond
	if err := a.procMgr.WaitForHealthy(timeout); err != nil {
		return fmt.Errorf("LocalBridge 健康检查失败: %v", err)
	}

	a.log.Infof("LocalBridge 就绪，端口 %d", a.cfg.LocalBridge.Port)
	return nil
}

// GetVersion 获取版本信息
func (a *App) GetVersion() map[string]string {
	return map[string]string{
		"extremer":    a.cfg.Version,
		"frontend":    a.cfg.Components.Frontend,
		"localbridge": a.cfg.Components.LocalBridge,
		"mfw":         a.cfg.Components.Mfw,
		"ocr":         a.cfg.Components.Ocr,
	}
}

// GetStatus 获取运行状态
func (a *App) GetStatus() map[string]interface{} {
	status := map[string]interface{}{
		"localbridge_running": false,
		"localbridge_port":    a.cfg.LocalBridge.Port,
	}

	if a.procMgr != nil {
		status["localbridge_running"] = a.procMgr.IsRunning()
	}

	return status
}

// RestartLocalBridge 重启 LocalBridge
func (a *App) RestartLocalBridge() error {
	a.log.Info("重启 LocalBridge...")
	if a.procMgr != nil {
		if err := a.procMgr.StopLocalBridge(); err != nil {
			a.log.Warnf("停止 LocalBridge 失败: %v", err)
		}
	}
	return a.startLocalBridge()
}

// CheckUpdate 检查更新
func (a *App) CheckUpdate() (map[string]interface{}, error) {
	if a.updater == nil {
		return map[string]interface{}{
			"hasUpdate": false,
			"message":   "更新模块未初始化",
		}, nil
	}

	updates, err := a.updater.CheckForUpdates()
	if err != nil {
		return nil, err
	}

	if len(updates) == 0 {
		return map[string]interface{}{
			"hasUpdate": false,
			"message":   "当前已是最新版本",
		}, nil
	}

	return map[string]interface{}{
		"hasUpdate": true,
		"updates":   updates,
		"message":   fmt.Sprintf("发现 %d 个可用更新", len(updates)),
	}, nil
}

// fileExists 检查文件是否存在
func fileExists(path string) bool {
	info, err := os.Stat(path)
	if os.IsNotExist(err) {
		return false
	}
	return err == nil && !info.IsDir()
}

// dirExists 检查目录是否存在
func dirExists(path string) bool {
	info, err := os.Stat(path)
	if os.IsNotExist(err) {
		return false
	}
	return err == nil && info.IsDir()
}
