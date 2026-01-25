package mfw

import (
	"encoding/json"
	"time"

	maa "github.com/MaaXYZ/maa-framework-go/v3"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
)

// ============================================================================
// 简化的事件 Sink 实现
// ============================================================================

// DebugEventType 调试事件类型
type DebugEventType string

const (
	// 节点级事件
	EventNodeStarting    DebugEventType = "node_starting"    // 节点开始执行
	EventNodeSucceeded   DebugEventType = "node_succeeded"   // 节点执行成功
	EventNodeFailed      DebugEventType = "node_failed"      // 节点执行失败
	EventRecoStarting    DebugEventType = "reco_starting"    // 识别开始
	EventRecoSucceeded   DebugEventType = "reco_succeeded"   // 识别成功
	EventRecoFailed      DebugEventType = "reco_failed"      // 识别失败
	EventActionStarting  DebugEventType = "action_starting"  // 动作开始
	EventActionSucceeded DebugEventType = "action_succeeded" // 动作成功
	EventActionFailed    DebugEventType = "action_failed"    // 动作失败

	// 任务级事件
	EventTaskStarting  DebugEventType = "task_starting"  // 任务开始
	EventTaskSucceeded DebugEventType = "task_succeeded" // 任务成功
	EventTaskFailed    DebugEventType = "task_failed"    // 任务失败

	// 资源级事件
	EventResourceLoading  DebugEventType = "resource_loading"  // 资源加载中
	EventResourceLoaded   DebugEventType = "resource_loaded"   // 资源加载完成
	EventResourceLoadFail DebugEventType = "resource_loadfail" // 资源加载失败
)

// DebugEventData 调试事件数据
type DebugEventData struct {
	Type      DebugEventType         `json:"type"`
	Timestamp int64                  `json:"timestamp"`
	NodeName  string                 `json:"node_name,omitempty"`
	NodeID    uint64                 `json:"node_id,omitempty"`
	TaskID    uint64                 `json:"task_id,omitempty"`
	RecoID    uint64                 `json:"reco_id,omitempty"`
	ActionID  uint64                 `json:"action_id,omitempty"`
	Detail    map[string]interface{} `json:"detail,omitempty"`
	Latency   int64                  `json:"latency,omitempty"` // 执行耗时 (ms)
}

// DebugEventCallback 调试事件回调函数类型
type DebugEventCallback func(event DebugEventData)

// ============================================================================
// SimpleContextSink - 简化的上下文事件接收器
// ============================================================================

// SimpleContextSink 简化的上下文事件接收器
// 只处理关键事件，减少事件噪声
type SimpleContextSink struct {
	callback        DebugEventCallback
	nodeStartMap    map[string]time.Time // 节点开始时间记录
	recoCountMap    map[string]int       // 识别次数计数
	enabled         bool
	screenshotter   *Screenshotter // 截图器引用
	ctxRef          *maa.Context   // 上下文引用，用于节点成功时获取详情
	currentNodeName string         // 当前正在执行的节点名称，用于识别记录的 parentNode
}

// NewSimpleContextSink 创建简化的上下文事件接收器
func NewSimpleContextSink(callback DebugEventCallback) *SimpleContextSink {
	return &SimpleContextSink{
		callback:     callback,
		nodeStartMap: make(map[string]time.Time),
		recoCountMap: make(map[string]int),
		enabled:      true,
	}
}

// SetScreenshotter 设置截图器引用
func (s *SimpleContextSink) SetScreenshotter(screenshotter *Screenshotter) {
	s.screenshotter = screenshotter
}

// SetEnabled 设置是否启用
func (s *SimpleContextSink) SetEnabled(enabled bool) {
	s.enabled = enabled
}

// Reset 重置计数器和状态
func (s *SimpleContextSink) Reset() {
	s.nodeStartMap = make(map[string]time.Time)
	s.recoCountMap = make(map[string]int)
	s.currentNodeName = "" // 重置当前节点，用于入口节点识别
}

// emit 发送事件
func (s *SimpleContextSink) emit(event DebugEventData) {
	if s.callback != nil && s.enabled {
		event.Timestamp = time.Now().Unix()
		s.callback(event)
	}
}

