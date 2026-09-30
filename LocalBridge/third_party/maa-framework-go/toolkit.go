package maa

import (
	"errors"
	"sync"
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

// GamescopeInstance describes a running gamescope instance.
type GamescopeInstance struct {
	DisplayNo      uint32
	PipeWireNodeID uint32
	EisSocketPath  string
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

// FindGamescopeInstances finds running gamescope instances, ordered by display number.
// An empty slice means no instances were found. A zero PipeWireNodeID or empty
// EisSocketPath means the corresponding capture or input endpoint is unavailable.
func FindGamescopeInstances() ([]*GamescopeInstance, error) {
	listHandle := native.MaaToolkitGamescopeInstanceListCreate()
	if listHandle == 0 {
		return nil, errors.New("failed to create gamescope instance list")
	}
	defer native.MaaToolkitGamescopeInstanceListDestroy(listHandle)

	if !native.MaaToolkitGamescopeInstanceFindAll(listHandle) {
		return nil, errors.New("failed to find gamescope instances")
	}

	size := native.MaaToolkitGamescopeInstanceListSize(listHandle)
	list := make([]*GamescopeInstance, size)
	for i := uint64(0); i < size; i++ {
		instance := native.MaaToolkitGamescopeInstanceListAt(listHandle, i)
		if instance == 0 {
			return nil, errors.New("failed to get gamescope instance")
		}
		list[i] = &GamescopeInstance{
			DisplayNo:      native.MaaToolkitGamescopeInstanceGetDisplayNo(instance),
			PipeWireNodeID: native.MaaToolkitGamescopeInstanceGetPipeWireNodeId(instance),
			EisSocketPath:  native.MaaToolkitGamescopeInstanceGetEisSocketPath(instance),
		}
	}
	return list, nil
}

// PortalHelper manages an xdg-desktop-portal ScreenCast session.
// Call Destroy when the session and its PipeWire FD are no longer needed.
// Do not use the helper after Destroy.
// A PortalHelper must not be copied after creation.
type PortalHelper struct {
	mu     sync.Mutex
	handle uintptr
}

// NewPortalHelper creates a ScreenCast portal helper.
func NewPortalHelper() (*PortalHelper, error) {
	handle := native.MaaToolkitPortalHelperCreate()
	if handle == 0 {
		return nil, errors.New("failed to create portal helper")
	}
	liveNativeObjects.Add(1)
	return &PortalHelper{handle: handle}, nil
}

// Destroy closes the portal session and frees the helper. It is safe to call
// more than once, including from concurrent goroutines.
func (p *PortalHelper) Destroy() {
	if p == nil {
		return
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.handle == 0 {
		return
	}
	native.MaaToolkitPortalHelperDestroy(p.handle)
	p.handle = 0
	liveNativeObjects.Add(-1)
}

// OpenStream opens a ScreenCast stream through xdg-desktop-portal.
func (p *PortalHelper) OpenStream() error {
	if p == nil {
		return errors.New("portal helper is destroyed")
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.handle == 0 {
		return errors.New("portal helper is destroyed")
	}
	if !native.MaaToolkitPortalHelperOpenStream(p.handle) {
		return errors.New("failed to open portal stream")
	}
	return nil
}

// Persist reports whether the portal session is configured to persist.
func (p *PortalHelper) Persist() bool {
	if p == nil {
		return false
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.handle == 0 {
		return false
	}
	return native.MaaToolkitPortalHelperGetPersist(p.handle)
}

// SetPersist configures whether the portal session should persist.
func (p *PortalHelper) SetPersist(enable bool) {
	if p == nil {
		return
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.handle == 0 {
		return
	}
	native.MaaToolkitPortalHelperSetPersist(p.handle, enable)
}

// PipeWireFD returns the portal's PipeWire socket FD for pw_socket_fd.
// The helper owns the FD; keep it alive while a controller uses the stream.
func (p *PortalHelper) PipeWireFD() int {
	if p == nil {
		return -1
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.handle == 0 {
		return -1
	}
	return int(native.MaaToolkitPortalHelperGetPipeWireFD(p.handle))
}

// PipeWireNodeID returns the stream node ID for pw_node_id.
func (p *PortalHelper) PipeWireNodeID() uint32 {
	if p == nil {
		return 0
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.handle == 0 {
		return 0
	}
	return native.MaaToolkitPortalHelperGetPipeWireNodeID(p.handle)
}

// RestoreToken returns the token that can restore a persistent session.
func (p *PortalHelper) RestoreToken() string {
	if p == nil {
		return ""
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.handle == 0 {
		return ""
	}
	return native.MaaToolkitPortalHelperGetRestoreToken(p.handle)
}

// SetRestoreToken sets a token from a previous persistent session before OpenStream.
func (p *PortalHelper) SetRestoreToken(token string) {
	if p == nil {
		return
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.handle == 0 {
		return
	}
	native.MaaToolkitPortalHelperSetRestoreToken(p.handle, token)
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
