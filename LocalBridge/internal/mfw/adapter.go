package mfw

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"image"
	"image/png"
	"sync"
	"time"
	"unsafe"

	maa "github.com/MaaXYZ/maa-framework-go/v3"
	"github.com/MaaXYZ/maa-framework-go/v3/controller/adb"
	"github.com/MaaXYZ/maa-framework-go/v3/controller/win32"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
)

// ============================================================================
// MaaFW Adapter - 统一封装层
// ============================================================================

// MaaFWAdapter MaaFramework 统一适配器
// 封装 Controller、Resource、Tasker、Agent 的管理
type MaaFWAdapter struct {
	controller    *maa.Controller
	resource      *maa.Resource
	tasker        *maa.Tasker
	agentClient   *maa.AgentClient
	screenshotter *Screenshotter

	// 状态
	controllerConnected bool
	resourceLoaded      bool
	agentConnected      bool
	initialized         bool

	// 元信息
	controllerType string // ADB/Win32
	deviceInfo     string // 设备名称/窗口名称

	// 事件回调
	contextSinkID int64
	taskerSinkID  int64

	mu sync.RWMutex
}

// NewMaaFWAdapter 创建新的 MaaFW 适配器
func NewMaaFWAdapter() *MaaFWAdapter {
	return &MaaFWAdapter{
		screenshotter: NewScreenshotter(),
	}
}

// ============================================================================
// Controller 管理
// ============================================================================

// ConnectADB 连接 ADB 控制器
// screencapMethods/inputMethods 为方法名数组, config 为配置 JSON, agentPath 为 agent 路径
func (a *MaaFWAdapter) ConnectADB(adbPath, address string, screencapMethods, inputMethods []string, config, agentPath string) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	logger.Debug("MaaFW", "连接 ADB 控制器: %s, %s", adbPath, address)

	// 解析截图方法
	var scMethod adb.ScreencapMethod
	for _, m := range screencapMethods {
		parsed, _ := adb.ParseScreencapMethod(m)
		scMethod |= parsed
	}

	// 解析输入方法
	var inMethod adb.InputMethod
	for _, m := range inputMethods {
		parsed, _ := adb.ParseInputMethod(m)
		inMethod |= parsed
	}

	// 创建 ADB 控制器
	ctrl := maa.NewAdbController(adbPath, address, scMethod, inMethod, config, agentPath)
	if ctrl == nil {
		return fmt.Errorf("创建 ADB 控制器失败")
	}

	// 连接
	connectJob := ctrl.PostConnect()
	if connectJob == nil {
		ctrl.Destroy()
		return fmt.Errorf("发起连接失败")
	}

	connectJob.Wait()
	if !connectJob.Success() {
		ctrl.Destroy()
		return fmt.Errorf("连接失败: %v", connectJob.Status())
	}

	// 清理旧控制器
	if a.controller != nil {
		a.controller.Destroy()
	}

	a.controller = ctrl
	a.controllerConnected = true
	a.controllerType = "ADB"
	a.deviceInfo = address
	a.screenshotter.SetController(ctrl)

	logger.Info("MaaFW", "ADB 控制器已连接")
	return nil
}

// ConnectWin32 连接 Win32 控制器
// screencapMethod/inputMethod 为方法名字符串
func (a *MaaFWAdapter) ConnectWin32(hwnd uintptr, screencapMethod, inputMethod string) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	logger.Debug("MaaFW", "连接 Win32 控制器: HWND=%x", hwnd)

	// 解析截图方法
	scMethod, _ := win32.ParseScreencapMethod(screencapMethod)

	// 解析输入方法
	mouseMethod, _ := win32.ParseInputMethod(inputMethod)

	// 创建 Win32 控制器
	ctrl := maa.NewWin32Controller(unsafe.Pointer(hwnd), scMethod, mouseMethod, mouseMethod)
	if ctrl == nil {
		return fmt.Errorf("创建 Win32 控制器失败")
	}

	// 连接
	connectJob := ctrl.PostConnect()
	if connectJob == nil {
		ctrl.Destroy()
		return fmt.Errorf("发起连接失败")
	}

	connectJob.Wait()
	if !connectJob.Success() {
		ctrl.Destroy()
		return fmt.Errorf("连接失败: %v", connectJob.Status())
	}

	// 清理旧控制器
	if a.controller != nil {
		a.controller.Destroy()
	}

	a.controller = ctrl
	a.controllerConnected = true
	a.controllerType = "Win32"
	a.deviceInfo = fmt.Sprintf("HWND:%x", hwnd)
	a.screenshotter.SetController(ctrl)

	logger.Info("MaaFW", "Win32 控制器已连接")
	return nil
}

