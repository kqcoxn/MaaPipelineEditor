package mfw

import (
	"sync"

	maa "github.com/MaaXYZ/maa-framework-go/v3"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
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
func (s *Service) Initialize() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.initialized {
		return ErrNotInitialized
	}

	logger.Info("MFW", "初始化 MaaFramework")

	err := maa.Init(
		maa.WithLibDir("D:/_Projects/programs/MaaNewMoonAccompanying/deps/bin"),
		maa.WithLogDir("./logs"),
		maa.WithSaveDraw(false),
		maa.WithStdoutLevel(maa.LoggingLevelInfo),
		maa.WithDebugMode(false),
	)
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

	logger.Info("MFW", "关闭 MaaFramework")

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

	logger.Info("MFW", "MaaFramework 已关闭")
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
