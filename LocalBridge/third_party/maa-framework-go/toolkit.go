package maa

import (
	"errors"
	"unsafe"

	"github.com/MaaXYZ/maa-framework-go/v4/controller/adb"
	"github.com/MaaXYZ/maa-framework-go/v4/internal/native"
)

// AdbDevice represents a single ADB device with various properties about its information.
type AdbDevice struct {
	Name            string
	AdbPath         string
	Address         string
	ScreencapMethod adb.ScreencapMethod
	InputMethod     adb.InputMethod
	Config          string
}

// DesktopWindow represents a single desktop window with various properties about its information.
type DesktopWindow struct {
	Handle     unsafe.Pointer
	ClassName  string
	WindowName string
}

// ConfigInitOption inits the toolkit config option.
func ConfigInitOption(userPath, defaultJson string) error {
	if !native.MaaToolkitConfigInitOption(userPath, defaultJson) {
		return errors.New("failed to init toolkit config option")
	}
	return nil
}

// FindAdbDevices finds adb devices.
func FindAdbDevices(specifiedAdb ...string) ([]*AdbDevice, error) {
	listHandle := native.MaaToolkitAdbDeviceListCreate()
	defer native.MaaToolkitAdbDeviceListDestroy(listHandle)
	var got bool
	if len(specifiedAdb) > 0 {
		got = native.MaaToolkitAdbDeviceFindSpecified(specifiedAdb[0], listHandle)
	} else {
		got = native.MaaToolkitAdbDeviceFind(listHandle)
	}
	if !got {
		return nil, errors.New("failed to find adb devices")
	}

	size := native.MaaToolkitAdbDeviceListSize(listHandle)
	list := make([]*AdbDevice, size)
	for i := uint64(0); i < size; i++ {
		deviceHandle := native.MaaToolkitAdbDeviceListAt(listHandle, i)
		name := native.MaaToolkitAdbDeviceGetName(deviceHandle)
		adbPath := native.MaaToolkitAdbDeviceGetAdbPath(deviceHandle)
		address := native.MaaToolkitAdbDeviceGetAddress(deviceHandle)
		screencapMethod := adb.ScreencapMethod(native.MaaToolkitAdbDeviceGetScreencapMethods(deviceHandle))
		inputMethod := adb.InputMethod(native.MaaToolkitAdbDeviceGetInputMethods(deviceHandle))
		config := native.MaaToolkitAdbDeviceGetConfig(deviceHandle)
		list[i] = &AdbDevice{
			Name:            name,
			AdbPath:         adbPath,
			Address:         address,
			ScreencapMethod: screencapMethod,
			InputMethod:     inputMethod,
			Config:          config,
		}
	}
	return list, nil
}

// FindDesktopWindows finds desktop windows.
func FindDesktopWindows() ([]*DesktopWindow, error) {
	listHandle := native.MaaToolkitDesktopWindowListCreate()
	defer native.MaaToolkitDesktopWindowListDestroy(listHandle)
	got := native.MaaToolkitDesktopWindowFindAll(listHandle)
	if !got {
		return nil, errors.New("failed to find desktop windows")
	}

	size := native.MaaToolkitDesktopWindowListSize(listHandle)
	list := make([]*DesktopWindow, size)
	for i := uint64(0); i < size; i++ {
		windowHandle := native.MaaToolkitDesktopWindowListAt(listHandle, i)
		handle := native.MaaToolkitDesktopWindowGetHandle(windowHandle)
		className := native.MaaToolkitDesktopWindowGetClassName(windowHandle)
		windowName := native.MaaToolkitDesktopWindowGetWindowName(windowHandle)
		list[i] = &DesktopWindow{
			Handle:     handle,
			ClassName:  className,
			WindowName: windowName,
		}
	}
	return list, nil
}

// MacOSPermission defines a macOS permission type.
type MacOSPermission = native.MaaMacOSPermission

// MacOS permission constants.
const (
	MacOSPermissionScreenCapture MacOSPermission = native.MaaMacOSPermissionScreenCapture
	MacOSPermissionAccessibility MacOSPermission = native.MaaMacOSPermissionAccessibility
)

// MacOSCheckPermission checks whether the given macOS permission has been granted.
func MacOSCheckPermission(perm MacOSPermission) bool {
	return native.MaaToolkitMacOSCheckPermission(perm)
}

// MacOSRequestPermission requests the given macOS permission from the user.
// Returns true if the permission was granted, false otherwise.
func MacOSRequestPermission(perm MacOSPermission) bool {
	return native.MaaToolkitMacOSRequestPermission(perm)
}

// MacOSRevealPermissionSettings opens the System Settings page for the given macOS permission.
// Returns true on success.
func MacOSRevealPermissionSettings(perm MacOSPermission) bool {
	return native.MaaToolkitMacOSRevealPermissionSettings(perm)
}