// SetController 直接设置已连接的控制器
func (a *MaaFWAdapter) SetController(ctrl *maa.Controller, ctrlType, deviceInfo string) {
	a.mu.Lock()
	defer a.mu.Unlock()

	if a.controller != nil && a.controller != ctrl {
		a.controller.Destroy()
	}

	a.controller = ctrl
	a.controllerConnected = ctrl != nil && ctrl.Connected()
	a.controllerType = ctrlType
	a.deviceInfo = deviceInfo
	a.screenshotter.SetController(ctrl)
}

// GetController 获取控制器
func (a *MaaFWAdapter) GetController() *maa.Controller {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.controller
}

// IsControllerConnected 检查控制器是否已连接
func (a *MaaFWAdapter) IsControllerConnected() bool {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.controllerConnected && a.controller != nil
}

// ============================================================================
// Resource 管理
// ============================================================================

// LoadResource 加载资源
func (a *MaaFWAdapter) LoadResource(path string) error {
	return a.LoadResources([]string{path})
}

// LoadResources 加载多个资源路径
func (a *MaaFWAdapter) LoadResources(paths []string) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	if len(paths) == 0 {
		return fmt.Errorf("资源路径不能为空")
	}

	logger.Debug("MaaFW", "加载资源: %v", paths)

	// 创建新资源
	res := maa.NewResource()
	if res == nil {
		return fmt.Errorf("创建资源失败")
	}

	// 依次加载所有资源包
	for i, path := range paths {
		if path == "" {
			continue
		}

		logger.Debug("MaaFW", "加载资源包 [%d/%d]: %s", i+1, len(paths), path)

		loadJob := res.PostBundle(path)
		if loadJob == nil {
			res.Destroy()
			return fmt.Errorf("发起资源加载失败: %s", path)
		}

		loadJob.Wait()
		if !loadJob.Success() {
			res.Destroy()
			return fmt.Errorf("资源加载失败 [%s]: %v", path, loadJob.Status())
		}

		logger.Debug("MaaFW", "资源包加载成功: %s", path)
	}

	// 清理旧资源
	if a.resource != nil {
		a.resource.Destroy()
	}

	a.resource = res
	a.resourceLoaded = true

	logger.Debug("MaaFW", "资源已加载 (共 %d 个路径)", len(paths))
	return nil
}

// SetResource 直接设置已加载的资源
func (a *MaaFWAdapter) SetResource(res *maa.Resource) {
	a.mu.Lock()
	defer a.mu.Unlock()

	if a.resource != nil && a.resource != res {
		a.resource.Destroy()
	}

	a.resource = res
	a.resourceLoaded = res != nil
}

// GetResource 获取资源
func (a *MaaFWAdapter) GetResource() *maa.Resource {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.resource
}

// IsResourceLoaded 检查资源是否已加载
func (a *MaaFWAdapter) IsResourceLoaded() bool {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.resourceLoaded && a.resource != nil
}

// GetNodeJSON 获取节点 JSON 数据
func (a *MaaFWAdapter) GetNodeJSON(nodeName string) (string, bool) {
	a.mu.RLock()
	defer a.mu.RUnlock()

	if a.resource == nil {
		return "", false
	}
	return a.resource.GetNodeJSON(nodeName)
}

// ============================================================================
// Tasker 管理
// ============================================================================

