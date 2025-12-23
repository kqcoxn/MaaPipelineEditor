package mfw

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image/png"
	"sync"
	"time"

	maa "github.com/MaaXYZ/maa-framework-go/v3"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
)

// 调试会话
type DebugSession struct {
	TaskID        string
	ResourcePath  string
	EntryNode     string
	ControllerID  string
	Tasker        *maa.Tasker
	Resource      *maa.Resource
	Controller    *maa.Controller
	StartTime     time.Time
	Status        string // "running" | "stopped" | "completed"
	EventHandler  DebugEventHandler
	RunIndex      int                  // 任务执行次数计数器
	NodeStartMap  map[string]time.Time // 节点开始时间记录
	NodeCountMap  map[string]int       // 节点执行次数计数(整个识别-执行周期)
	RecoCountMap  map[string]int       // 节点识别次数计数(每次识别尝试)
	done          chan struct{}        // 用于通知 goroutine 退出
	stopRequested bool                 // 标记是否已请求停止
	mu            sync.RWMutex
}

// 调试事件处理器接口
type DebugEventHandler interface {
	OnDebugEvent(event DebugEvent)
}

// 调试事件
type DebugEvent struct {
	Type      string                 `json:"type"`
	EventName string                 `json:"event_name,omitempty"`
	TaskID    string                 `json:"task_id"`
	NodeID    string                 `json:"node_id,omitempty"`
	Timestamp int64                  `json:"timestamp"`
	Detail    map[string]interface{} `json:"detail,omitempty"`
}

// 调试服务
type DebugService struct {
	service  *Service
	sessions map[string]*DebugSession
	mu       sync.RWMutex
}

// 创建调试服务
func NewDebugService(service *Service) *DebugService {
	return &DebugService{
		service:  service,
		sessions: make(map[string]*DebugSession),
	}
}

// 启动调试
func (ds *DebugService) StartDebug(resourcePath, entryNode, controllerID string, override map[string]interface{}, handler DebugEventHandler) (string, error) {
	ds.mu.Lock()
	defer ds.mu.Unlock()

	logger.Info("Debug", "启动调试: 资源=%s, 入口=%s, 控制器=%s", resourcePath, entryNode, controllerID)

	// 获取控制器实例
	controllerInfo, err := ds.service.ControllerManager().GetController(controllerID)
	if err != nil {
		logger.Error("Debug", "控制器不存在: %s", controllerID)
		return "", fmt.Errorf("控制器不存在: %s", controllerID)
	}

	controller, ok := controllerInfo.Controller.(*maa.Controller)
	if !ok || controller == nil {
		logger.Error("Debug", "控制器实例不可用: %s", controllerID)
		return "", fmt.Errorf("控制器实例不可用: %s", controllerID)
	}

	// 加载资源
	resourceID, _, err := ds.service.ResourceManager().LoadResource(resourcePath)
	if err != nil {
		logger.Error("Debug", "加载资源失败: %v", err)
		return "", fmt.Errorf("加载资源失败: %w", err)
	}

	// 获取资源实例
	resourceInfo, err := ds.service.ResourceManager().GetResource(resourceID)
	if err != nil {
		logger.Error("Debug", "资源不存在: %s, %v", resourceID, err)
		return "", fmt.Errorf("资源不存在: %s, %w", resourceID, err)
	}

	resource, ok := resourceInfo.Resource.(*maa.Resource)
	if !ok || resource == nil {
		logger.Error("Debug", "资源实例不可用: %s", resourceID)
		return "", fmt.Errorf("资源实例不可用: %s", resourceID)
	}

	// 启用全局调试模式
	if !maa.SetDebugMode(true) {
		logger.Warn("Debug", "启用调试模式失败,但继续执行")
	}
	logger.Info("Debug", "已启用全局调试模式")

	// 创建 Tasker
	tasker := maa.NewTasker()
	if tasker == nil {
		logger.Error("Debug", "创建 Tasker 失败")
		return "", fmt.Errorf("创建 Tasker 失败")
	}

	// 绑定资源和控制器
	if !tasker.BindResource(resource) {
		logger.Error("Debug", "绑定资源失败")
		tasker.Destroy()
		return "", fmt.Errorf("绑定资源失败")
	}

	if !tasker.BindController(controller) {
		logger.Error("Debug", "绑定控制器失败")
		tasker.Destroy()
		return "", fmt.Errorf("绑定控制器失败")
	}

	// 创建调试会话
	session := &DebugSession{
		TaskID:       fmt.Sprintf("debug_%d", time.Now().UnixNano()),
		ResourcePath: resourcePath,
		EntryNode:    entryNode,
		ControllerID: controllerID,
		Tasker:       tasker,
		Resource:     resource,
		Controller:   controller,
		StartTime:    time.Now(),
		Status:       "running",
		EventHandler: handler,
		NodeStartMap: make(map[string]time.Time),
		NodeCountMap: make(map[string]int),
		RecoCountMap: make(map[string]int),
		done:         make(chan struct{}),
	}

	// 注册 ContextEventSink
	sink := &debugContextSink{
		session: session,
		handler: handler,
	}
	logger.Info("Debug", "注册 ContextEventSink")
	sinkID := tasker.AddContextSink(sink)
	logger.Info("Debug", "ContextEventSink 注册完成, SinkID=%d", sinkID)

	// 提交任务
	logger.Info("Debug", "准备提交任务: Entry=%s, HasOverride=%v", entryNode, override != nil && len(override) > 0)
	var taskJob *maa.TaskJob
	if override != nil && len(override) > 0 {
		logger.Debug("Debug", "使用 override 提交任务, 节点数=%d", len(override))
		taskJob = tasker.PostTask(entryNode, override)
	} else {
		logger.Debug("Debug", "直接提交任务(无 override)")
		taskJob = tasker.PostTask(entryNode)
	}

	if taskJob == nil {
		logger.Error("Debug", "提交任务失败: TaskJob 为 nil")
		tasker.Destroy()
		return "", fmt.Errorf("提交任务失败")
	}

	logger.Info("Debug", "任务已成功提交, SessionID=%s, Entry=%s", session.TaskID, entryNode)

	// 保存会话
	ds.sessions[session.TaskID] = session

	// 异步等待任务完成
	go func() {
		defer close(session.done)

		logger.Debug("Debug", "[异步] 开始等待任务完成: %s", session.TaskID)
		startWaitTime := time.Now()
		taskJob.Wait()
		elapsed := time.Since(startWaitTime)
		logger.Info("Debug", "任务执行完成: %s, 总耗时: %v", session.TaskID, elapsed)

		// 检查会话是否已被停止
		session.mu.Lock()
		isStopped := session.stopRequested
		if !isStopped {
			// 任务自然完成,更新状态
			session.Status = "completed"
		}
		session.mu.Unlock()

		if isStopped {
			logger.Info("Debug", "调试已被停止,跳过完成事件发送: %s", session.TaskID)
			return
		}

		// 发送完成事件
		if handler != nil {
			logger.Debug("Debug", "发送调试完成事件")
			handler.OnDebugEvent(DebugEvent{
				Type:      "debug_completed",
				TaskID:    session.TaskID,
				Timestamp: time.Now().Unix(),
			})
		} else {
			logger.Warn("Debug", "EventHandler 为空,无法发送完成事件")
		}

		logger.Debug("Debug", "会话状态已更新为 completed")
	}()

	return session.TaskID, nil
}

