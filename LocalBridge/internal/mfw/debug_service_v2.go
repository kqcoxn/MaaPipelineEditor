package mfw

import (
	"encoding/json"
	"fmt"
	"sync"
	"time"

	maa "github.com/MaaXYZ/maa-framework-go/v3"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
)

// ============================================================================
// DebugServiceV2 - 重构的调试服务
// ============================================================================

// DebugSessionStatus 调试会话状态
type DebugSessionStatus string

const (
	SessionStatusIdle      DebugSessionStatus = "idle"      // 空闲
	SessionStatusPreparing DebugSessionStatus = "preparing" // 准备中
	SessionStatusRunning   DebugSessionStatus = "running"   // 运行中
	SessionStatusPaused    DebugSessionStatus = "paused"    // 已暂停（在断点处）
	SessionStatusCompleted DebugSessionStatus = "completed" // 已完成
	SessionStatusError     DebugSessionStatus = "error"     // 错误
)

// DebugSessionV2 调试会话
type DebugSessionV2 struct {
	// 基本信息
	SessionID    string             `json:"session_id"`
	ResourcePath string             `json:"resource_path"`
	EntryNode    string             `json:"entry_node"`
	Status       DebugSessionStatus `json:"status"`
	CreatedAt    time.Time          `json:"created_at"`

	// MaaFW 组件
	adapter *MaaFWAdapter

	// 事件回调
	eventCallback DebugEventCallback
	contextSink   *SimpleContextSink
	contextSinkID int64

	// 执行状态
	currentNode    string           // 当前节点
	lastNode       string           // 上一个执行的节点
	executedNodes  map[string]int   // 已执行节点计数
	breakpoints    map[string]bool  // 断点集合
	tempBreakpoint string           // 临时断点（单步执行）
	taskJob        *maa.TaskJob     // 当前任务
	pauseReason    string           // 暂停原因
	lastError      error            // 最后一个错误
	nodeStartTime  map[string]int64 // 节点开始时间

	mu sync.RWMutex
}

// DebugServiceV2 调试服务
type DebugServiceV2 struct {
	service  *Service
	sessions map[string]*DebugSessionV2
	mu       sync.RWMutex
}

// NewDebugServiceV2 创建调试服务
func NewDebugServiceV2(service *Service) *DebugServiceV2 {
	return &DebugServiceV2{
		service:  service,
		sessions: make(map[string]*DebugSessionV2),
	}
}

// ============================================================================
// 会话管理
// ============================================================================

// CreateSession 创建调试会话
func (ds *DebugServiceV2) CreateSession(resourcePath, controllerID string, eventCallback DebugEventCallback) (*DebugSessionV2, error) {
	ds.mu.Lock()
	defer ds.mu.Unlock()

	logger.Info("DebugV2", "创建调试会话: 资源=%s, 控制器=%s", resourcePath, controllerID)

	// 获取控制器实例
	controllerInfo, err := ds.service.ControllerManager().GetController(controllerID)
	if err != nil {
		return nil, fmt.Errorf("控制器不存在: %s", controllerID)
	}

	controller, ok := controllerInfo.Controller.(*maa.Controller)
	if !ok || controller == nil {
		return nil, fmt.Errorf("控制器实例不可用: %s", controllerID)
	}

	// 创建 MaaFW 适配器
	adapter := NewMaaFWAdapter()

	// 设置控制器
	adapter.SetController(controller, controllerInfo.Type, controllerInfo.UUID)

	// 加载资源
	if err := adapter.LoadResource(resourcePath); err != nil {
		adapter.Destroy()
		return nil, fmt.Errorf("加载资源失败: %w", err)
	}

	// 初始化 Tasker
	if err := adapter.InitTasker(); err != nil {
		adapter.Destroy()
		return nil, fmt.Errorf("初始化 Tasker 失败: %w", err)
	}

	// 创建会话
	sessionID := fmt.Sprintf("dbg_%d", time.Now().UnixNano())
	session := &DebugSessionV2{
		SessionID:     sessionID,
		ResourcePath:  resourcePath,
		Status:        SessionStatusIdle,
		CreatedAt:     time.Now(),
		adapter:       adapter,
		eventCallback: eventCallback,
		executedNodes: make(map[string]int),
		breakpoints:   make(map[string]bool),
		nodeStartTime: make(map[string]int64),
	}

	// 创建事件监听器
	session.contextSink = NewSimpleContextSink(func(event DebugEventData) {
		session.handleEvent(event)
	})

	// 设置截图器引用
	session.contextSink.SetScreenshotter(adapter.GetScreenshotter())

	// 注册事件监听器
	session.contextSinkID = adapter.AddContextSink(session.contextSink)
	logger.Debug("DebugV2", "注册 ContextSink: ID=%d", session.contextSinkID)

	// 保存会话
	ds.sessions[sessionID] = session

	logger.Info("DebugV2", "调试会话创建成功: %s", sessionID)
	return session, nil
}

