//go:build !windows

package bridge

import (
	"os/exec"
	"syscall"
)

// setPlatformSysProcAttr 设置 Unix 平台特定的进程属性
func setPlatformSysProcAttr(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{
		Setpgid: true,
	}
}

// stopProcess 停止进程（Unix 版本）
func stopProcess(cmd *exec.Cmd) error {
	if cmd.Process == nil {
		return nil
	}
	// 先尝试 SIGTERM
	err := cmd.Process.Signal(syscall.SIGTERM)
	if err != nil {
		// 如果失败，强制终止
		return cmd.Process.Kill()
	}
	return nil
}