// InitTasker 初始化 Tasker
// 必须在 Controller 和 Resource 都准备好之后调用
func (a *MaaFWAdapter) InitTasker() error {
	a.mu.Lock()
	defer a.mu.Unlock()

	if a.controller == nil || !a.controllerConnected {
		return fmt.Errorf("控制器未连接")
	}
	if a.resource == nil || !a.resourceLoaded {
		return fmt.Errorf("资源未加载")
	}

	// 创建 Tasker
	logger.Debug("MaaFW", "创建 Tasker...")
	tasker := maa.NewTasker()
	if tasker == nil {
		return fmt.Errorf("创建 Tasker 失败")
	}
	logger.Debug("MaaFW", "Tasker 创建成功,指针: %p", tasker)

	// 绑定资源
	if !tasker.BindResource(a.resource) {
		tasker.Destroy()
		return fmt.Errorf("绑定资源失败")
	}

	// 绑定控制器
	if !tasker.BindController(a.controller) {
		tasker.Destroy()
		return fmt.Errorf("绑定控制器失败")
	}

	// 检查初始化状态
	if !tasker.Initialized() {
		tasker.Destroy()
		return fmt.Errorf("Tasker 初始化失败")
	}

	// 清理旧 Tasker
	if a.tasker != nil {
		a.tasker.Destroy()
	}

	a.tasker = tasker
	a.initialized = true

	logger.Debug("MaaFW", "Tasker 已初始化")
	return nil
}

// GetTasker 获取 Tasker
func (a *MaaFWAdapter) GetTasker() *maa.Tasker {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.tasker
}

// IsInitialized 检查是否已初始化
func (a *MaaFWAdapter) IsInitialized() bool {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.initialized && a.tasker != nil && a.tasker.Initialized()
}

// RunTask 运行任务（同步等待完成）
func (a *MaaFWAdapter) RunTask(entry string, override ...interface{}) (*maa.TaskJob, error) {
	a.mu.RLock()
	tasker := a.tasker
	a.mu.RUnlock()

	if tasker == nil {
		return nil, fmt.Errorf("Tasker 未初始化")
	}

	logger.Info("MaaFW", "运行任务: %s", entry)

	var taskJob *maa.TaskJob
	if len(override) > 0 {
		taskJob = tasker.PostTask(entry, override[0])
	} else {
		taskJob = tasker.PostTask(entry)
	}

	if taskJob == nil {
		return nil, fmt.Errorf("提交任务失败")
	}

	// 同步等待任务完成
	taskJob.Wait()

	logger.Info("MaaFW", "任务完成: %s", entry)
	return taskJob, nil
}

// PostTask 提交任务
func (a *MaaFWAdapter) PostTask(entry string, override ...interface{}) (*maa.TaskJob, error) {
	a.mu.RLock()
	tasker := a.tasker
	a.mu.RUnlock()

	if tasker == nil {
		return nil, fmt.Errorf("Tasker 未初始化")
	}

	var taskJob *maa.TaskJob
	if len(override) > 0 {
		taskJob = tasker.PostTask(entry, override[0])
	} else {
		taskJob = tasker.PostTask(entry)
	}

	if taskJob == nil {
		return nil, fmt.Errorf("提交任务失败")
	}

	return taskJob, nil
}

// StopTask 停止当前任务
func (a *MaaFWAdapter) StopTask() error {
	a.mu.RLock()
	tasker := a.tasker
	a.mu.RUnlock()

	if tasker == nil {
		return fmt.Errorf("Tasker 未初始化")
	}

	stopJob := tasker.PostStop()
	if stopJob != nil {
		stopJob.Wait()
	}

	return nil
}

// PostStop 发送停止信号
func (a *MaaFWAdapter) PostStop() {
	a.mu.RLock()
	tasker := a.tasker
	a.mu.RUnlock()

	if tasker != nil {
		tasker.PostStop()
	}
}

// ============================================================================
// Agent 管理
// ============================================================================

