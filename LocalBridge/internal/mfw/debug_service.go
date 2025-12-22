package mfw

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"image/png"
	"sync"
	"time"

	maa "github.com/MaaXYZ/maa-framework-go/v3"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
)

// 调试会话
type DebugSession struct {
	TaskID       string
	ResourcePath string
	EntryNode    string
	ControllerID string
	Tasker       *maa.Tasker
	Resource     *maa.Resource
	Controller   *maa.Controller
	StartTime    time.Time
	Status       string // "running" | "stopped" | "completed"
	EventHandler DebugEventHandler
	mu           sync.RWMutex
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
func (ds *DebugService) StartDebug(resourcePath, entryNode, controllerID string, handler DebugEventHandler) (string, error) {
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
	}

	// 注册事件回调
	tasker.AddSink(&debugEventSink{
		session: session,
		handler: handler,
	})

	// 提交任务
	taskJob := tasker.PostTask(entryNode)
	if taskJob == nil {
		logger.Error("Debug", "提交任务失败")
		tasker.Destroy()
		return "", fmt.Errorf("提交任务失败")
	}

	logger.Info("Debug", "任务已提交, SessionID=%s", session.TaskID)

	// 保存会话
	ds.sessions[session.TaskID] = session

	// 异步等待任务完成
	go func() {
		taskJob.Wait()
		logger.Info("Debug", "任务执行完成: %s", session.TaskID)

		// 发送完成事件
		if handler != nil {
			handler.OnDebugEvent(DebugEvent{
				Type:      "debug_completed",
				TaskID:    session.TaskID,
				Timestamp: time.Now().Unix(),
			})
		}

		// 更新会话状态
		session.mu.Lock()
		session.Status = "completed"
		session.mu.Unlock()
	}()

	return session.TaskID, nil
}

// 停止调试
func (ds *DebugService) StopDebug(taskID string) error {
	ds.mu.Lock()
	defer ds.mu.Unlock()

	logger.Info("Debug", "停止调试: %s", taskID)

	session, exists := ds.sessions[taskID]
	if !exists {
		logger.Warn("Debug", "调试会话不存在: %s", taskID)
		return fmt.Errorf("调试会话不存在: %s", taskID)
	}

	session.mu.Lock()
	defer session.mu.Unlock()

	// 停止任务
	if session.Tasker != nil && session.Status == "running" {
		stopJob := session.Tasker.PostStop()
		if stopJob != nil {
			// 等待任务停止
			stopJob.Wait()
		} else {
			logger.Warn("Debug", "停止任务Job为空")
		}

		// 销毁 Tasker
		session.Tasker.Destroy()
		session.Tasker = nil
	}

	// 更新会话状态
	session.Status = "stopped"

	// 移除会话
	delete(ds.sessions, taskID)

	logger.Info("Debug", "调试已停止: %s", taskID)
	return nil
}

// 获取调试会话
func (ds *DebugService) GetSession(taskID string) *DebugSession {
	ds.mu.RLock()
	defer ds.mu.RUnlock()
	return ds.sessions[taskID]
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
type debugEventSink struct {
	session *DebugSession
	handler DebugEventHandler
}

// 实现 TaskerEventSink 接口
func (s *debugEventSink) OnTaskerTask(tasker *maa.Tasker, status maa.EventStatus, detail maa.TaskerTaskDetail) {
	logger.Debug("Debug", "任务事件: ID=%d, Entry=%s", detail.TaskID, detail.Entry)

	if s.handler != nil {
		event := DebugEvent{
			Type:      "debug_event",
			EventName: "task_completed",
			TaskID:    s.session.TaskID,
			Timestamp: time.Now().Unix(),
			Detail: map[string]interface{}{
				"entry":   detail.Entry,
				"task_id": detail.TaskID,
				"status":  status,
			},
		}
		s.handler.OnDebugEvent(event)
	}
}

func (s *debugEventSink) OnTaskRecognition(tasker *maa.Tasker, status maa.EventStatus, msg maa.NodeRecognitionDetail) {
	logger.Debug("Debug", "识别事件: NodeID=%s, RecognitionID=%d", msg.Name, msg.RecognitionID)

	if s.handler != nil {
		detail := map[string]interface{}{
			"node_name":      msg.Name,
			"recognition_id": msg.RecognitionID,
			"task_id":        msg.TaskID,
			"status":         status,
		}

		event := DebugEvent{
			Type:      "debug_event",
			EventName: "recognition",
			TaskID:    s.session.TaskID,
			NodeID:    msg.Name,
			Timestamp: time.Now().Unix(),
			Detail:    detail,
		}
		s.handler.OnDebugEvent(event)
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
	logger.Debug("Debug", "Pipeline节点事件: NodeID=%s, Status=%v", msg.Name, status)

	if s.handler != nil {
		var eventName string
		switch status {
		case maa.EventStatusStarting:
			eventName = "node_running"
		case maa.EventStatusSucceeded, maa.EventStatusFailed:
			eventName = "node_completed"
		default:
			eventName = "node_unknown"
		}

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
			},
		}
		s.handler.OnDebugEvent(event)
	}
}

func (s *debugEventSink) OnNodeRecognitionNode(tasker *maa.Tasker, status maa.EventStatus, msg maa.NodeRecognitionNodeDetail) {
	logger.Debug("Debug", "识别节点事件: NodeID=%s, Status=%v", msg.Name, status)
}

func (s *debugEventSink) OnNodeActionNode(tasker *maa.Tasker, status maa.EventStatus, msg maa.NodeActionNodeDetail) {
	logger.Debug("Debug", "动作节点事件: NodeID=%s, Status=%v", msg.Name, status)
}

func (s *debugEventSink) OnResourceLoading(tasker *maa.Tasker, status maa.EventStatus, msg maa.ResourceLoadingDetail) {
	logger.Debug("Debug", "资源加载事件: Path=%s, Status=%v", msg.Path, status)
}

func (s *debugEventSink) OnControllerAction(tasker *maa.Tasker, status maa.EventStatus, msg maa.ControllerActionDetail) {
	logger.Debug("Debug", "控制器动作事件: Action=%s, Status=%v", msg.Action, status)
}

func (s *debugEventSink) OnTaskNextList(tasker *maa.Tasker, status maa.EventStatus, msg maa.NodeNextListDetail) {
	logger.Debug("Debug", "节点下一步列表事件: NodeName=%s, Status=%v", msg.Name, status)
}

func (s *debugEventSink) OnUnknownEvent(tasker *maa.Tasker, eventMsg, detailsJSON string) {
	logger.Debug("Debug", "未知事件: %s, Details=%s", eventMsg, detailsJSON)
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