// 停止调试
func (ds *DebugService) StopDebug(taskID string) error {
	logger.Info("Debug", "停止调试: %s", taskID)

	// 获取会话
	ds.mu.Lock()
	session, exists := ds.sessions[taskID]
	ds.mu.Unlock()

	if !exists {
		logger.Warn("Debug", "调试会话不存在: %s", taskID)
		return fmt.Errorf("调试会话不存在: %s", taskID)
	}

	// 设置停止标记
	session.mu.Lock()
	session.stopRequested = true
	isRunning := session.Status == "running"
	session.mu.Unlock()

	// 如果任务正在运行，调用 PostStop
	if session.Tasker != nil && isRunning {
		logger.Debug("Debug", "任务正在运行,发送 PostStop 信号")
		stopJob := session.Tasker.PostStop()

		// 使用超时等待 PostStop
		if stopJob != nil {
			logger.Debug("Debug", "等待 PostStop 完成 (最多2秒)")
			done := make(chan struct{})
			go func() {
				stopJob.Wait()
				close(done)
			}()

			select {
			case <-done:
				logger.Debug("Debug", "PostStop 已完成")
			case <-time.After(2 * time.Second):
				logger.Warn("Debug", "PostStop 等待超时,继续清理")
			}
		}
	}

	// 等待 goroutine 退出
	logger.Debug("Debug", "等待 goroutine 退出")
	select {
	case <-session.done:
		logger.Debug("Debug", "goroutine 已退出")
	case <-time.After(1 * time.Second):
		logger.Warn("Debug", "goroutine 退出超时,强制继续")
	}

	// 清理资源
	session.mu.Lock()
	session.Status = "stopped"
	if session.Tasker != nil {
		logger.Debug("Debug", "销毁 Tasker")
		session.Tasker.Destroy()
		session.Tasker = nil
	}
	session.mu.Unlock()

	// 移除会话
	ds.mu.Lock()
	delete(ds.sessions, taskID)
	ds.mu.Unlock()

	logger.Info("Debug", "调试已停止: %s", taskID)
	return nil
}

// 获取调试会话
func (ds *DebugService) GetSession(taskID string) *DebugSession {
	ds.mu.RLock()
	defer ds.mu.RUnlock()
	return ds.sessions[taskID]
}