// GetSession 获取调试会话
func (ds *DebugServiceV2) GetSession(sessionID string) *DebugSessionV2 {
	ds.mu.RLock()
	defer ds.mu.RUnlock()
	return ds.sessions[sessionID]
}

// DestroySession 销毁调试会话
func (ds *DebugServiceV2) DestroySession(sessionID string) error {
	ds.mu.Lock()
	defer ds.mu.Unlock()

	session, exists := ds.sessions[sessionID]
	if !exists {
		return fmt.Errorf("会话不存在: %s", sessionID)
	}

	logger.Info("DebugV2", "销毁调试会话: %s", sessionID)

	// 停止任务
	if session.adapter != nil {
		session.adapter.StopTask()
		session.adapter.Destroy()
	}

	// 移除会话
	delete(ds.sessions, sessionID)

	return nil
}

// ListSessions 列出所有会话
func (ds *DebugServiceV2) ListSessions() []*DebugSessionV2 {
	ds.mu.RLock()
	defer ds.mu.RUnlock()

	result := make([]*DebugSessionV2, 0, len(ds.sessions))
	for _, session := range ds.sessions {
		result = append(result, session)
	}
	return result
}

// ============================================================================
// 调试控制
// ============================================================================

// RunTask 运行任务
// entryNode: 入口节点
// breakpoints: 断点列表
// 任务会在遇到断点时自然结束，状态变为 paused
func (s *DebugSessionV2) RunTask(entryNode string, breakpoints []string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.adapter == nil {
		return fmt.Errorf("适配器未初始化")
	}

	logger.Info("DebugV2", "运行任务: Entry=%s, Breakpoints=%v", entryNode, breakpoints)

	// 验证入口节点是否存在于资源中
	if _, exists := s.adapter.GetNodeJSON(entryNode); !exists {
		logger.Error("DebugV2", "入口节点 '%s' 在资源中不存在", entryNode)
		return fmt.Errorf("入口节点 '%s' 在资源中不存在，请检查资源路径和节点名称", entryNode)
	}

	// 更新状态
	s.Status = SessionStatusRunning
	s.EntryNode = entryNode
	s.currentNode = entryNode
	s.pauseReason = ""
	s.lastError = nil

	// 更新断点
	s.breakpoints = make(map[string]bool)
	for _, bp := range breakpoints {
		s.breakpoints[bp] = true
	}

	// 重置事件监听器计数
	s.contextSink.Reset()

	// 构造 override（让断点节点的 next 为空，使任务自然结束）
	override := s.buildBreakpointOverride(breakpoints)

	// 提交任务
	var err error
	if override != nil {
		s.taskJob, err = s.adapter.PostTask(entryNode, override)
	} else {
		s.taskJob, err = s.adapter.PostTask(entryNode)
	}
	if err != nil {
		s.Status = SessionStatusError
		s.lastError = err
		return err
	}

	// 异步等待任务完成
	go s.waitForTask()

	return nil
}

// ContinueFrom 从指定节点继续执行
// 这是分段执行的核心：每次"继续"实际上是提交一个新任务
func (s *DebugSessionV2) ContinueFrom(fromNode string, breakpoints []string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.adapter == nil {
		return fmt.Errorf("适配器未初始化")
	}

	if s.Status != SessionStatusPaused {
		return fmt.Errorf("当前状态不允许继续: %s", s.Status)
	}

	logger.Info("DebugV2", "从节点继续: %s, Breakpoints=%v", fromNode, breakpoints)

	// 更新状态
	s.Status = SessionStatusRunning
	s.currentNode = fromNode
	s.pauseReason = ""
	s.tempBreakpoint = ""

	// 更新断点
	s.breakpoints = make(map[string]bool)
	for _, bp := range breakpoints {
		s.breakpoints[bp] = true
	}

	// 构造 override
	override := s.buildBreakpointOverride(breakpoints)

	// 提交任务
	var err error
	if override != nil {
		s.taskJob, err = s.adapter.PostTask(fromNode, override)
	} else {
		s.taskJob, err = s.adapter.PostTask(fromNode)
	}
	if err != nil {
		s.Status = SessionStatusError
		s.lastError = err
		return err
	}

	// 异步等待任务完成
	go s.waitForTask()

	return nil
}