// OnNodePipelineNode 节点流水线事件（核心事件）
// 这是最重要的事件，表示一个完整的节点执行周期
func (s *SimpleContextSink) OnNodePipelineNode(ctx *maa.Context, status maa.EventStatus, detail maa.NodePipelineNodeDetail) {
	nodeName := detail.Name
	nodeID := detail.NodeID
	taskID := detail.TaskID

	// 保存上下文引用
	s.ctxRef = ctx

	switch status {
	case maa.EventStatusStarting:
		// 记录当前正在执行的节点
		s.currentNodeName = nodeName

		// 记录节点开始时间
		s.nodeStartMap[nodeName] = time.Now()

		logger.Debug("DebugSink", "节点开始: %s", nodeName)
		s.emit(DebugEventData{
			Type:     EventNodeStarting,
			NodeName: nodeName,
			NodeID:   nodeID,
			TaskID:   taskID,
		})

	case maa.EventStatusSucceeded:
		// 计算执行耗时
		var latency int64
		if startTime, ok := s.nodeStartMap[nodeName]; ok {
			latency = time.Since(startTime).Milliseconds()
		}

		logger.Debug("DebugSink", "节点成功: %s (耗时 %dms)", nodeName, latency)

		s.emit(DebugEventData{
			Type:     EventNodeSucceeded,
			NodeName: nodeName,
			NodeID:   nodeID,
			TaskID:   taskID,
			Latency:  latency,
		})

	case maa.EventStatusFailed:
		// 计算执行耗时
		var latency int64
		if startTime, ok := s.nodeStartMap[nodeName]; ok {
			latency = time.Since(startTime).Milliseconds()
		}

		logger.Debug("DebugSink", "节点失败: %s (耗时 %dms)", nodeName, latency)
		s.emit(DebugEventData{
			Type:     EventNodeFailed,
			NodeName: nodeName,
			NodeID:   nodeID,
			TaskID:   taskID,
			Latency:  latency,
		})
	}
}

// OnNodeRecognition 节点识别事件
// 记录每次识别尝试的结果
func (s *SimpleContextSink) OnNodeRecognition(ctx *maa.Context, status maa.EventStatus, detail maa.NodeRecognitionDetail) {
	nodeName := detail.Name
	recoID := detail.RecognitionID
	taskID := detail.TaskID

	switch status {
	case maa.EventStatusStarting:
		// 使用 currentNodeName 作为 parentNode
		parentNode := s.currentNodeName

		// 判断识别类型：
		// 1. 入口节点的初次识别：parentNode == nodeName && recoCountMap[nodeName] == 0
		//    → 这是入口节点自己检查自己的识别条件，应该显示为入口卡片
		// 2. 其他情况（包括 timeout 内重复识别、识别 next 列表中的其他节点等）
		//    → 正常显示在 parentNode 的卡片中
		//
		// 注意：不再过滤 "非入口节点的自我检查"，因为在 timeout 内重复识别时需要显示每次尝试

		isEntryNodeRecognition := (parentNode == nodeName && s.recoCountMap[nodeName] == 0)

		// 构建 Detail
		var detail map[string]interface{}
		if isEntryNodeRecognition {
			// 入口节点的初次识别，标记为入口
			detail = map[string]interface{}{
				"parent_node": "$entry",
				"is_entry":    true,
			}
			logger.Debug("DebugSink", "识别开始: NodeName=%s, RecoID=%d (入口节点)", nodeName, recoID)
		} else {
			// 正常识别（包括 timeout 内重复识别同一节点）
			detail = map[string]interface{}{
				"parent_node": parentNode,
			}
			logger.Debug("DebugSink", "识别开始: NodeName=%s, RecoID=%d, ParentNode=%s", nodeName, recoID, parentNode)
		}

		s.emit(DebugEventData{
			Type:     EventRecoStarting,
			NodeName: nodeName,
			RecoID:   recoID,
			TaskID:   taskID,
			Detail:   detail,
		})

	case maa.EventStatusSucceeded:
		// 递增识别次数
		s.recoCountMap[nodeName]++
		runIndex := s.recoCountMap[nodeName]

		logger.Debug("DebugSink", "识别成功: %s (第%d次, RecoID=%d)", nodeName, runIndex, recoID)

		// 构建 Detail，包含识别详情
		detail := map[string]interface{}{
			"run_index": runIndex,
			"hit":       true,
			"reco_id":   recoID, // 前端用于查找记录
		}

		// 获取完整识别详情（包含 raw_image 和 draw_images）
		if ctx != nil {
			if tasker := ctx.GetTasker(); tasker != nil {
				if recoDetail := GetRecognitionDetailByID(tasker, int64(recoID)); recoDetail != nil {
					// 添加识别详情到 detail
					detail["algorithm"] = recoDetail.Algorithm
					detail["box"] = recoDetail.Box
					if recoDetail.DetailJson != "" {
						// 尝试解析 JSON
						var rawDetail interface{}
						if err := json.Unmarshal([]byte(recoDetail.DetailJson), &rawDetail); err == nil {
							detail["raw_detail"] = rawDetail
						} else {
							detail["raw_detail"] = recoDetail.DetailJson
						}
					}
					if recoDetail.RawImage != "" {
						detail["raw_image"] = recoDetail.RawImage
					}
					if len(recoDetail.DrawImages) > 0 {
						detail["draw_images"] = recoDetail.DrawImages
					}
				}
			}
		}

		s.emit(DebugEventData{
			Type:     EventRecoSucceeded,
			NodeName: nodeName,
			RecoID:   recoID,
			TaskID:   taskID,
			Detail:   detail,
		})

	case maa.EventStatusFailed:
		// 递增识别次数
		s.recoCountMap[nodeName]++
		runIndex := s.recoCountMap[nodeName]

		logger.Debug("DebugSink", "识别失败: %s (第%d次, RecoID=%d)", nodeName, runIndex, recoID)

		// 实际失败的节点名称（默认为容器节点）
		actualNodeName := nodeName

		// 构建 Detail，包含识别详情
		detail := map[string]interface{}{
			"run_index": runIndex,
			"hit":       false,
			"reco_id":   recoID, // 前端用于查找记录
		}

		// 获取完整识别详情（包含 raw_image 和 draw_images）
		if ctx != nil {
			if tasker := ctx.GetTasker(); tasker != nil {
				if recoDetail := GetRecognitionDetailByID(tasker, int64(recoID)); recoDetail != nil {
					// 更新实际节点名（用于正确归属）
					if recoDetail.Name != "" && recoDetail.Name != nodeName {
						actualNodeName = recoDetail.Name
						logger.Debug("DebugSink", "✓ 实际失败节点: %s (容器: %s)", actualNodeName, nodeName)
					}

					// 添加识别详情到 detail
					detail["algorithm"] = recoDetail.Algorithm
					detail["box"] = recoDetail.Box
					if recoDetail.DetailJson != "" {
						// 尝试解析 JSON
						var rawDetail interface{}
						if err := json.Unmarshal([]byte(recoDetail.DetailJson), &rawDetail); err == nil {
							detail["raw_detail"] = rawDetail
						} else {
							detail["raw_detail"] = recoDetail.DetailJson
						}
					}
					if recoDetail.RawImage != "" {
						detail["raw_image"] = recoDetail.RawImage
					}
					if len(recoDetail.DrawImages) > 0 {
						detail["draw_images"] = recoDetail.DrawImages
					}
				}
			}
		}

		s.emit(DebugEventData{
			Type:     EventRecoFailed,
			NodeName: actualNodeName, // 使用实际失败的节点名
			RecoID:   recoID,
			TaskID:   taskID,
			Detail:   detail,
		})
	}
}

