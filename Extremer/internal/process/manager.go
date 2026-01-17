package process

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"syscall"
	"time"

	"github.com/kqcoxn/MaaPipelineExtremer/internal/config"
	"github.com/kqcoxn/MaaPipelineExtremer/internal/logger"
)

// Manager 进程管理器
type Manager struct {
	cfg          *config.Config
	log          *logger.Logger
	lbProcess    *exec.Cmd
	lbRunning    bool
	restartCount int
	maxRestarts  int
	mu           sync.Mutex
	ctx          context.Context
	cancel       context.CancelFunc
}

// NewManager 创建新的进程管理器
func NewManager(cfg *config.Config, log *logger.Logger) *Manager {
	ctx, cancel := context.WithCancel(context.Background())
	return &Manager{
		cfg:         cfg,
		log:         log,
		maxRestarts: 3,
		ctx:         ctx,
		cancel:      cancel,
	}
}

// StartLocalBridge 启动 LocalBridge 进程
func (m *Manager) StartLocalBridge() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.lbRunning {
		return fmt.Errorf("LocalBridge 已在运行中")
	}

	// 获取基础路径
	basePath, err := config.GetBasePath()
	if err != nil {
		return fmt.Errorf("获取基础路径失败: %v", err)
	}

	// 解析可执行文件路径
	exePath := config.ResolvePath(basePath, m.cfg.LocalBridge.ExePath)
	configPath := config.ResolvePath(basePath, m.cfg.LocalBridge.ConfigPath)
	mfwPath := config.ResolvePath(basePath, m.cfg.Mfw.BasePath)
	ocrPath := config.ResolvePath(basePath, m.cfg.Ocr.BasePath)

	// 检查可执行文件是否存在
	if _, err := os.Stat(exePath); os.IsNotExist(err) {
		return fmt.Errorf("LocalBridge 可执行文件不存在: %s", exePath)
	}

	// 构建命令参数
	args := []string{
		"--config", configPath,
		"--port", fmt.Sprintf("%d", m.cfg.LocalBridge.Port),
	}

	// 创建命令
	m.lbProcess = exec.CommandContext(m.ctx, exePath, args...)
	m.lbProcess.Dir = basePath

	// Windows下隐藏窗口
	m.lbProcess.SysProcAttr = &syscall.SysProcAttr{
		HideWindow: true,
	}

	// 设置环境变量
	m.lbProcess.Env = append(os.Environ(),
		fmt.Sprintf("MFW_BASE_PATH=%s", mfwPath),
		fmt.Sprintf("OCR_BASE_PATH=%s", ocrPath),
		fmt.Sprintf("LB_CONFIG_PATH=%s", configPath),
	)

	// 设置日志输出
	logPath := config.ResolvePath(basePath, m.cfg.Logs.LocalBridgeLogPath)
	logDir := filepath.Dir(logPath)
	if err := os.MkdirAll(logDir, 0755); err != nil {
		m.log.Warnf("创建日志目录失败: %v", err)
	}

	logFile, err := os.OpenFile(logPath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		m.log.Warnf("打开 LocalBridge 日志文件失败: %v", err)
	} else {
		m.lbProcess.Stdout = logFile
		m.lbProcess.Stderr = logFile
	}

	// 启动进程
	if err := m.lbProcess.Start(); err != nil {
		return fmt.Errorf("启动 LocalBridge 失败: %v", err)
	}

	m.lbRunning = true
	m.log.Infof("LocalBridge 进程已启动，PID: %d", m.lbProcess.Process.Pid)

	// 启动进程监控
	go m.monitorProcess()

	return nil
}

// StopLocalBridge 停止 LocalBridge 进程
func (m *Manager) StopLocalBridge() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if !m.lbRunning || m.lbProcess == nil {
		return nil
	}

	m.log.Info("正在停止 LocalBridge...")

	// 先尝试优雅关闭（发送 /quit 请求）
	quitURL := fmt.Sprintf("http://127.0.0.1:%d/quit", m.cfg.LocalBridge.Port)
	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Post(quitURL, "application/json", nil)
	if err == nil {
		resp.Body.Close()
		// 等待进程退出
		done := make(chan error, 1)
		go func() {
			done <- m.lbProcess.Wait()
		}()

		select {
		case <-done:
			m.log.Info("LocalBridge 已优雅退出")
		case <-time.After(3 * time.Second):
			m.log.Warn("LocalBridge 未响应，强制终止")
			m.lbProcess.Process.Kill()
		}
	} else {
		// 优雅关闭失败，直接杀进程
		m.log.Warn("无法发送退出请求，强制终止 LocalBridge")
		if err := m.lbProcess.Process.Kill(); err != nil {
			return fmt.Errorf("终止 LocalBridge 失败: %v", err)
		}
	}

	m.lbRunning = false
	m.lbProcess = nil
	return nil
}

// WaitForHealthy 等待 LocalBridge 健康检查通过
func (m *Manager) WaitForHealthy(timeout time.Duration) error {
	healthURL := fmt.Sprintf("http://127.0.0.1:%d/health", m.cfg.LocalBridge.Port)
	client := &http.Client{Timeout: 1 * time.Second}

	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		resp, err := client.Get(healthURL)
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				return nil
			}
		}
		time.Sleep(500 * time.Millisecond)
	}

	return fmt.Errorf("健康检查超时 (%v)", timeout)
}

// IsRunning 检查 LocalBridge 是否在运行
func (m *Manager) IsRunning() bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.lbRunning
}

// monitorProcess 监控进程状态
func (m *Manager) monitorProcess() {
	if m.lbProcess == nil {
		return
	}

	err := m.lbProcess.Wait()

	m.mu.Lock()
	defer m.mu.Unlock()

	if !m.lbRunning {
		// 正常关闭
		return
	}

	m.lbRunning = false
	m.log.Warnf("LocalBridge 进程异常退出: %v", err)

	// 自动重启
	if m.cfg.LocalBridge.AutoRestart && m.restartCount < m.maxRestarts {
		m.restartCount++
		m.log.Infof("尝试重启 LocalBridge (第 %d/%d 次)", m.restartCount, m.maxRestarts)

		m.mu.Unlock()
		if err := m.StartLocalBridge(); err != nil {
			m.log.Errorf("重启 LocalBridge 失败: %v", err)
		}
		m.mu.Lock()
	} else if m.restartCount >= m.maxRestarts {
		m.log.Error("LocalBridge 重启次数已达上限，停止重试")
	}
}

// CleanupZombieProcesses 清理僵尸进程
func (m *Manager) CleanupZombieProcesses() error {
	m.log.Debug("检查并清理遗留的 LocalBridge 进程...")
	// TODO: 实现僵尸进程清理逻辑
	// 可以通过 gopsutil 库扫描名为 localbridge.exe 的进程并清理
	return nil
}

// Shutdown 关闭管理器
func (m *Manager) Shutdown() {
	m.cancel()
	m.StopLocalBridge()
}
