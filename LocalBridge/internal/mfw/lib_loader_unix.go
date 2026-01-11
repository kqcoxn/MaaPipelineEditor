//go:build !windows

package mfw

import (
	"fmt"

	"github.com/ebitengine/purego"
)

// loadLibrary 加载动态库（Unix 平台实现）
func loadLibrary(libPath string) (uintptr, error) {
	handle, err := purego.Dlopen(libPath, purego.RTLD_NOW|purego.RTLD_GLOBAL)
	if err != nil {
		return 0, fmt.Errorf("加载库失败: %v", err)
	}
	return handle, nil
}