// ConnectAgent 连接 Agent
func (a *MaaFWAdapter) ConnectAgent(identifier string) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	logger.Debug("MaaFW", "开始连接 Agent: identifier=%s, Tasker指针=%p, 资源指针=%p", identifier, a.tasker, a.resource)

	// 清理旧 Agent
	if a.agentClient != nil {
		a.agentClient.Disconnect()
		a.agentClient.Destroy()
		a.agentClient = nil
		a.agentConnected = false
	}

	// 创建 AgentClient
	client := maa.NewAgentClient(identifier)
	if client == nil {
		return fmt.Errorf("创建 AgentClient 失败")
	}
	a.agentClient = client

	// 绑定资源
	if a.resource == nil {
		client.Destroy()
		a.agentClient = nil
		return fmt.Errorf("资源未加载")
	}
	if !client.BindResource(a.resource) {
		client.Destroy()
		a.agentClient = nil
		return fmt.Errorf("绑定资源到 Agent 失败")
	}

	// 注册 Tasker 事件回传
	if a.tasker != nil {
		logger.Debug("MaaFW", "正在注册 Tasker Sink 到 Agent")
		if !client.RegisterTaskerSink(*a.tasker) {
			logger.Warn("MaaFW", "注册 Tasker Sink 失败")
		} else {
			logger.Debug("MaaFW", "Tasker Sink 注册成功")
		}
	} else {
		logger.Warn("MaaFW", "Tasker 为 nil,跳过注册 Tasker Sink")
	}

	// 连接
	logger.Debug("MaaFW", "正在连接 Agent...")
	if !client.Connect() {
		client.Destroy()
		a.agentClient = nil
		return fmt.Errorf("Agent 连接失败")
	}

	// 使用超时检查连接状态
	logger.Debug("MaaFW", "Agent.Connect() 成功,检查连接状态(超时5秒)...")
	connected := false
	for i := 0; i < 50; i++ {
		if client.Connected() {
			connected = true
			break
		}
		time.Sleep(100 * time.Millisecond)
	}

	if !connected {
		logger.Warn("MaaFW", "Agent 连接状态检查超时,强制断开")
		client.Disconnect()
		client.Destroy()
		a.agentClient = nil
		return fmt.Errorf("Agent 连接状态异常(超时)")
	}

	a.agentConnected = true
	logger.Info("MaaFW", "Agent 已连接")
	return nil
}

// DisconnectAgent 断开 Agent 连接
func (a *MaaFWAdapter) DisconnectAgent() {
	a.mu.Lock()
	defer a.mu.Unlock()

	if a.agentClient != nil {
		a.agentClient.Disconnect()
		a.agentClient.Destroy()
		a.agentClient = nil
	}
	a.agentConnected = false
}

// IsAgentConnected 检查 Agent 是否已连接
func (a *MaaFWAdapter) IsAgentConnected() bool {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.agentConnected && a.agentClient != nil && a.agentClient.Connected()
}

// GetAgentClient 获取 AgentClient
func (a *MaaFWAdapter) GetAgentClient() *maa.AgentClient {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.agentClient
}

// ============================================================================
// 事件回调管理
// ============================================================================

// AddContextSink 添加上下文事件监听器
func (a *MaaFWAdapter) AddContextSink(sink maa.ContextEventSink) int64 {
	a.mu.Lock()
	defer a.mu.Unlock()

	if a.tasker == nil {
		return 0
	}

	sinkID := a.tasker.AddContextSink(sink)
	if sinkID > 0 {
		a.contextSinkID = sinkID
	}
	return sinkID
}

// RemoveContextSink 移除上下文事件监听器
func (a *MaaFWAdapter) RemoveContextSink(sinkID int64) {
	a.mu.Lock()
	defer a.mu.Unlock()

	if a.tasker != nil && sinkID > 0 {
		a.tasker.RemoveContextSink(sinkID)
	}
}

// ClearContextSinks 清除所有上下文事件监听器
func (a *MaaFWAdapter) ClearContextSinks() {
	a.mu.Lock()
	defer a.mu.Unlock()

	if a.tasker != nil {
		a.tasker.ClearContextSinks()
	}
	a.contextSinkID = 0
}

// AddTaskerSink 添加 Tasker 事件监听器
func (a *MaaFWAdapter) AddTaskerSink(sink maa.TaskerEventSink) int64 {
	a.mu.Lock()
	defer a.mu.Unlock()

	if a.tasker == nil {
		return 0
	}

	sinkID := a.tasker.AddSink(sink)
	if sinkID > 0 {
		a.taskerSinkID = sinkID
	}
	return sinkID
}

// RemoveTaskerSink 移除 Tasker 事件监听器
func (a *MaaFWAdapter) RemoveTaskerSink(sinkID int64) {
	a.mu.Lock()
	defer a.mu.Unlock()

	if a.tasker != nil && sinkID > 0 {
		a.tasker.RemoveSink(sinkID)
	}
}

// ============================================================================
// 截图功能
// ============================================================================

// GetScreenshotter 获取截图器
func (a *MaaFWAdapter) GetScreenshotter() *Screenshotter {
	return a.screenshotter
}