// 继续调试
func (ds *DebugService) ContinueDebug(taskID string, entryNode string, override map[string]interface{}) error {
	ds.mu.Lock()
	defer ds.mu.Unlock()

	logger.Info("Debug", "========== 继续调试执行: %s ==========", taskID)
	logger.Info("Debug", "从节点继续: %s", entryNode)

	session, exists := ds.sessions[taskID]
	if !exists {
		logger.Error("Debug", "调试会话不存在: %s", taskID)
		return fmt.Errorf("调试会话不存在: %s", taskID)
	}

	session.mu.Lock()
	defer session.mu.Unlock()

	if session.Tasker == nil {
		logger.Error("Debug", "Tasker实例不存在")
		return fmt.Errorf("Tasker实例不存在")
	}

	// 提交新任务
	logger.Debug("Debug", "[继续执行] 正在提交新任务...")
	var taskJob *maa.TaskJob
	if override != nil && len(override) > 0 {
		logger.Info("Debug", "[继续执行] 使用 override 提交任务")
		logger.Debug("Debug", "Override 节点数: %d", len(override))
		for key := range override {
			logger.Debug("Debug", "Override 包含节点: %s", key)
		}
		taskJob = session.Tasker.PostTask(entryNode, override)
	} else {
		logger.Info("Debug", "[继续执行] 直接提交任务(无 override)")
		taskJob = session.Tasker.PostTask(entryNode)
	}

	if taskJob == nil {
		logger.Error("Debug", "[继续执行失败] 提交任务失败, TaskJob 为空")
		return fmt.Errorf("提交任务失败")
	}

	logger.Info("Debug", "[继续执行成功] 任务已提交")

	// 更新会话状态
	session.Status = "running"

	// 异步等待任务完成
	go func() {
		logger.Debug("Debug", "[异步] 开始等待继续任务完成: %s", taskID)
		startWaitTime := time.Now()
		taskJob.Wait()
		elapsed := time.Since(startWaitTime)
		logger.Info("Debug", "[异步] 继续任务执行完成: %s, 耗时: %v", taskID, elapsed)

		// 检查会话是否已被停止
		session.mu.Lock()
		isStopped := session.stopRequested
		if !isStopped {
			// 任务自然完成时更新状态
			session.Status = "completed"
		}
		session.mu.Unlock()

		if isStopped {
			logger.Info("Debug", "调试已被停止,跳过完成事件发送: %s", taskID)
			return
		}

		// 发送完成事件
		if session.EventHandler != nil {
			session.EventHandler.OnDebugEvent(DebugEvent{
				Type:      "debug_completed",
				TaskID:    taskID,
				Timestamp: time.Now().Unix(),
			})
		}
	}()

	logger.Info("Debug", "========== 继续执行已启动: %s ==========", taskID)
	return nil
}

// 停止所有调试会话
func (ds *DebugService) StopAll() {
	ds.mu.Lock()
	defer ds.mu.Unlock()

	logger.Info("Debug", "停止所有调试会话")

	for taskID := range ds.sessions {
		session := ds.sessions[taskID]
		session.mu.Lock()

		if session.Tasker != nil && session.Status == "running" {
			stopJob := session.Tasker.PostStop()
			if stopJob != nil {
				stopJob.Wait()
			}
			session.Tasker.Destroy()
			session.Tasker = nil
		}

		session.Status = "stopped"
		session.mu.Unlock()
	}

	ds.sessions = make(map[string]*DebugSession)
}

// 调试事件接收器
type debugContextSink struct {
	session *DebugSession
	handler DebugEventHandler
}

// ContextEventSink 接口
func (s *debugContextSink) OnNodeRecognitionNode(ctx *maa.Context, status maa.EventStatus, msg maa.NodeRecognitionNodeDetail) {
	logger.Debug("Debug", "OnNodeRecognitionNode: NodeName=%s, Status=%v (接口必需方法,但不处理)", msg.Name, status)
}

func (s *debugContextSink) OnNodeActionNode(ctx *maa.Context, status maa.EventStatus, msg maa.NodeActionNodeDetail) {
	logger.Debug("Debug", "动作节点事件: NodeName=%s, NodeID=%d, Status=%v", msg.Name, msg.NodeID, status)
}

