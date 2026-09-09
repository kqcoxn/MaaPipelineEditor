package native

import (
	"fmt"
	"path/filepath"
	"runtime"
	"unsafe"

	"github.com/ebitengine/purego"
)

var maaToolkit uintptr

const maaToolkitName = "MaaToolkit"

var MaaToolkitConfigInitOption func(userPath, defaultJson string) bool

// MaaMacOSPermission defines the macOS permission type.
type MaaMacOSPermission int32

const (
	MaaMacOSPermissionScreenCapture MaaMacOSPermission = 1
	MaaMacOSPermissionAccessibility MaaMacOSPermission = 2
)

var (
	MaaToolkitAdbDeviceListCreate          func() uintptr
	MaaToolkitAdbDeviceListDestroy         func(handle uintptr)
	MaaToolkitAdbDeviceFind                func(buffer uintptr) bool
	MaaToolkitAdbDeviceFindSpecified       func(adbPath string, buffer uintptr) bool
	MaaToolkitAdbDeviceListSize            func(list uintptr) uint64
	MaaToolkitAdbDeviceListAt              func(list uintptr, index uint64) uintptr
	MaaToolkitAdbDeviceGetName             func(device uintptr) string
	MaaToolkitAdbDeviceGetAdbPath          func(device uintptr) string
	MaaToolkitAdbDeviceGetAddress          func(device uintptr) string
	MaaToolkitAdbDeviceGetScreencapMethods func(device uintptr) uint64
	MaaToolkitAdbDeviceGetInputMethods     func(device uintptr) uint64
	MaaToolkitAdbDeviceGetConfig           func(device uintptr) string
)

var (
	MaaToolkitDesktopWindowListCreate    func() uintptr
	MaaToolkitDesktopWindowListDestroy   func(handle uintptr)
	MaaToolkitDesktopWindowFindAll       func(buffer uintptr) bool
	MaaToolkitDesktopWindowListSize      func(list uintptr) uint64
	MaaToolkitDesktopWindowListAt        func(list uintptr, index uint64) uintptr
	MaaToolkitDesktopWindowGetHandle     func(window uintptr) unsafe.Pointer
	MaaToolkitDesktopWindowGetClassName  func(window uintptr) string
	MaaToolkitDesktopWindowGetWindowName func(window uintptr) string
)

var (
	MaaToolkitMacOSCheckPermission          func(perm MaaMacOSPermission) bool
	MaaToolkitMacOSRequestPermission        func(perm MaaMacOSPermission) bool
	MaaToolkitMacOSRevealPermissionSettings func(perm MaaMacOSPermission) bool
)

var toolkitEntries = []Entry{
	{&MaaToolkitConfigInitOption, "MaaToolkitConfigInitOption"},
	{&MaaToolkitAdbDeviceListCreate, "MaaToolkitAdbDeviceListCreate"},
	{&MaaToolkitAdbDeviceListDestroy, "MaaToolkitAdbDeviceListDestroy"},
	{&MaaToolkitAdbDeviceFind, "MaaToolkitAdbDeviceFind"},
	{&MaaToolkitAdbDeviceFindSpecified, "MaaToolkitAdbDeviceFindSpecified"},
	{&MaaToolkitAdbDeviceListSize, "MaaToolkitAdbDeviceListSize"},
	{&MaaToolkitAdbDeviceListAt, "MaaToolkitAdbDeviceListAt"},
	{&MaaToolkitAdbDeviceGetName, "MaaToolkitAdbDeviceGetName"},
	{&MaaToolkitAdbDeviceGetAdbPath, "MaaToolkitAdbDeviceGetAdbPath"},
	{&MaaToolkitAdbDeviceGetAddress, "MaaToolkitAdbDeviceGetAddress"},
	{&MaaToolkitAdbDeviceGetScreencapMethods, "MaaToolkitAdbDeviceGetScreencapMethods"},
	{&MaaToolkitAdbDeviceGetInputMethods, "MaaToolkitAdbDeviceGetInputMethods"},
	{&MaaToolkitAdbDeviceGetConfig, "MaaToolkitAdbDeviceGetConfig"},
	{&MaaToolkitDesktopWindowListCreate, "MaaToolkitDesktopWindowListCreate"},
	{&MaaToolkitDesktopWindowListDestroy, "MaaToolkitDesktopWindowListDestroy"},
	{&MaaToolkitDesktopWindowFindAll, "MaaToolkitDesktopWindowFindAll"},
	{&MaaToolkitDesktopWindowListSize, "MaaToolkitDesktopWindowListSize"},
	{&MaaToolkitDesktopWindowListAt, "MaaToolkitDesktopWindowListAt"},
	{&MaaToolkitDesktopWindowGetHandle, "MaaToolkitDesktopWindowGetHandle"},
	{&MaaToolkitDesktopWindowGetClassName, "MaaToolkitDesktopWindowGetClassName"},
	{&MaaToolkitDesktopWindowGetWindowName, "MaaToolkitDesktopWindowGetWindowName"},
	{&MaaToolkitMacOSCheckPermission, "MaaToolkitMacOSCheckPermission"},
	{&MaaToolkitMacOSRequestPermission, "MaaToolkitMacOSRequestPermission"},
	{&MaaToolkitMacOSRevealPermissionSettings, "MaaToolkitMacOSRevealPermissionSettings"},
}

func initToolkit(libDir string) error {
	libName := getMaaToolkitLibrary()
	libPath := filepath.Join(libDir, libName)

	handle, err := openLibrary(libPath)
	if err != nil {
		return &LibraryLoadError{
			LibraryName: maaToolkitName,
			LibraryPath: libPath,
			Err:         err,
		}
	}

	maaToolkit = handle

	registerToolkit()

	return nil
}

func getMaaToolkitLibrary() string {
	switch runtime.GOOS {
	case "darwin":
		return "libMaaToolkit.dylib"
	case "linux":
		return "libMaaToolkit.so"
	case "windows":
		return "MaaToolkit.dll"
	default:
		panic(fmt.Errorf("GOOS=%s is not supported", runtime.GOOS))
	}
}

func registerToolkit() {
	for _, entry := range toolkitEntries {
		purego.RegisterLibFunc(entry.ptrToFunc, maaToolkit, entry.name)
	}
}

func releaseToolkit() error {
	err := unloadLibrary(maaToolkit)
	if err != nil {
		return err
	}

	unregisterToolkit()

	return nil
}

func unregisterToolkit() {
	for _, entry := range toolkitEntries {
		clearFuncVar(entry.ptrToFunc)
	}
}