// Screencap 截图并返回 Base64 编码的 PNG
func (a *MaaFWAdapter) Screencap() (string, error) {
	return a.screenshotter.CaptureBase64()
}

// ScreencapImage 截图并返回 image.Image
func (a *MaaFWAdapter) ScreencapImage() (image.Image, error) {
	return a.screenshotter.Capture()
}

// ============================================================================
// 清理
// ============================================================================

// Destroy 销毁适配器，释放所有资源
func (a *MaaFWAdapter) Destroy() {
	a.mu.Lock()
	defer a.mu.Unlock()

	logger.Debug("MaaFW", "销毁 MaaFW 适配器")

	// 断开 Agent
	if a.agentClient != nil {
		a.agentClient.Disconnect()
		a.agentClient.Destroy()
		a.agentClient = nil
	}
	a.agentConnected = false

	// 销毁 Tasker
	if a.tasker != nil {
		a.tasker.Destroy()
		a.tasker = nil
	}
	a.initialized = false

	// 销毁 Resource
	if a.resource != nil {
		a.resource.Destroy()
		a.resource = nil
	}
	a.resourceLoaded = false

	// 销毁 Controller
	if a.controller != nil {
		a.controller.Destroy()
		a.controller = nil
	}
	a.controllerConnected = false

	// 清理截图器
	a.screenshotter.SetController(nil)

	logger.Debug("MaaFW", "MaaFW 适配器已销毁")
}

// GetStatus 获取当前状态摘要
func (a *MaaFWAdapter) GetStatus() map[string]interface{} {
	a.mu.RLock()
	defer a.mu.RUnlock()

	return map[string]interface{}{
		"controller_connected": a.controllerConnected,
		"controller_type":      a.controllerType,
		"device_info":          a.deviceInfo,
		"resource_loaded":      a.resourceLoaded,
		"agent_connected":      a.agentConnected,
		"initialized":          a.initialized,
	}
}

// ============================================================================
// Screenshotter - 截图缓存器
// ============================================================================

// Screenshotter 截图缓存器
type Screenshotter struct {
	controller *maa.Controller
	lastImage  image.Image
	lastTime   time.Time
	cacheTTL   time.Duration
	mu         sync.RWMutex
}

// NewScreenshotter 创建截图缓存器
func NewScreenshotter() *Screenshotter {
	return &Screenshotter{
		cacheTTL: 100 * time.Millisecond, // 默认缓存 100ms
	}
}

// SetController 设置控制器
func (s *Screenshotter) SetController(ctrl *maa.Controller) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.controller = ctrl
	s.lastImage = nil
}

// SetCacheTTL 设置缓存有效期
func (s *Screenshotter) SetCacheTTL(ttl time.Duration) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cacheTTL = ttl
}

// Capture 截图并返回 image.Image
func (s *Screenshotter) Capture() (image.Image, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.controller == nil {
		return nil, fmt.Errorf("控制器未设置")
	}

	// 检查缓存
	if s.lastImage != nil && time.Since(s.lastTime) < s.cacheTTL {
		return s.lastImage, nil
	}

	// 执行截图
	job := s.controller.PostScreencap()
	if job == nil {
		return nil, fmt.Errorf("发起截图失败")
	}

	job.Wait()
	if !job.Success() {
		return nil, fmt.Errorf("截图失败: %v", job.Status())
	}

	// 获取缓存的图像
	img := s.controller.CacheImage()
	if img == nil {
		return nil, fmt.Errorf("获取截图数据失败")
	}

	s.lastImage = img
	s.lastTime = time.Now()

	return img, nil
}

// CaptureBase64 截图并返回 Base64 编码的 PNG
func (s *Screenshotter) CaptureBase64() (string, error) {
	img, err := s.Capture()
	if err != nil {
		return "", err
	}

	// 编码为 PNG
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return "", fmt.Errorf("PNG 编码失败: %w", err)
	}

	// Base64 编码
	return base64.StdEncoding.EncodeToString(buf.Bytes()), nil
}

// CaptureForce 强制截图（忽略缓存）
func (s *Screenshotter) CaptureForce() (image.Image, error) {
	s.mu.Lock()
	s.lastImage = nil
	s.mu.Unlock()

	return s.Capture()
}

// ClearCache 清除缓存
func (s *Screenshotter) ClearCache() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.lastImage = nil
}
