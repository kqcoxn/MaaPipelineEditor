//go:build windows

package main

import (
	"os"
)

// 获取跨平台的退出信号列表
func getExitSignals() []os.Signal {
	return []os.Signal{os.Interrupt}
}
