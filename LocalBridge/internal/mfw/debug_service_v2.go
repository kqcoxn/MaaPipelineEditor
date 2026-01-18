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
	SessionStatusPaused    DebugSessionStatus = "paused"    // 已暂停
	SessionStatusCompleted DebugSessionStatus = "completed" // 已完成
	SessionStatusError     DebugSessionStatus = "error"     // 错误
)

// DebugSessionV2 调试会话
type DebugSessionV2 struct {
	// 基本信息
	SessionID     string             `json:"session_id"`
	ResourcePaths []string           `json:"resource_paths"` // 支持多资源路径
	EntryNode     string             `json:"entry_node"`
	Status        DebugSessionStatus `json:"status"`
	CreatedAt     time.Time          `json:"created_at"`
	AgentID       string             `json:"agent_id,omitempty"` // Agent 标识符

	// MaaFW 组件
	adapter *MaaFWAdapter

	// 事件回调
	eventCallback DebugEventCallback
	contextSink   *SimpleContextSink
	contextSinkID int64

	// 执行状态
	currentNode   string           // 当前节点
	lastNode      string           // 上一个执行的节点
	executedNodes map[string]int   // 已执行节点计数
	taskJob       *maa.TaskJob     // 当前任务
	taskRunID     int64            // 任务运行 ID
	pauseReason   string           // 暂停原因
	lastError     error            // 最后一个错误
	nodeStartTime map[string]int64 // 节点开始时间

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

// CreateSessionOptions 创建会话的选项
type CreateSessionOptions struct {
	ResourcePaths   []string           // 资源路径列表（后面的覆盖前面的）
	ControllerID    string             // 控制器 ID
	AgentIdentifier string             // Agent 标识符（可选）
	EventCallback   DebugEventCallback // 事件回调
}

// CreateSession 创建调试会话
func (ds *DebugServiceV2) CreateSession(resourcePath, controllerID string, eventCallback DebugEventCallback) (*DebugSessionV2, error) {
	return ds.CreateSessionWithOptions(CreateSessionOptions{
		ResourcePaths:   []string{resourcePath},
		ControllerID:    controllerID,
		AgentIdentifier: "",
		EventCallback:   eventCallback,
	})
}

// CreateSessionWithOptions 创建调试会话
func (ds *DebugServiceV2) CreateSessionWithOptions(opts CreateSessionOptions) (*DebugSessionV2, error) {
	ds.mu.Lock()
	defer ds.mu.Unlock()

	logger.Debug("DebugV2", "创建调试会话: 资源=%v, 控制器=%s, Agent=%s", opts.ResourcePaths, opts.ControllerID, opts.AgentIdentifier)

	// 获取控制器实例
	controllerInfo, err := ds.service.ControllerManager().GetController(opts.ControllerID)
	if err != nil {
		return nil, fmt.Errorf("控制器不存在: %s", opts.ControllerID)
	}

	controller, ok := controllerInfo.Controller.(*maa.Controller)
	if !ok || controller == nil {
		return nil, fmt.Errorf("控制器实例不可用: %s", opts.ControllerID)
	}

	// 创建 MaaFW 适配器
	adapter := NewMaaFWAdapter()

	// 设置控制器
	adapter.SetController(controller, controllerInfo.Type, controllerInfo.UUID)

	// 加载资源
	if err := adapter.LoadResources(opts.ResourcePaths); err != nil {
		adapter.Destroy()
		return nil, fmt.Errorf("加载资源失败: %w", err)
	}

	// 初始化 Tasker
	if err := adapter.InitTasker(); err != nil {
		adapter.Destroy()
		return nil, fmt.Errorf("初始化 Tasker 失败: %w", err)
	}

	// 连接 Agent (必须在 Tasker 初始化之后)
	if opts.AgentIdentifier != "" {
		if err := adapter.ConnectAgent(opts.AgentIdentifier); err != nil {
			logger.Warn("DebugV2", "Agent 连接失败: %v", err)
		}
	}

	// 创建会话
	sessionID := fmt.Sprintf("dbg_%d", time.Now().UnixNano())
	session := &DebugSessionV2{
		SessionID:     sessionID,
		ResourcePaths: opts.ResourcePaths,
		AgentID:       opts.AgentIdentifier,
		Status:        SessionStatusIdle,
		CreatedAt:     time.Now(),
		adapter:       adapter,
		eventCallback: opts.EventCallback,
		executedNodes: make(map[string]int),
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

	logger.Debug("DebugV2", "调试会话创建成功: %s", sessionID)
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

	logger.Debug("DebugV2", "销毁调试会话: %s", sessionID)

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
func (s *DebugSessionV2) RunTask(entryNode string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.adapter == nil {
		return fmt.Errorf("适配器未初始化")
	}

	logger.Info("DebugV2", "运行任务: Entry=%s", entryNode)

	// 验证入口节点是否存在于资源中
	if _, exists := s.adapter.GetNodeJSON(entryNode); !exists {
		logger.Error("DebugV2", "入口节点 '%s' 在资源中不存在", entryNode)
		return fmt.Errorf("入口节点 '%s' 在资源中不存在，请检查资源路径和节点名称", entryNode)
	}

	// 连接 Agent
	if s.AgentID != "" {
		logger.Debug("DebugV2", "连接 Agent: %s", s.AgentID)
		if err := s.adapter.ConnectAgent(s.AgentID); err != nil {
			logger.Warn("DebugV2", "连接 Agent 失败: %v", err)
		}
	}

	// 生成任务运行 ID
	s.taskRunID = time.Now().UnixNano()
	currentRunID := s.taskRunID

	// 更新状态
	s.Status = SessionStatusRunning
	s.EntryNode = entryNode
	s.currentNode = entryNode
	s.pauseReason = ""
	s.lastError = nil

	// 重置事件监听器计数
	s.contextSink.Reset()

	// 提交任务
	var err error
	s.taskJob, err = s.adapter.PostTask(entryNode)
	if err != nil {
		s.Status = SessionStatusError
		s.lastError = err
		return err
	}

	// 异步等待任务完成
	go s.waitForTask(currentRunID)

	return nil
}

// Stop 停止调试
func (s *DebugSessionV2) Stop() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	logger.Info("DebugV2", "停止调试: %s", s.SessionID)
	s.taskRunID = 0

	if s.adapter != nil {
		s.adapter.PostStop()
		// 断开 Agent
		logger.Debug("DebugV2", "停止时断开 Agent 连接...")
		s.adapter.DisconnectAgent()
	}

	s.Status = SessionStatusIdle
	s.currentNode = ""
	s.pauseReason = "用户停止"

	return nil
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

// waitForTask 等待任务完成
func (s *DebugSessionV2) waitForTask(runID int64) {
	if s.taskJob == nil {
		return
	}

	logger.Debug("DebugV2", "等待任务完成... (runID=%d)", runID)
	s.taskJob.Wait()

	s.mu.Lock()
	defer s.mu.Unlock()

	// 检查运行 ID 是否匹配
	if s.taskRunID != runID {
		logger.Debug("DebugV2", "任务运行 ID 不匹配 (当前=%d, 期望=%d)，忽略此回调", s.taskRunID, runID)
		return
	}

	// 检查任务状态
	status := s.taskJob.Status()
	logger.Info("DebugV2", "任务完成: Status=%v", status)

	// 释放资源
	if s.adapter != nil {
		logger.Debug("DebugV2", "断开 Agent 连接...")
		s.adapter.DisconnectAgent()
	}

	if status.Success() {
		// 任务成功完成
		s.Status = SessionStatusCompleted
		logger.Info("DebugV2", "任务自然完成")

		// 发送完成事件
		if s.eventCallback != nil {
			s.eventCallback(DebugEventData{
				Type:      "debug_completed",
				Timestamp: time.Now().Unix(),
			})
		}
	} else {
		// 任务失败或被停止
		if s.Status == SessionStatusRunning {
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
