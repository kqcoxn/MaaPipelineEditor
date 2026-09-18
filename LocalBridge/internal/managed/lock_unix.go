//go:build !windows

package managed

import (
	"golang.org/x/sys/unix"
	"os"
)

func lockFile(f *os.File, shared bool) error {
	op := unix.LOCK_EX
	if shared {
		op = unix.LOCK_SH
	}
	return unix.Flock(int(f.Fd()), op|unix.LOCK_NB)
}
func unlockFile(f *os.File) { _ = unix.Flock(int(f.Fd()), unix.LOCK_UN) }
