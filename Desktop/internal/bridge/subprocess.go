package bridge

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sync"
)

// SubprocessManager LocalBridge 子进程管理器
type SubprocessManager struct {
	cmd        *exec.Cmd
	exeDir     string
	port       int
	rootDir    string
	configPath string
	logsDir    string
	mu         sync.Mutex
	running    bool
}

// NewSubprocessManager 创建子进程管理器
func NewSubprocessManager(exeDir string, port int, rootDir, configPath, logsDir string) *SubprocessManager {
	return &SubprocessManager{
		exeDir:     exeDir,
		port:       port,
		rootDir:    rootDir,
		configPath: configPath,
		logsDir:    logsDir,
	}
}

// Start 启动 LocalBridge 子进程
func (m *SubprocessManager) Start() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.running {
		return fmt.Errorf("LocalBridge 已在运行中")
	}

	// 确定可执行文件路径
	var exeName string
	if runtime.GOOS == "windows" {
		exeName = "mpelb.exe"
	} else {
		exeName = "mpelb"
	}
	exePath := filepath.Join(m.exeDir, "resources", exeName)

	// 检查可执行文件是否存在
	if _, err := os.Stat(exePath); os.IsNotExist(err) {
		return fmt.Errorf("LocalBridge 可执行文件不存在: %s", exePath)
	}

	// 构建命令行参数
	args := []string{
		"--port", fmt.Sprintf("%d", m.port),
		"--root", m.rootDir,
		"--log-dir", m.logsDir,
	}

	// 如果配置文件存在，则添加 --config 参数
	if m.configPath != "" {
		if _, err := os.Stat(m.configPath); err == nil {
			args = append(args, "--config", m.configPath)
		}
	}

	m.cmd = exec.Command(exePath, args...)
	m.cmd.Dir = m.exeDir

	// 设置平台特定的进程属性
	setPlatformSysProcAttr(m.cmd)

	// 重定向输出到日志文件
	logFile, err := os.OpenFile(
		filepath.Join(m.logsDir, "mpelb.log"),
		os.O_CREATE|os.O_WRONLY|os.O_APPEND,
		0644,
	)
	if err == nil {
		m.cmd.Stdout = logFile
		m.cmd.Stderr = logFile
	}

	// 启动进程
	if err := m.cmd.Start(); err != nil {
		return fmt.Errorf("启动 LocalBridge 失败: %v", err)
	}

	m.running = true

	// 后台监控进程状态
	go func() {
		m.cmd.Wait()
		m.mu.Lock()
		m.running = false
		m.mu.Unlock()
	}()

	return nil
}

// Stop 停止 LocalBridge 子进程
func (m *SubprocessManager) Stop() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if !m.running || m.cmd == nil || m.cmd.Process == nil {
		return nil
	}

	err := stopProcess(m.cmd)
	m.running = false
	return err
}

// IsRunning 检查进程是否运行中
func (m *SubprocessManager) IsRunning() bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.running
}

// GetPort 获取端口
func (m *SubprocessManager) GetPort() int {
	return m.port
}
