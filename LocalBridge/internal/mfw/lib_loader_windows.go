//go:build windows

package mfw

import (
	"fmt"

	"golang.org/x/sys/windows"
)

// loadLibrary 加载动态库（Windows 平台实现）
func loadLibrary(libPath string) (uintptr, error) {
	// 加载库
	handle, err := windows.LoadLibrary(libPath)
	if err != nil {
		return 0, fmt.Errorf("加载库失败: %v", err)
	}

	return uintptr(handle), nil
}
