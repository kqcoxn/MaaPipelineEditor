// Package managed owns service discovery and cross-process installation locks.
package managed

import (
	"fmt"
	"os"
	"path/filepath"
)

type Lock struct{ file *os.File }

func Directory() string {
	dir, _ := os.UserConfigDir()
	return filepath.Join(dir, "MaaPipelineEditor", "management")
}

// Acquire uses a kernel lock, so stale files never imply a live process.
func Acquire(path string, shared bool) (*Lock, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return nil, err
	}
	f, err := os.OpenFile(path, os.O_CREATE|os.O_RDWR, 0600)
	if err != nil {
		return nil, err
	}
	if err = lockFile(f, shared); err != nil {
		f.Close()
		return nil, fmt.Errorf("已有实例或安装操作正在使用资源: %w", err)
	}
	return &Lock{f}, nil
}

func (l *Lock) Close() {
	if l != nil && l.file != nil {
		unlockFile(l.file)
		l.file.Close()
		l.file = nil
	}
}

func InstallationLock(dir string, shared bool) (*Lock, error) {
	return Acquire(filepath.Join(dir, ".mpe-install.lock"), shared)
}
