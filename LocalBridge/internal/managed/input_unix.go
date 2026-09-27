//go:build !windows

package managed

import (
	"os"

	"golang.org/x/sys/unix"
)

// DetachOwnerInput preserves the owner pipe on a close-on-exec descriptor and
// redirects fd 0 itself so both Go and native children receive EOF on stdin.
func DetachOwnerInput() (*os.File, error) {
	fd, err := unix.FcntlInt(os.Stdin.Fd(), unix.F_DUPFD_CLOEXEC, 0)
	if err != nil {
		return nil, err
	}
	owner := os.NewFile(uintptr(fd), "desktop-owner")
	null, err := os.Open(os.DevNull)
	if err == nil {
		defer null.Close()
		err = unix.Dup2(int(null.Fd()), int(os.Stdin.Fd()))
	}
	if err != nil {
		owner.Close()
		return nil, err
	}
	return owner, nil
}