func (s *debugContextSink) OnNodePipelineNode(ctx *maa.Context, status maa.EventStatus, msg maa.NodePipelineNodeDetail) {
	if s.handler == nil {
		logger.Error("Debug", "handler 为空,无法发送事件")
		return
	}

	// 根据状态发送不同事件
	switch status {
	case maa.EventStatusStarting:
		// 记录节点开始时间
		s.session.mu.Lock()
		s.session.NodeStartMap[msg.Name] = time.Now()
		s.session.mu.Unlock()

		// 发送 node_running 事件
		event := DebugEvent{
			Type:      "debug_event",
			EventName: "node_running",
			TaskID:    s.session.TaskID,
			NodeID:    msg.Name,
			Timestamp: time.Now().Unix(),
			Detail: map[string]interface{}{
				"node_name": msg.Name,
				"node_id":   msg.NodeID,
				"task_id":   msg.TaskID,
				"status":    status,
			},
		}
		s.handler.OnDebugEvent(event)

	case maa.EventStatusSucceeded, maa.EventStatusFailed:
		// 获取当前识别次数
		s.session.mu.RLock()
		recoIndex := s.session.RecoCountMap[msg.Name]
		if recoIndex == 0 {
			recoIndex = 1
		}
		s.session.mu.RUnlock()

		// 计算执行耗时
		var latency int64 = 0
		s.session.mu.RLock()
		if startTime, ok := s.session.NodeStartMap[msg.Name]; ok {
			latency = time.Since(startTime).Milliseconds()
		}
		s.session.mu.RUnlock()

		// 获取节点调试数据
		var nodeData map[string]interface{}
		if s.session.Resource != nil {
			nodeJSON, ok := s.session.Resource.GetNodeJSON(msg.Name)
			if ok && nodeJSON != "" {
				if err := json.Unmarshal([]byte(nodeJSON), &nodeData); err != nil {
					logger.Warn("Debug", "解析节点数据失败: %v", err)
				}
			}
		}

		// 发送节点执行完成事件
		eventName := "node_execution_completed"
		resultStr := "成功"
		if status == maa.EventStatusFailed {
			eventName = "node_execution_failed"
			resultStr = "失败"
		}

		// 只输出简单的调试信息
		logger.Info("Debug", "节点 [%s] 执行周期%s (第%d次识别, 耗时%dms)", msg.Name, resultStr, recoIndex, latency)

		event := DebugEvent{
			Type:      "debug_event",
			EventName: eventName,
			TaskID:    s.session.TaskID,
			NodeID:    msg.Name,
			Timestamp: time.Now().Unix(),
			Detail: map[string]interface{}{
				"node_name": msg.Name,
				"node_id":   msg.NodeID,
				"task_id":   msg.TaskID,
				"status":    status,
				"node_data": nodeData,
				"run_index": recoIndex,
				"latency":   latency,
			},
		}
		s.handler.OnDebugEvent(event)
	}
}

func (s *debugContextSink) OnNodeNextList(ctx *maa.Context, status maa.EventStatus, msg maa.NodeNextListDetail) {
	logger.Debug("Debug", "下一跳列表事件: NodeName=%s, Status=%v", msg.Name, status)
}

func (s *debugContextSink) OnNodeRecognition(ctx *maa.Context, status maa.EventStatus, msg maa.NodeRecognitionDetail) {
	if s.handler == nil {
		logger.Error("Debug", "handler 为空,无法发送识别事件")
		return
	}

	switch status {
	case maa.EventStatusStarting:
		logger.Debug("Debug", "识别开始: NodeName=%s, RecoID=%d", msg.Name, msg.RecognitionID)
		event := DebugEvent{
			Type:      "debug_event",
			EventName: "recognition_starting",
			TaskID:    s.session.TaskID,
			NodeID:    msg.Name,
			Timestamp: time.Now().Unix(),
			Detail: map[string]interface{}{
				"reco_id": msg.RecognitionID,
				"task_id": msg.TaskID,
				"name":    msg.Name,
			},
		}
		logger.Info("Debug", "发送调试事件: recognition_starting, 节点=%s", msg.Name)
		s.handler.OnDebugEvent(event)

	case maa.EventStatusSucceeded:
		// 识别成功
		s.session.mu.Lock()
		s.session.RecoCountMap[msg.Name]++
		recoIndex := s.session.RecoCountMap[msg.Name]
		s.session.mu.Unlock()

		logger.Info("Debug", "识别成功: 节点=%s, RecoID=%d, 第%d次尝试", msg.Name, msg.RecognitionID, recoIndex)

		// 获取识别的详细数据
		recognitionDetail := map[string]interface{}{
			"reco_id":   msg.RecognitionID,
			"task_id":   msg.TaskID,
			"name":      msg.Name,
			"box":       nil,
			"detail":    nil,
			"hit":       true,
			"run_index": recoIndex,
		}

		event := DebugEvent{
			Type:      "debug_event",
			EventName: "recognition_success",
			TaskID:    s.session.TaskID,
			NodeID:    msg.Name,
			Timestamp: time.Now().Unix(),
			Detail:    recognitionDetail,
		}
		s.handler.OnDebugEvent(event)

	case maa.EventStatusFailed:
		// 识别失败
		s.session.mu.Lock()
		s.session.RecoCountMap[msg.Name]++
		recoIndex := s.session.RecoCountMap[msg.Name]
		s.session.mu.Unlock()

		logger.Info("Debug", "识别失败: 节点=%s, RecoID=%d, 第%d次尝试", msg.Name, msg.RecognitionID, recoIndex)

		event := DebugEvent{
			Type:      "debug_event",
			EventName: "recognition_failed",
			TaskID:    s.session.TaskID,
			NodeID:    msg.Name,
			Timestamp: time.Now().Unix(),
			Detail: map[string]interface{}{
				"reco_id":   msg.RecognitionID,
				"task_id":   msg.TaskID,
				"name":      msg.Name,
				"hit":       false,
				"run_index": recoIndex,
			},
		}
		s.handler.OnDebugEvent(event)
	}
}