// StepFrom 单步执行（从指定节点执行到下一个节点）
// nextNodes: 下一个可能的节点列表（作为临时断点）
func (s *DebugSessionV2) StepFrom(fromNode string, nextNodes []string, breakpoints []string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.adapter == nil {
		return fmt.Errorf("适配器未初始化")
	}

	if s.Status != SessionStatusPaused {
		return fmt.Errorf("当前状态不允许单步执行: %s", s.Status)
	}

	logger.Info("DebugV2", "单步执行: From=%s, NextNodes=%v", fromNode, nextNodes)

	// 更新状态
	s.Status = SessionStatusRunning
	s.currentNode = fromNode
	s.pauseReason = ""

	// 合并断点和下一个节点作为停止点
	allStopPoints := append([]string{}, breakpoints...)
	allStopPoints = append(allStopPoints, nextNodes...)

	// 更新断点（包含临时断点）
	s.breakpoints = make(map[string]bool)
	for _, bp := range breakpoints {
		s.breakpoints[bp] = true
	}

	// 记录临时断点
	if len(nextNodes) > 0 {
		s.tempBreakpoint = nextNodes[0]
	}

	// 构造 override
	override := s.buildBreakpointOverride(allStopPoints)

	// 提交任务
	var err error
	if override != nil {
		s.taskJob, err = s.adapter.PostTask(fromNode, override)
	} else {
		s.taskJob, err = s.adapter.PostTask(fromNode)
	}
	if err != nil {
		s.Status = SessionStatusError
		s.lastError = err
		return err
	}

	// 异步等待任务完成
	go s.waitForTask()

	return nil
}

// Stop 停止调试
func (s *DebugSessionV2) Stop() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	logger.Info("DebugV2", "停止调试: %s", s.SessionID)

	if s.adapter != nil {
		s.adapter.StopTask()
	}

	s.Status = SessionStatusIdle
	s.currentNode = ""
	s.pauseReason = "用户停止"

	return nil
}

// ============================================================================
// 断点管理
// ============================================================================

// SetBreakpoints 设置断点
func (s *DebugSessionV2) SetBreakpoints(breakpoints []string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.breakpoints = make(map[string]bool)
	for _, bp := range breakpoints {
		s.breakpoints[bp] = true
	}

	logger.Debug("DebugV2", "设置断点: %v", breakpoints)
}

// AddBreakpoint 添加断点
func (s *DebugSessionV2) AddBreakpoint(nodeName string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.breakpoints[nodeName] = true
	logger.Debug("DebugV2", "添加断点: %s", nodeName)
}

// RemoveBreakpoint 移除断点
func (s *DebugSessionV2) RemoveBreakpoint(nodeName string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	delete(s.breakpoints, nodeName)
	logger.Debug("DebugV2", "移除断点: %s", nodeName)
}

// GetBreakpoints 获取断点列表
func (s *DebugSessionV2) GetBreakpoints() []string {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]string, 0, len(s.breakpoints))
	for bp := range s.breakpoints {
		result = append(result, bp)
	}
	return result
}

// ============================================================================
// 状态查询
// ============================================================================

// GetStatus 获取会话状态
func (s *DebugSessionV2) GetStatus() DebugSessionStatus {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.Status
}

// GetCurrentNode 获取当前节点
func (s *DebugSessionV2) GetCurrentNode() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.currentNode
}

// GetLastNode 获取上一个节点
func (s *DebugSessionV2) GetLastNode() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.lastNode
}

// GetPauseReason 获取暂停原因
func (s *DebugSessionV2) GetPauseReason() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.pauseReason
}

// GetLastError 获取最后一个错误
func (s *DebugSessionV2) GetLastError() error {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.lastError
}

// GetExecutedNodes 获取已执行节点
func (s *DebugSessionV2) GetExecutedNodes() map[string]int {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make(map[string]int)
	for k, v := range s.executedNodes {
		result[k] = v
	}
	return result
}

