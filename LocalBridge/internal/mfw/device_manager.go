package mfw

import (
	"fmt"
	"sync"

	maa "github.com/MaaXYZ/maa-framework-go/v3"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
)

// 设备管理器
type DeviceManager struct {
	adbDevices   []AdbDeviceInfo
	win32Windows []Win32WindowInfo
	mu           sync.RWMutex
}

// 创建设备管理器
func NewDeviceManager() *DeviceManager {
	return &DeviceManager{
		adbDevices:   make([]AdbDeviceInfo, 0),
		win32Windows: make([]Win32WindowInfo, 0),
	}
}

// 刷新ADB设备列表
func (dm *DeviceManager) RefreshAdbDevices() ([]AdbDeviceInfo, error) {
	logger.Info("MFW", "开始刷新 ADB 设备列表")

	// FindAdbDevices API
	devices := maa.FindAdbDevices()

	// ADB 可用的截图和输入方法（完整列表供用户选择）
	// 截图方法：编码写入后拉取、直接编码、压缩原始流、网络直连、Minicap直连/流式、模拟器扩展等
	screencapMethods := []string{"EncodeToFileAndPull", "Encode", "RawWithGzip", "RawByNetcat", "MinicapDirect", "MinicapStream", "EmulatorExtras"}
	// 输入方法：ADB Shell、Minitouch+ADB键盘、Maatouch、模拟器扩展
	inputMethods := []string{"AdbShell", "MinitouchAndAdbKey", "Maatouch", "EmulatorExtras"}

	dm.mu.Lock()
	defer dm.mu.Unlock()

	dm.adbDevices = make([]AdbDeviceInfo, 0, len(devices))
	for _, dev := range devices {
		info := AdbDeviceInfo{
			AdbPath:          dev.AdbPath,
			Address:          dev.Address,
			Name:             dev.Name,
			ScreencapMethods: screencapMethods,
			InputMethods:     inputMethods,
			Config:           dev.Config,
		}
		dm.adbDevices = append(dm.adbDevices, info)
	}

	logger.Info("MFW", "发现 %d 个 ADB 设备", len(dm.adbDevices))
	return dm.adbDevices, nil
}

// 刷新Win32窗体列表
func (dm *DeviceManager) RefreshWin32Windows() ([]Win32WindowInfo, error) {
	logger.Info("MFW", "开始刷新 Win32 窗体列表")

	// FindDesktopWindows API
	windows := maa.FindDesktopWindows()

	// Win32 可用的截图和输入方法
	// 截图方法: GDI、FramePool、DXGI桌面复制、DXGI窗口模式、PrintWindow、ScreenDC
	screencapMethods := []string{"GDI", "FramePool", "DXGIDesktopDup", "DXGIDesktopDupWindow", "PrintWindow", "ScreenDC"}
	// 输入方法: Seize、SendMessage、PostMessage、LegacyEvent、PostThreadMessage、带光标位置的消息、阻塞输入
	inputMethods := []string{"Seize", "SendMessage", "PostMessage", "LegacyEvent", "PostThreadMessage", "SendMessageWithCursorPos", "PostMessageWithCursorPos", "SendMessageWithCursorPosAndBlockInput", "PostMessageWithCursorPosAndBlockInput"}

	dm.mu.Lock()
	defer dm.mu.Unlock()

	dm.win32Windows = make([]Win32WindowInfo, 0, len(windows))
	for _, win := range windows {
		info := Win32WindowInfo{
			Hwnd:             fmt.Sprintf("%p", win.Handle),
			ClassName:        win.ClassName,
			WindowName:       win.WindowName,
			ScreencapMethods: screencapMethods,
			InputMethods:     inputMethods,
		}
		dm.win32Windows = append(dm.win32Windows, info)
	}

	logger.Info("MFW", "发现 %d 个 Win32 窗体", len(dm.win32Windows))
	return dm.win32Windows, nil
}

// 获取ADB设备列表
func (dm *DeviceManager) GetAdbDevices() []AdbDeviceInfo {
	dm.mu.RLock()
	defer dm.mu.RUnlock()
	return dm.adbDevices
}

// 获取Win32窗体列表
func (dm *DeviceManager) GetWin32Windows() []Win32WindowInfo {
	dm.mu.RLock()
	defer dm.mu.RUnlock()
	return dm.win32Windows
}