func (s *debugContextSink) OnNodeAction(ctx *maa.Context, status maa.EventStatus, msg maa.NodeActionDetail) {
	if s.handler == nil {
		logger.Error("Debug", "handler 为空,无法发送动作事件")
		return
	}

	// 获取当前识别次数
	s.session.mu.RLock()
	recoIndex := s.session.RecoCountMap[msg.Name]
	if recoIndex == 0 {
		recoIndex = 1
	}
	s.session.mu.RUnlock()

	switch status {
	case maa.EventStatusStarting:
		logger.Debug("Debug", "动作开始: NodeName=%s, ActionID=%d", msg.Name, msg.ActionID)

	case maa.EventStatusSucceeded:
		logger.Info("Debug", "动作成功: 节点=%s, ActionID=%d, 对应识别次数=%d", msg.Name, msg.ActionID, recoIndex)

		event := DebugEvent{
			Type:      "debug_event",
			EventName: "action_success",
			TaskID:    s.session.TaskID,
			NodeID:    msg.Name,
			Timestamp: time.Now().Unix(),
			Detail: map[string]interface{}{
				"action_id": msg.ActionID,
				"task_id":   msg.TaskID,
				"name":      msg.Name,
				"run_index": recoIndex,
			},
		}
		s.handler.OnDebugEvent(event)

	case maa.EventStatusFailed:
		// 动作失败
		logger.Info("Debug", "动作失败: 节点=%s, ActionID=%d, 对应识别次数=%d", msg.Name, msg.ActionID, recoIndex)

		event := DebugEvent{
			Type:      "debug_event",
			EventName: "action_failed",
			TaskID:    s.session.TaskID,
			NodeID:    msg.Name,
			Timestamp: time.Now().Unix(),
			Detail: map[string]interface{}{
				"action_id": msg.ActionID,
				"task_id":   msg.TaskID,
				"name":      msg.Name,
				"run_index": recoIndex,
			},
		}
		s.handler.OnDebugEvent(event)
	}
}

// 旧版本 debugEventSink
type debugEventSink struct {
	session *DebugSession
	handler DebugEventHandler
}

// TaskerEventSink 接口
func (s *debugEventSink) OnTaskerTask(tasker *maa.Tasker, status maa.EventStatus, detail maa.TaskerTaskDetail) {
	logger.Info("Debug", "========== OnTaskerTask 被调用 ========== ID=%d, Entry=%s, Status=%v", detail.TaskID, detail.Entry, status)
	logger.Debug("Debug", "TaskerTask 详情: TaskID=%d, Entry=%s, Hash=%s", detail.TaskID, detail.Entry, detail.Hash)
	logger.Debug("Debug", "等待节点级事件 (OnTaskRecognition/OnNodePipelineNode 等) ...")
}

func (s *debugEventSink) OnTaskRecognition(tasker *maa.Tasker, status maa.EventStatus, msg maa.NodeRecognitionDetail) {
	logger.Info("Debug", "===== OnTaskRecognition 被调用 ===== NodeName=%s, RecoID=%d, Status=%v", msg.Name, msg.RecognitionID, status)

	if s.handler == nil {
		logger.Warn("Debug", "handler 为空，无法发送事件")
		return
	}

	switch status {
	case maa.EventStatusStarting:
		// 记录节点开始时间
		s.session.mu.Lock()
		s.session.NodeStartMap[msg.Name] = time.Now()
		s.session.mu.Unlock()

		// 发送 node_running 事件
		event := DebugEvent{
			Type:      "debug_event",
			EventName: "node_running",
			TaskID:    s.session.TaskID,
			NodeID:    msg.Name,
			Timestamp: time.Now().Unix(),
			Detail: map[string]interface{}{
				"node_name": msg.Name,
				"reco_id":   msg.RecognitionID,
				"task_id":   msg.TaskID,
				"status":    status,
			},
		}
		logger.Info("Debug", "发送调试事件: node_running, 节点=%s", msg.Name)
		s.handler.OnDebugEvent(event)

	case maa.EventStatusSucceeded:
		// 递增节点执行次数
		s.session.mu.Lock()
		s.session.NodeCountMap[msg.Name]++
		nodeRunIndex := s.session.NodeCountMap[msg.Name]
		s.session.mu.Unlock()

		// 计算执行耗时
		var latency int64 = 0
		s.session.mu.RLock()
		if startTime, ok := s.session.NodeStartMap[msg.Name]; ok {
			latency = time.Since(startTime).Milliseconds()
		}
		s.session.mu.RUnlock()

		// 获取节点调试数据
		var nodeData map[string]interface{}
		if s.session.Resource != nil {
			nodeJSON, ok := s.session.Resource.GetNodeJSON(msg.Name)
			if ok && nodeJSON != "" {
				logger.Debug("Debug", "获取到节点数据: %s", msg.Name)
				if err := json.Unmarshal([]byte(nodeJSON), &nodeData); err != nil {
					logger.Warn("Debug", "解析节点 JSON 失败: %v", err)
				}
			}
		}

		// 发送 node_completed 事件
		event := DebugEvent{
			Type:      "debug_event",
			EventName: "node_completed",
			TaskID:    s.session.TaskID,
			NodeID:    msg.Name,
			Timestamp: time.Now().Unix(),
			Detail: map[string]interface{}{
				"node_name": msg.Name,
				"reco_id":   msg.RecognitionID,
				"task_id":   msg.TaskID,
				"status":    status,
				"hit":       true,
				"node_data": nodeData,
				"run_index": nodeRunIndex,
				"latency":   latency,
			},
		}
		logger.Info("Debug", "发送调试事件: node_completed, 节点=%s, 次数=%d, 耗时=%dms", msg.Name, nodeRunIndex, latency)
		s.handler.OnDebugEvent(event)

	case maa.EventStatusFailed:
		// 递增节点执行次数
		s.session.mu.Lock()
		s.session.NodeCountMap[msg.Name]++
		nodeRunIndex := s.session.NodeCountMap[msg.Name]
		s.session.mu.Unlock()

		// 计算执行耗时
		var latency int64 = 0
		s.session.mu.RLock()
		if startTime, ok := s.session.NodeStartMap[msg.Name]; ok {
			latency = time.Since(startTime).Milliseconds()
		}
		s.session.mu.RUnlock()

		// 发送 node_failed 事件
		event := DebugEvent{
			Type:      "debug_event",
			EventName: "node_failed",
			TaskID:    s.session.TaskID,
			NodeID:    msg.Name,
			Timestamp: time.Now().Unix(),
			Detail: map[string]interface{}{
				"node_name": msg.Name,
				"reco_id":   msg.RecognitionID,
				"task_id":   msg.TaskID,
				"status":    status,
				"hit":       false,
				"run_index": nodeRunIndex,
				"latency":   latency,
			},
		}
		logger.Info("Debug", "发送调试事件: node_failed, 节点=%s, 次数=%d, 耗时=%dms", msg.Name, nodeRunIndex, latency)
		s.handler.OnDebugEvent(event)

	default:
		logger.Debug("Debug", "OnTaskRecognition 未知状态: %v", status)
	}
}

