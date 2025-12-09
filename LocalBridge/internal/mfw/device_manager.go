package mfw

import (
	"fmt"
	"sync"

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

	// TODO: 实际调用需要根据maa-framework-go的API调整
	// devices := maa.FindAdbDevices()

	dm.mu.Lock()
	defer dm.mu.Unlock()

	// 临时返回空列表，待API确认后实现
	dm.adbDevices = make([]AdbDeviceInfo, 0)

	logger.Info("MFW", "发现 %d 个 ADB 设备", len(dm.adbDevices))
	return dm.adbDevices, nil
}

// 刷新Win32窗体列表
func (dm *DeviceManager) RefreshWin32Windows() ([]Win32WindowInfo, error) {
	logger.Info("MFW", "开始刷新 Win32 窗体列表")

	// TODO: 实际调用需要根据maa-framework-go的API调整
	// windows := maa.FindWin32Windows()

	dm.mu.Lock()
	defer dm.mu.Unlock()

	// 临时返回空列表，待API确认后实现
	dm.win32Windows = make([]Win32WindowInfo, 0)

	_ = fmt.Sprintf("") // 避免未使用的导入错误

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
