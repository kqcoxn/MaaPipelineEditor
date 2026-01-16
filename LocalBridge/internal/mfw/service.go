package mfw

import (
	"fmt"
	"os"
	"runtime"
	"sync"

	maa "github.com/MaaXYZ/maa-framework-go/v3"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/config"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/paths"
)

// MFW服务管理器
type Service struct {
	deviceManager     *DeviceManager
	controllerManager *ControllerManager
	resourceManager   *ResourceManager
	taskManager       *TaskManager
	initialized       bool
	mu                sync.RWMutex
}

// 创建MFW服务
func NewService() *Service {
	return &Service{
		deviceManager:     NewDeviceManager(),
		controllerManager: NewControllerManager(),
		resourceManager:   NewResourceManager(),
		taskManager:       NewTaskManager(),
		initialized:       false,
	}
}

// 初始化MFW框架
func (s *Service) Initialize() (err error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// 捕获 panic
	defer func() {
		if r := recover(); r != nil {
			// 将 panic 转换为错误
			err = fmt.Errorf("MaaFramework 初始化时发生严重错误，可能是库版本不匹配。\n"+
				"请更新 MaaFramework 到最新版本。\n"+
				"下载地址: https://github.com/MaaXYZ/MaaFramework/releases\n"+
				"错误详情: %v", r)
			logger.Error("MFW", "%v", err)
		}
	}()

	if s.initialized {
		return ErrNotInitialized
	}

	logger.Info("MFW", "初始化 MaaFramework")

	// 从配置获取库路径
	cfg := config.GetGlobal()
	if cfg == nil || cfg.MaaFW.LibDir == "" {
		return fmt.Errorf("MaaFramework 库路径未配置，请使用 'mpelb config set-lib' 设置路径")
	}
	libDir := cfg.MaaFW.LibDir
	logger.Info("MFW", "使用配置的库路径: %s", libDir)

	// Windows 下处理中文路径
	useWorkDirSwitch := false
	var originalDir string
	if runtime.GOOS == "windows" && ContainsNonASCII(libDir) {
		logger.Debug("MFW", "检测到路径包含非 ASCII 字符，尝试转换为短路径...")

		// 尝试转换为短路径
		shortPath, err := GetShortPathName(libDir)
		if err == nil && shortPath != libDir && !ContainsNonASCII(shortPath) {
			logger.Debug("MFW", "已转换为短路径: %s", shortPath)
			libDir = shortPath
		} else {
			// 工作目录切换方案
			logger.Debug("MFW", "短路径无效，使用工作目录切换方案...")
			originalDir, err = os.Getwd()
			if err != nil {
				logger.Warn("MFW", "获取当前工作目录失败: %v", err)
			} else {
				if err := os.Chdir(libDir); err != nil {
					logger.Warn("MFW", "切换工作目录失败: %v", err)
				} else {
					logger.Debug("MFW", "已切换工作目录到: %s", libDir)
					libDir = "." // 使用当前目录
					useWorkDirSwitch = true
				}
			}
		}
	}

	// 日志目录使用 paths 包
	logDir := paths.GetLogDir()

	// 日志目录也需要处理中文路径
	if runtime.GOOS == "windows" && ContainsNonASCII(logDir) {
		if shortPath, err := GetShortPathName(logDir); err == nil && shortPath != logDir {
			logger.Debug("MFW", "日志目录已转换为短路径: %s", shortPath)
			logDir = shortPath
		}
	}

	err = maa.Init(
		maa.WithLibDir(libDir),
		maa.WithLogDir(logDir),
		maa.WithSaveDraw(true),
		maa.WithStdoutLevel(maa.LoggingLevelOff),
		maa.WithDebugMode(true),
	)

	// 恢复原工作目录
	if useWorkDirSwitch && originalDir != "" {
		if restoreErr := os.Chdir(originalDir); restoreErr != nil {
			logger.Warn("MFW", "恢复工作目录失败: %v", restoreErr)
		} else {
			logger.Debug("MFW", "已恢复工作目录到: %s", originalDir)
		}
	}

	if err != nil {
		logger.Error("MFW", "MaaFramework 初始化失败: %v", err)
		return err
	}

	s.initialized = true

	logger.Info("MFW", "MaaFramework 初始化成功")
	return nil
}

// 关闭MFW服务
func (s *Service) Shutdown() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.initialized {
		return nil
	}

	logger.Debug("MFW", "关闭 MaaFramework")

	// 停止所有任务
	s.taskManager.StopAll()

	// 断开所有控制器
	s.controllerManager.DisconnectAll()

	// 卸载所有资源
	s.resourceManager.UnloadAll()

	// 释放框架资源
	if err := maa.Release(); err != nil {
		logger.Error("MFW", "MaaFramework 释放失败: %v", err)
		return err
	}

	s.initialized = false

	logger.Debug("MFW", "MaaFramework 已关闭")
	return nil
}

// 获取设备管理器
func (s *Service) DeviceManager() *DeviceManager {
	return s.deviceManager
}

// 获取控制器管理器
func (s *Service) ControllerManager() *ControllerManager {
	return s.controllerManager
}

// 获取资源管理器
func (s *Service) ResourceManager() *ResourceManager {
	return s.resourceManager
}

// 获取任务管理器
func (s *Service) TaskManager() *TaskManager {
	return s.taskManager
}

// 检查是否已初始化
func (s *Service) IsInitialized() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.initialized
}