func (s *debugEventSink) OnTaskAction(tasker *maa.Tasker, status maa.EventStatus, msg maa.NodeActionDetail) {
	logger.Debug("Debug", "动作事件: NodeID=%s, ActionID=%d", msg.Name, msg.ActionID)

	if s.handler != nil {
		detail := map[string]interface{}{
			"node_name": msg.Name,
			"action_id": msg.ActionID,
			"task_id":   msg.TaskID,
			"status":    status,
		}

		event := DebugEvent{
			Type:      "debug_event",
			EventName: "action",
			TaskID:    s.session.TaskID,
			NodeID:    msg.Name,
			Timestamp: time.Now().Unix(),
			Detail:    detail,
		}
		s.handler.OnDebugEvent(event)
	}
}

func (s *debugEventSink) OnNodePipelineNode(tasker *maa.Tasker, status maa.EventStatus, msg maa.NodePipelineNodeDetail) {
	logger.Info("Debug", "===== OnNodePipelineNode 被调用 ===== NodeName=%s, NodeID=%d, Status=%v", msg.Name, msg.NodeID, status)

	if s.handler == nil {
		logger.Warn("Debug", "handler 为空，无法发送事件")
		return
	}

	// 根据状态发送不同事件
	switch status {
	case maa.EventStatusStarting:
		// 记录节点开始时间
		s.session.mu.Lock()
		s.session.NodeStartMap[msg.Name] = time.Now()
		s.session.mu.Unlock()

		// 发送 node_running 事件
		event := DebugEvent{
			Type:      "debug_event",
			EventName: "node_running",
			TaskID:    s.session.TaskID,
			NodeID:    msg.Name,
			Timestamp: time.Now().Unix(),
			Detail: map[string]interface{}{
				"node_name": msg.Name,
				"node_id":   msg.NodeID,
				"task_id":   msg.TaskID,
				"status":    status,
			},
		}
		logger.Info("Debug", "发送调试事件: node_running, 节点=%s", msg.Name)
		s.handler.OnDebugEvent(event)

	case maa.EventStatusSucceeded:
		// 递增节点执行次数
		s.session.mu.Lock()
		s.session.NodeCountMap[msg.Name]++
		nodeRunIndex := s.session.NodeCountMap[msg.Name]
		s.session.mu.Unlock()

		// 计算执行耗时
		var latency int64 = 0
		s.session.mu.RLock()
		if startTime, ok := s.session.NodeStartMap[msg.Name]; ok {
			latency = time.Since(startTime).Milliseconds()
		}
		s.session.mu.RUnlock()

		// 获取节点调试数据
		var nodeData map[string]interface{}
		if s.session.Resource != nil {
			nodeJSON, ok := s.session.Resource.GetNodeJSON(msg.Name)
			if ok && nodeJSON != "" {
				logger.Info("Debug", "获取到节点数据: %s -> %s", msg.Name, nodeJSON[:min(100, len(nodeJSON))]+"...")
				if err := json.Unmarshal([]byte(nodeJSON), &nodeData); err != nil {
					logger.Warn("Debug", "解析节点 JSON 失败: %v", err)
				}
			} else {
				logger.Warn("Debug", "未获取到节点数据: %s, ok=%v", msg.Name, ok)
			}
		}

		// 发送 node_completed 事件
		event := DebugEvent{
			Type:      "debug_event",
			EventName: "node_completed",
			TaskID:    s.session.TaskID,
			NodeID:    msg.Name,
			Timestamp: time.Now().Unix(),
			Detail: map[string]interface{}{
				"node_name": msg.Name,
				"node_id":   msg.NodeID,
				"task_id":   msg.TaskID,
				"status":    status,
				"hit":       true,
				"node_data": nodeData,
				"run_index": nodeRunIndex,
				"latency":   latency,
			},
		}
		logger.Info("Debug", "发送调试事件: node_completed, 节点=%s, 次数=%d, 耗时=%dms", msg.Name, nodeRunIndex, latency)
		s.handler.OnDebugEvent(event)

	case maa.EventStatusFailed:
		// 递增节点执行次数
		s.session.mu.Lock()
		s.session.NodeCountMap[msg.Name]++
		nodeRunIndex := s.session.NodeCountMap[msg.Name]
		s.session.mu.Unlock()

		// 计算执行耗时
		var latency int64 = 0
		s.session.mu.RLock()
		if startTime, ok := s.session.NodeStartMap[msg.Name]; ok {
			latency = time.Since(startTime).Milliseconds()
		}
		s.session.mu.RUnlock()

		// 发送 node_failed 事件
		event := DebugEvent{
			Type:      "debug_event",
			EventName: "node_failed",
			TaskID:    s.session.TaskID,
			NodeID:    msg.Name,
			Timestamp: time.Now().Unix(),
			Detail: map[string]interface{}{
				"node_name": msg.Name,
				"node_id":   msg.NodeID,
				"task_id":   msg.TaskID,
				"status":    status,
				"run_index": nodeRunIndex,
				"latency":   latency,
			},
		}
		logger.Info("Debug", "发送调试事件: node_failed, 节点=%s, 次数=%d, 耗时=%dms", msg.Name, nodeRunIndex, latency)
		s.handler.OnDebugEvent(event)

	default:
		logger.Warn("Debug", "未知节点状态: %v", status)
	}
}

