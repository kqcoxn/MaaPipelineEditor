//go:build !windows

package managed

func WaitProcessExit(pid int) error { return nil }
