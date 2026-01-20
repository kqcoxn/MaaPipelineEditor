//go:build windows

package bridge

import "os/exec"

// setPlatformSysProcAttr 设置 Windows 平台特定的进程属性
func setPlatformSysProcAttr(cmd *exec.Cmd) {
	// Windows 不需要特殊设置
}

// stopProcess 停止进程（Windows 版本）
func stopProcess(cmd *exec.Cmd) error {
	if cmd.Process == nil {
		return nil
	}
	return cmd.Process.Kill()
}
