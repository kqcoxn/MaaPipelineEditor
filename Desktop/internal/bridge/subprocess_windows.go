//go:build windows

package bridge

import (
	"os/exec"
	"syscall"
)

// setPlatformSysProcAttr 设置 Windows 平台特定的进程属性
func setPlatformSysProcAttr(cmd *exec.Cmd) {
	// 隐藏控制台窗口
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: 0x08000000, // CREATE_NO_WINDOW
	}
}

// stopProcess 停止进程（Windows 版本）
func stopProcess(cmd *exec.Cmd) error {
	if cmd.Process == nil {
		return nil
	}
	return cmd.Process.Kill()
}
