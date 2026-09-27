package managed

import (
	"os"

	"golang.org/x/sys/windows"
)

// DetachOwnerInput reserves the inherited pipe for owner monitoring. Native
// Command actions must see EOF on stdin, not wait for the launcher to exit.
// Call once during managed startup, before loading MaaFramework or spawning children.
func DetachOwnerInput() (*os.File, error) {
	owner := os.Stdin
	null, err := os.Open(os.DevNull)
	if err != nil {
		return nil, err
	}
	if err = windows.SetHandleInformation(windows.Handle(null.Fd()), windows.HANDLE_FLAG_INHERIT, windows.HANDLE_FLAG_INHERIT); err == nil {
		err = windows.SetHandleInformation(windows.Handle(owner.Fd()), windows.HANDLE_FLAG_INHERIT, 0)
	}
	if err == nil {
		err = windows.SetStdHandle(windows.STD_INPUT_HANDLE, windows.Handle(null.Fd()))
	}
	if err != nil {
		null.Close()
		return nil, err
	}
	os.Stdin = null // Keep the replacement handle alive for native children.
	return owner, nil
}
