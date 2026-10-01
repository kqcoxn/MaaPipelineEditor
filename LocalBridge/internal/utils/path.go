package utils

import (
	"runtime"
	"strings"
)

// NormalizeWindowsPath unifies ordinary and extended Windows filesystem paths.
// Go's filesystem APIs add the long-path prefix when needed; keeping it in
// application paths makes filepath.Rel treat equivalent volumes as different.
func NormalizeWindowsPath(path string) string {
	if runtime.GOOS != "windows" {
		return path
	}
	if strings.HasPrefix(strings.ToUpper(path), `\\?\UNC\`) {
		return `\\` + path[8:]
	}
	if strings.HasPrefix(path, `\\?\`) && len(path) >= 7 && path[5] == ':' && path[6] == '\\' {
		return path[4:]
	}
	return path
}
