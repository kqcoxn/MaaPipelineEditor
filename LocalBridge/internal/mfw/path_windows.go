//go:build windows

package mfw

import (
	"fmt"
	"syscall"
	"unicode"
	"unsafe"
)

// ContainsNonASCII 检查字符串是否包含非 ASCII 字符
func ContainsNonASCII(s string) bool {
	for _, r := range s {
		if r > unicode.MaxASCII {
			return true
		}
	}
	return false
}

// GetShortPathName 获取 Windows 短路径名（8.3格式）
func GetShortPathName(longPath string) (string, error) {
	// 加载 kernel32.dll
	kernel32 := syscall.NewLazyDLL("kernel32.dll")
	getShortPathNameW := kernel32.NewProc("GetShortPathNameW")

	// 将路径转换为 UTF-16
	longPathPtr, err := syscall.UTF16PtrFromString(longPath)
	if err != nil {
		return longPath, err
	}

	// 首先获取需要的缓冲区大小
	n, _, _ := getShortPathNameW.Call(
		uintptr(unsafe.Pointer(longPathPtr)),
		0,
		0,
	)
	if n == 0 {
		return longPath, fmt.Errorf("GetShortPathNameW failed")
	}

	// 分配缓冲区并获取短路径
	buf := make([]uint16, n)
	n, _, _ = getShortPathNameW.Call(
		uintptr(unsafe.Pointer(longPathPtr)),
		uintptr(unsafe.Pointer(&buf[0])),
		uintptr(n),
	)
	if n == 0 {
		return longPath, fmt.Errorf("GetShortPathNameW failed")
	}

	return syscall.UTF16ToString(buf), nil
}
