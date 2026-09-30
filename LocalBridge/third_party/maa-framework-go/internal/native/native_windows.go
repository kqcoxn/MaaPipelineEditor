//go:build windows

package native

import (
	"fmt"
	"syscall"
	"unsafe"
)

func handleLibDir(libDir string) error {
	kernel32 := syscall.NewLazyDLL("kernel32.dll")
	setDllDirProc := kernel32.NewProc("SetDllDirectoryW")
	dirPtr, err := syscall.UTF16PtrFromString(libDir)
	if err != nil {
		return fmt.Errorf("failed to convert library directory path to UTF-16: %w", err)
	}

	ret, _, err := setDllDirProc.Call(uintptr(unsafe.Pointer(dirPtr)))
	if ret == 0 {
		if err != nil {
			return fmt.Errorf("SetDllDirectoryW failed for directory %q: %w", libDir, err)
		}
		return fmt.Errorf("SetDllDirectoryW failed for directory %q: unknown error", libDir)
	}

	return nil
}

// platformOpenLibrary opens a dynamic library using the platform loader.
func platformOpenLibrary(name string) (uintptr, error) {
	handle, err := syscall.LoadLibrary(name)
	return uintptr(handle), err
}

// platformUnloadLibrary releases an open dynamic library handle.
func platformUnloadLibrary(handle uintptr) error {
	dllHandle := (syscall.Handle)(handle)
	return syscall.FreeLibrary(dllHandle)
}

// platformLookupSymbol resolves a symbol from an open dynamic library handle.
func platformLookupSymbol(handle uintptr, name string) (uintptr, error) {
	return syscall.GetProcAddress((syscall.Handle)(handle), name)
}
