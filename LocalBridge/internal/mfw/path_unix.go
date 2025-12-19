//go:build !windows

package mfw

import "unicode"

// ContainsNonASCII 检查字符串是否包含非 ASCII 字符
func ContainsNonASCII(s string) bool {
	for _, r := range s {
		if r > unicode.MaxASCII {
			return true
		}
	}
	return false
}

// GetShortPathName Unix/Linux 下直接返回原路径
func GetShortPathName(longPath string) (string, error) {
	// Unix/Linux 系统不需要短路径转换
	return longPath, nil
}