// OnNodeAction 节点动作事件
func (s *SimpleContextSink) OnNodeAction(ctx *maa.Context, status maa.EventStatus, detail maa.NodeActionDetail) {
	nodeName := detail.Name
	actionID := detail.ActionID
	taskID := detail.TaskID

	// 保存上下文引用
	if ctx != nil {
		s.ctxRef = ctx
	}

	switch status {
	case maa.EventStatusStarting:
		logger.Debug("DebugSink", "动作开始: %s (ActionID=%d)", nodeName, actionID)
		s.emit(DebugEventData{
			Type:     EventActionStarting,
			NodeName: nodeName,
			ActionID: actionID,
			TaskID:   taskID,
		})

	case maa.EventStatusSucceeded:
		logger.Debug("DebugSink", "动作成功: %s", nodeName)
		s.emit(DebugEventData{
			Type:     EventActionSucceeded,
			NodeName: nodeName,
			ActionID: actionID,
			TaskID:   taskID,
		})

	case maa.EventStatusFailed:
		logger.Debug("DebugSink", "动作失败: %s", nodeName)
		s.emit(DebugEventData{
			Type:     EventActionFailed,
			NodeName: nodeName,
			ActionID: actionID,
			TaskID:   taskID,
		})
	}
}

// OnNodeNextList 下一跳列表事件（可选，用于调试）
func (s *SimpleContextSink) OnNodeNextList(ctx *maa.Context, status maa.EventStatus, detail maa.NodeNextListDetail) {
	// 通常不需要处理这个事件，只在详细调试模式下使用
	if status == maa.EventStatusStarting {
		logger.Debug("DebugSink", "NextList: %s -> %v", detail.Name, detail.NextList)
	}
}

// OnNodeRecognitionNode 识别节点事件（接口必需，通常不处理）
func (s *SimpleContextSink) OnNodeRecognitionNode(ctx *maa.Context, status maa.EventStatus, detail maa.NodeRecognitionNodeDetail) {
	// 这个事件和 OnNodeRecognition 重复，通常不需要处理
}

