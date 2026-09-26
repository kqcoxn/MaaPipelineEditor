//go:build !windows

package updatehttp

func readSystemProxy() systemProxy { return systemProxy{} }