// GetAdapter 获取适配器（用于截图等操作）
func (s *DebugSessionV2) GetAdapter() *MaaFWAdapter {
	return s.adapter
}

// GetNodeJSON 获取节点 JSON 数据
func (s *DebugSessionV2) GetNodeJSON(nodeName string) (map[string]interface{}, bool) {
	if s.adapter == nil {
		return nil, false
	}

	jsonStr, ok := s.adapter.GetNodeJSON(nodeName)
	if !ok {
		return nil, false
	}

	var result map[string]interface{}
	if err := json.Unmarshal([]byte(jsonStr), &result); err != nil {
		return nil, false
	}

	return result, true
}

// ============================================================================
// 内部方法
// ============================================================================

// buildBreakpointOverride 构造断点 override
// 将断点节点的 next 和 on_error 设置为空，使任务在断点处自然结束
func (s *DebugSessionV2) buildBreakpointOverride(breakpoints []string) map[string]interface{} {
	if len(breakpoints) == 0 {
		return nil
	}

	override := make(map[string]interface{})
	for _, bp := range breakpoints {
		override[bp] = map[string]interface{}{
			"next":     []string{},
			"on_error": []string{},
		}
	}

	logger.Debug("DebugV2", "构造断点 override: %v", override)
	return override
}

// waitForTask 等待任务完成
func (s *DebugSessionV2) waitForTask() {
	if s.taskJob == nil {
		return
	}

	logger.Debug("DebugV2", "等待任务完成...")
	s.taskJob.Wait()

	s.mu.Lock()
	defer s.mu.Unlock()

	// 检查任务状态
	status := s.taskJob.Status()
	logger.Info("DebugV2", "任务完成: Status=%v", status)

	if status.Success() {
		// 任务成功完成（可能是到达断点或自然结束）
		if s.lastNode != "" && (s.breakpoints[s.lastNode] || s.tempBreakpoint == s.lastNode) {
			// 到达断点
			s.Status = SessionStatusPaused
			s.currentNode = s.lastNode
			s.pauseReason = fmt.Sprintf("断点: %s", s.lastNode)
			logger.Info("DebugV2", "到达断点: %s", s.lastNode)

			// 发送暂停事件
			if s.eventCallback != nil {
				s.eventCallback(DebugEventData{
					Type:      "debug_paused",
					Timestamp: time.Now().Unix(),
					NodeName:  s.lastNode,
					Detail: map[string]interface{}{
						"reason": s.pauseReason,
					},
				})
			}
		} else {
			// 任务自然完成
			s.Status = SessionStatusCompleted
			logger.Info("DebugV2", "任务自然完成")

			// 发送完成事件
			if s.eventCallback != nil {
				s.eventCallback(DebugEventData{
					Type:      "debug_completed",
					Timestamp: time.Now().Unix(),
				})
			}
		}
	} else {
		// 任务失败或被停止
		s.Status = SessionStatusError
		logger.Warn("DebugV2", "任务失败或被停止")

		// 发送错误事件
		if s.eventCallback != nil {
			s.eventCallback(DebugEventData{
				Type:      "debug_error",
				Timestamp: time.Now().Unix(),
				Detail: map[string]interface{}{
					"status": status.String(),
				},
			})
		}
	}
}

// handleEvent 处理事件回调
func (s *DebugSessionV2) handleEvent(event DebugEventData) {
	s.mu.Lock()

	// 记录节点执行
	if event.NodeName != "" {
		switch event.Type {
		case EventNodeStarting:
			s.currentNode = event.NodeName
			s.nodeStartTime[event.NodeName] = time.Now().UnixMilli()
			logger.Debug("DebugV2", "节点开始: %s", event.NodeName)

		case EventNodeSucceeded, EventNodeFailed:
			s.lastNode = event.NodeName
			s.executedNodes[event.NodeName]++

			// 计算耗时
			if startTime, ok := s.nodeStartTime[event.NodeName]; ok {
				event.Latency = time.Now().UnixMilli() - startTime
			}

			logger.Debug("DebugV2", "节点完成: %s (第%d次)", event.NodeName, s.executedNodes[event.NodeName])
		}
	}

	s.mu.Unlock()

	// 转发事件
	if s.eventCallback != nil {
		s.eventCallback(event)
	}
}