// OnNodeActionNode 动作节点事件（接口必需，通常不处理）
func (s *SimpleContextSink) OnNodeActionNode(ctx *maa.Context, status maa.EventStatus, detail maa.NodeActionNodeDetail) {
	// 这个事件和 OnNodeAction 重复，通常不需要处理
}

// ============================================================================
// SimpleTaskerSink - 简化的 Tasker 事件接收器
// ============================================================================

// SimpleTaskerSink 简化的 Tasker 事件接收器
type SimpleTaskerSink struct {
	callback DebugEventCallback
	enabled  bool
}

// NewSimpleTaskerSink 创建简化的 Tasker 事件接收器
func NewSimpleTaskerSink(callback DebugEventCallback) *SimpleTaskerSink {
	return &SimpleTaskerSink{
		callback: callback,
		enabled:  true,
	}
}

// SetEnabled 设置是否启用
func (s *SimpleTaskerSink) SetEnabled(enabled bool) {
	s.enabled = enabled
}

// emit 发送事件
func (s *SimpleTaskerSink) emit(event DebugEventData) {
	if s.callback != nil && s.enabled {
		event.Timestamp = time.Now().Unix()
		s.callback(event)
	}
}

// OnTaskerTask 任务事件
func (s *SimpleTaskerSink) OnTaskerTask(tasker *maa.Tasker, status maa.EventStatus, detail maa.TaskerTaskDetail) {
	taskID := detail.TaskID
	entry := detail.Entry

	switch status {
	case maa.EventStatusStarting:
		logger.Info("DebugSink", "任务开始: Entry=%s, TaskID=%d", entry, taskID)
		s.emit(DebugEventData{
			Type:   EventTaskStarting,
			TaskID: taskID,
			Detail: map[string]interface{}{
				"entry": entry,
			},
		})

	case maa.EventStatusSucceeded:
		logger.Info("DebugSink", "任务成功: Entry=%s, TaskID=%d", entry, taskID)
		s.emit(DebugEventData{
			Type:   EventTaskSucceeded,
			TaskID: taskID,
			Detail: map[string]interface{}{
				"entry": entry,
			},
		})

	case maa.EventStatusFailed:
		logger.Info("DebugSink", "任务失败: Entry=%s, TaskID=%d", entry, taskID)
		s.emit(DebugEventData{
			Type:   EventTaskFailed,
			TaskID: taskID,
			Detail: map[string]interface{}{
				"entry": entry,
			},
		})
	}
}

// ============================================================================
// SimpleResourceSink - 简化的资源事件接收器
// ============================================================================

// SimpleResourceSink 简化的资源事件接收器
type SimpleResourceSink struct {
	callback DebugEventCallback
	enabled  bool
}

// NewSimpleResourceSink 创建简化的资源事件接收器
func NewSimpleResourceSink(callback DebugEventCallback) *SimpleResourceSink {
	return &SimpleResourceSink{
		callback: callback,
		enabled:  true,
	}
}

// SetEnabled 设置是否启用
func (s *SimpleResourceSink) SetEnabled(enabled bool) {
	s.enabled = enabled
}

// emit 发送事件
func (s *SimpleResourceSink) emit(event DebugEventData) {
	if s.callback != nil && s.enabled {
		event.Timestamp = time.Now().Unix()
		s.callback(event)
	}
}

// OnResourceLoading 资源加载事件
func (s *SimpleResourceSink) OnResourceLoading(res *maa.Resource, status maa.EventStatus, detail maa.ResourceLoadingDetail) {
	switch status {
	case maa.EventStatusStarting:
		logger.Info("DebugSink", "资源加载中: ID=%d, Path=%s", detail.ResID, detail.Path)
		s.emit(DebugEventData{
			Type: EventResourceLoading,
			Detail: map[string]interface{}{
				"res_id": detail.ResID,
				"path":   detail.Path,
			},
		})

	case maa.EventStatusSucceeded:
		logger.Info("DebugSink", "资源加载完成: ID=%d", detail.ResID)
		s.emit(DebugEventData{
			Type: EventResourceLoaded,
			Detail: map[string]interface{}{
				"res_id": detail.ResID,
				"hash":   detail.Hash,
			},
		})

	case maa.EventStatusFailed:
		logger.Error("DebugSink", "资源加载失败: ID=%d", detail.ResID)
		s.emit(DebugEventData{
			Type: EventResourceLoadFail,
			Detail: map[string]interface{}{
				"res_id": detail.ResID,
			},
		})
	}
}