func (s *debugEventSink) OnNodeRecognitionNode(tasker *maa.Tasker, status maa.EventStatus, msg maa.NodeRecognitionNodeDetail) {
	logger.Info("Debug", "===== OnNodeRecognitionNode 被调用 ===== NodeName=%s, NodeID=%d, Status=%v", msg.Name, msg.NodeID, status)

	if s.handler == nil {
		logger.Warn("Debug", "handler 为空，无法发送事件")
		return
	}

	// 实时节点事件
	switch status {
	case maa.EventStatusStarting:
		// 记录节点开始时间
		s.session.mu.Lock()
		s.session.NodeStartMap[msg.Name] = time.Now()
		s.session.mu.Unlock()

		// 发送 node_running 事件
		event := DebugEvent{
			Type:      "debug_event",
			EventName: "node_running",
			TaskID:    s.session.TaskID,
			NodeID:    msg.Name,
			Timestamp: time.Now().Unix(),
			Detail: map[string]interface{}{
				"node_name": msg.Name,
				"node_id":   msg.NodeID,
				"task_id":   msg.TaskID,
				"status":    status,
			},
		}
		logger.Info("Debug", "发送调试事件: node_running, 节点=%s", msg.Name)
		s.handler.OnDebugEvent(event)

	case maa.EventStatusSucceeded:
		// 递增节点执行次数
		s.session.mu.Lock()
		s.session.NodeCountMap[msg.Name]++
		nodeRunIndex := s.session.NodeCountMap[msg.Name]
		s.session.mu.Unlock()

		// 计算执行耗时
		var latency int64 = 0
		s.session.mu.RLock()
		if startTime, ok := s.session.NodeStartMap[msg.Name]; ok {
			latency = time.Since(startTime).Milliseconds()
		}
		s.session.mu.RUnlock()

		// 获取节点调试数据
		var nodeData map[string]interface{}
		if s.session.Resource != nil {
			nodeJSON, ok := s.session.Resource.GetNodeJSON(msg.Name)
			if ok && nodeJSON != "" {
				logger.Debug("Debug", "获取到节点数据: %s", msg.Name)
				if err := json.Unmarshal([]byte(nodeJSON), &nodeData); err != nil {
					logger.Warn("Debug", "解析节点 JSON 失败: %v", err)
				}
			}
		}

		// 发送 node_completed 事件
		event := DebugEvent{
			Type:      "debug_event",
			EventName: "node_completed",
			TaskID:    s.session.TaskID,
			NodeID:    msg.Name,
			Timestamp: time.Now().Unix(),
			Detail: map[string]interface{}{
				"node_name": msg.Name,
				"node_id":   msg.NodeID,
				"task_id":   msg.TaskID,
				"status":    status,
				"hit":       true,
				"node_data": nodeData,
				"run_index": nodeRunIndex,
				"latency":   latency,
			},
		}
		logger.Info("Debug", "发送调试事件: node_completed, 节点=%s, 次数=%d, 耗时=%dms", msg.Name, nodeRunIndex, latency)
		s.handler.OnDebugEvent(event)

	case maa.EventStatusFailed:
		// 递增节点执行次数
		s.session.mu.Lock()
		s.session.NodeCountMap[msg.Name]++
		nodeRunIndex := s.session.NodeCountMap[msg.Name]
		s.session.mu.Unlock()

		// 计算执行耗时
		var latency int64 = 0
		s.session.mu.RLock()
		if startTime, ok := s.session.NodeStartMap[msg.Name]; ok {
			latency = time.Since(startTime).Milliseconds()
		}
		s.session.mu.RUnlock()

		// 发送 node_failed 事件
		event := DebugEvent{
			Type:      "debug_event",
			EventName: "node_failed",
			TaskID:    s.session.TaskID,
			NodeID:    msg.Name,
			Timestamp: time.Now().Unix(),
			Detail: map[string]interface{}{
				"node_name": msg.Name,
				"node_id":   msg.NodeID,
				"task_id":   msg.TaskID,
				"status":    status,
				"hit":       false,
				"run_index": nodeRunIndex,
				"latency":   latency,
			},
		}
		logger.Info("Debug", "发送调试事件: node_failed, 节点=%s, 次数=%d, 耗时=%dms", msg.Name, nodeRunIndex, latency)
		s.handler.OnDebugEvent(event)

	default:
		logger.Debug("Debug", "OnNodeRecognitionNode 未知状态: %v", status)
	}
}

