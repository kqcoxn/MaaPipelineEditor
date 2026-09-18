package install

import (
	"runtime"
	"strings"
	"unsafe"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
)

// RegisterPath makes a fresh App installation available to subsequent terminals.
func RegisterPath(dir string) error {
	if !strings.EqualFold(dir, DefaultDirectory()) {
		return nil
	}
	key, _, err := registry.CreateKey(registry.CURRENT_USER, `Environment`, registry.QUERY_VALUE|registry.SET_VALUE)
	if err != nil {
		return err
	}
	defer key.Close()
	value, _, err := key.GetStringValue("Path")
	if err != nil && err != registry.ErrNotExist {
		return err
	}
	for _, entry := range strings.Split(value, ";") {
		if strings.EqualFold(strings.TrimRight(entry, `\/`), strings.TrimRight(dir, `\/`)) {
			return nil
		}
	}
	if err := key.SetExpandStringValue("Path", strings.TrimRight(value, ";")+";"+dir); err != nil {
		return err
	}
	// Notify Explorer so newly opened terminals inherit the changed user PATH.
	message := windows.NewLazySystemDLL("user32.dll").NewProc("SendMessageTimeoutW")
	section, _ := windows.UTF16PtrFromString("Environment")
	var result uintptr
	_, _, _ = message.Call(0xffff, 0x001a, 0, uintptr(unsafe.Pointer(section)), 2, 2000, uintptr(unsafe.Pointer(&result)))
	runtime.KeepAlive(section)
	return nil
}
