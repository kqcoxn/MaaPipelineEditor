package native

import (
	"fmt"
	"runtime"
	"unsafe"
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
	MaaToolkitGamescopeInstanceListCreate        func() uintptr
	MaaToolkitGamescopeInstanceListDestroy       func(handle uintptr)
	MaaToolkitGamescopeInstanceFindAll           func(buffer uintptr) bool
	MaaToolkitGamescopeInstanceListSize          func(list uintptr) uint64
	MaaToolkitGamescopeInstanceListAt            func(list uintptr, index uint64) uintptr
	MaaToolkitGamescopeInstanceGetDisplayNo      func(instance uintptr) uint32
	MaaToolkitGamescopeInstanceGetPipeWireNodeId func(instance uintptr) uint32
	MaaToolkitGamescopeInstanceGetEisSocketPath  func(instance uintptr) string
)

var (
	MaaToolkitPortalHelperCreate            func() uintptr
	MaaToolkitPortalHelperDestroy           func(helper uintptr)
	MaaToolkitPortalHelperOpenStream        func(helper uintptr) bool
	MaaToolkitPortalHelperGetPersist        func(helper uintptr) bool
	MaaToolkitPortalHelperSetPersist        func(helper uintptr, enable bool)
	MaaToolkitPortalHelperGetPipeWireFD     func(helper uintptr) int32
	MaaToolkitPortalHelperGetPipeWireNodeID func(helper uintptr) uint32
	MaaToolkitPortalHelperGetRestoreToken   func(helper uintptr) string
	MaaToolkitPortalHelperSetRestoreToken   func(helper uintptr, token string)
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
	{&MaaToolkitGamescopeInstanceListCreate, "MaaToolkitGamescopeInstanceListCreate"},
	{&MaaToolkitGamescopeInstanceListDestroy, "MaaToolkitGamescopeInstanceListDestroy"},
	{&MaaToolkitGamescopeInstanceFindAll, "MaaToolkitGamescopeInstanceFindAll"},
	{&MaaToolkitGamescopeInstanceListSize, "MaaToolkitGamescopeInstanceListSize"},
	{&MaaToolkitGamescopeInstanceListAt, "MaaToolkitGamescopeInstanceListAt"},
	{&MaaToolkitGamescopeInstanceGetDisplayNo, "MaaToolkitGamescopeInstanceGetDisplayNo"},
	{&MaaToolkitGamescopeInstanceGetPipeWireNodeId, "MaaToolkitGamescopeInstanceGetPipeWireNodeId"},
	{&MaaToolkitGamescopeInstanceGetEisSocketPath, "MaaToolkitGamescopeInstanceGetEisSocketPath"},
	{&MaaToolkitPortalHelperCreate, "MaaToolkitPortalHelperCreate"},
	{&MaaToolkitPortalHelperDestroy, "MaaToolkitPortalHelperDestroy"},
	{&MaaToolkitPortalHelperOpenStream, "MaaToolkitPortalHelperOpenStream"},
	{&MaaToolkitPortalHelperGetPersist, "MaaToolkitPortalHelperGetPersist"},
	{&MaaToolkitPortalHelperSetPersist, "MaaToolkitPortalHelperSetPersist"},
	{&MaaToolkitPortalHelperGetPipeWireFD, "MaaToolkitPortalHelperGetPipeWireFD"},
	{&MaaToolkitPortalHelperGetPipeWireNodeID, "MaaToolkitPortalHelperGetPipeWireNodeID"},
	{&MaaToolkitPortalHelperGetRestoreToken, "MaaToolkitPortalHelperGetRestoreToken"},
	{&MaaToolkitPortalHelperSetRestoreToken, "MaaToolkitPortalHelperSetRestoreToken"},
	{&MaaToolkitMacOSCheckPermission, "MaaToolkitMacOSCheckPermission"},
	{&MaaToolkitMacOSRequestPermission, "MaaToolkitMacOSRequestPermission"},
	{&MaaToolkitMacOSRevealPermissionSettings, "MaaToolkitMacOSRevealPermissionSettings"},
}

func getMaaToolkitLibrary() string {
	switch runtime.GOOS {
	case "darwin":
		return "libMaaToolkit.dylib"
	case "linux", "android":
		return "libMaaToolkit.so"
	case "windows":
		return "MaaToolkit.dll"
	default:
		panic(fmt.Errorf("GOOS=%s is not supported", runtime.GOOS))
	}
}