func (s *debugEventSink) OnNodeActionNode(tasker *maa.Tasker, status maa.EventStatus, msg maa.NodeActionNodeDetail) {
	logger.Info("Debug", "===== OnNodeActionNode 被调用 ===== NodeName=%s, NodeID=%d, Status=%v", msg.Name, msg.NodeID, status)
	logger.Debug("Debug", "NodeActionNode 详情: TaskID=%d", msg.TaskID)
}

func (s *debugEventSink) OnResourceLoading(tasker *maa.Tasker, status maa.EventStatus, msg maa.ResourceLoadingDetail) {
	logger.Info("Debug", "资源加载事件: Path=%s, Status=%v", msg.Path, status)
}

func (s *debugEventSink) OnControllerAction(tasker *maa.Tasker, status maa.EventStatus, msg maa.ControllerActionDetail) {
	logger.Info("Debug", "控制器动作事件: Action=%s, Status=%v", msg.Action, status)
}

func (s *debugEventSink) OnTaskNextList(tasker *maa.Tasker, status maa.EventStatus, msg maa.NodeNextListDetail) {
	logger.Info("Debug", "===== OnTaskNextList 被调用 ===== NodeName=%s, Status=%v, NextList=%v", msg.Name, status, msg.NextList)

	if s.handler == nil {
		logger.Warn("Debug", "handler 为空，无法发送事件")
		return
	}

	nextListData := make([]map[string]interface{}, 0, len(msg.NextList))
	for _, item := range msg.NextList {
		nextListData = append(nextListData, map[string]interface{}{
			"name":      item.Name,
			"jump_back": item.JumpBack,
			"anchor":    item.Anchor,
		})
	}

	// 发送 next_list 事件
	event := DebugEvent{
		Type:      "debug_event",
		EventName: "next_list",
		TaskID:    s.session.TaskID,
		NodeID:    msg.Name,
		Timestamp: time.Now().Unix(),
		Detail: map[string]interface{}{
			"task_id":   msg.TaskID,
			"name":      msg.Name,
			"next_list": nextListData,
			"focus":     msg.Focus,
		},
	}
	logger.Info("Debug", "发送调试事件: next_list, 节点=%s, NextList条目数=%d", msg.Name, len(msg.NextList))
	s.handler.OnDebugEvent(event)
}

func (s *debugEventSink) OnUnknownEvent(tasker *maa.Tasker, eventMsg, detailsJSON string) {
	logger.Warn("Debug", "!!!!! 未知事件 !!!!! Message=%s", eventMsg)
	logger.Debug("Debug", "未知事件详情 JSON: %s", detailsJSON)
}

// 截图功能(可选)
func (ds *DebugService) Screencap(taskID string) (string, error) {
	ds.mu.RLock()
	defer ds.mu.RUnlock()

	session, exists := ds.sessions[taskID]
	if !exists {
		return "", fmt.Errorf("调试会话不存在: %s", taskID)
	}

	session.mu.RLock()
	defer session.mu.RUnlock()

	if session.Controller == nil {
		return "", fmt.Errorf("控制器不可用")
	}

	// 截图
	job := session.Controller.PostScreencap()
	if job == nil {
		logger.Error("Debug", "截图失败: job为空")
		return "", fmt.Errorf("截图失败")
	}
	job.Wait()

	if !job.Success() {
		logger.Error("Debug", "截图任务失败")
		return "", fmt.Errorf("截图任务失败")
	}

	// 获取缓存的图像
	img := session.Controller.CacheImage()
	if img == nil {
		logger.Error("Debug", "获取图像失败")
		return "", fmt.Errorf("获取图像失败")
	}

	// 将图像编码为 PNG 并转换为 Base64
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		logger.Error("Debug", "编码图像失败: %v", err)
		return "", fmt.Errorf("编码图像失败: %w", err)
	}

	encoded := base64.StdEncoding.EncodeToString(buf.Bytes())

	logger.Debug("Debug", "截图成功, 大小=%d bytes", buf.Len())

	return encoded, nil
}
