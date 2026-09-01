package mfw

import (
	"fmt"
	"strconv"
	"strings"
	"unsafe"
)

func parseWindowHandle(value string) (unsafe.Pointer, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, nil
	}

	hexValue := strings.TrimPrefix(strings.TrimPrefix(value, "0x"), "0X")
	handle, err := strconv.ParseUint(hexValue, 16, strconv.IntSize)
	if err != nil {
		return nil, fmt.Errorf("无效的窗口句柄 %q: %w", value, err)
	}
	return nativeWindowHandle(uintptr(handle)), nil
}

// nativeWindowHandle reinterprets an opaque OS handle for the MaaFramework
// binding. The value is owned by Windows and is never dereferenced by Go.
//
//go:nocheckptr
func nativeWindowHandle(handle uintptr) unsafe.Pointer {
	return *(*unsafe.Pointer)(unsafe.Pointer(&handle))
}
