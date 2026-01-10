package mfw

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"image/png"
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
	callback                DebugEventCallback
	nodeStartMap            map[string]time.Time              // 节点开始时间记录
	recoCountMap            map[string]int                    // 识别次数计数
	pendingRecoDetails      map[string]map[string]interface{} // 待发送的识别详情 (nodeName -> detail)
	pendingResendNodes      []string                          // 待补发的节点名称队列
	lastActionSucceededNode string                            // 最后一个动作成功的节点
	enabled                 bool
	screenshotter           *Screenshotter // 截图器引用
	ctxRef                  *maa.Context   // 上下文引用，用于节点成功时获取详情
}

// NewSimpleContextSink 创建简化的上下文事件接收器
func NewSimpleContextSink(callback DebugEventCallback) *SimpleContextSink {
	return &SimpleContextSink{
		callback:           callback,
		nodeStartMap:       make(map[string]time.Time),
		recoCountMap:       make(map[string]int),
		pendingRecoDetails: make(map[string]map[string]interface{}),
		pendingResendNodes: make([]string, 0),
		enabled:            true,
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

// Reset 重置计数器
func (s *SimpleContextSink) Reset() {
	s.nodeStartMap = make(map[string]time.Time)
	s.recoCountMap = make(map[string]int)
	s.pendingRecoDetails = make(map[string]map[string]interface{})
	s.pendingResendNodes = make([]string, 0)
	s.lastActionSucceededNode = ""
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

		logger.Info("DebugSink", "节点成功: %s (耗时 %dms)", nodeName, latency)

		// 处理待补发队列中的所有节点
		if len(s.pendingResendNodes) > 0 {
			logger.Debug("DebugSink", "处理待补发队列: %v", s.pendingResendNodes)
			for _, pendingNode := range s.pendingResendNodes {
				s.fetchAndEmitRecognitionDetail(ctx, pendingNode, taskID)
			}
			// 清空队列
			s.pendingResendNodes = make([]string, 0)
		}

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

		logger.Info("DebugSink", "节点失败: %s (耗时 %dms)", nodeName, latency)
		s.emit(DebugEventData{
			Type:     EventNodeFailed,
			NodeName: nodeName,
			NodeID:   nodeID,
			TaskID:   taskID,
			Latency:  latency,
		})
	}
}

// fetchAndEmitRecognitionDetail 获取并发送完整的识别详情
func (s *SimpleContextSink) fetchAndEmitRecognitionDetail(ctx *maa.Context, nodeName string, taskID uint64) {
	logger.Debug("DebugSink", "[补发开始] 节点=%s, taskID=%d", nodeName, taskID)

	if ctx == nil {
		logger.Warn("DebugSink", "[补发] context 为空, 节点=%s", nodeName)
		return
	}

	tasker := ctx.GetTasker()
	if tasker == nil {
		logger.Warn("DebugSink", "[补发] tasker 为空, 节点=%s", nodeName)
		return
	}

	nodeDetail := tasker.GetLatestNode(nodeName)
	if nodeDetail == nil {
		logger.Warn("DebugSink", "[补发] nodeDetail 为空: %s", nodeName)
		return
	}

	if nodeDetail.Recognition == nil {
		logger.Warn("DebugSink", "[补发] nodeDetail.Recognition 为空: %s", nodeName)
		return
	}

	recoDetail := nodeDetail.Recognition
	logger.Info("DebugSink", "[补发] ✓ 获取到完整识别详情: 节点=%s, 算法=%s, Hit=%v", nodeName, recoDetail.Algorithm, recoDetail.Hit)

	// 构建详情
	detailMap := map[string]interface{}{
		"algorithm": recoDetail.Algorithm,
		"hit":       recoDetail.Hit,
		"task_id":   taskID,
	}

	// Box 转换为数组 [x, y, w, h]
	boxX := recoDetail.Box.X()
	boxY := recoDetail.Box.Y()
	boxW := recoDetail.Box.Width()
	boxH := recoDetail.Box.Height()
	if boxX != 0 || boxY != 0 || boxW != 0 || boxH != 0 {
		detailMap["box"] = []int{boxX, boxY, boxW, boxH}
		logger.Info("DebugSink", "[补发] ✓ 识别框: [%d, %d, %d, %d]", boxX, boxY, boxW, boxH)
	}

	// DetailJson 解析为对象
	if recoDetail.DetailJson != "" {
		var detailObj interface{}
		if err := json.Unmarshal([]byte(recoDetail.DetailJson), &detailObj); err == nil {
			detailMap["detail"] = detailObj
			detailMap["best_result"] = detailObj
			logger.Info("DebugSink", "[补发] ✓ 解析识别JSON成功")
		}
	}

	// Raw 截图转换为 base64
	if recoDetail.Raw != nil {
		var buf bytes.Buffer
		if err := png.Encode(&buf, recoDetail.Raw); err == nil {
			b64 := base64.StdEncoding.EncodeToString(buf.Bytes())
			detailMap["raw_image"] = b64
			logger.Info("DebugSink", "[补发] ✓ 原始截图转换成功, 大小=%d bytes", len(buf.Bytes()))
		}
	}

	// 绘制图像转换为 base64
	if len(recoDetail.Draws) > 0 {
		drawImages := make([]string, 0, len(recoDetail.Draws))
		for i, img := range recoDetail.Draws {
			if img != nil {
				var buf bytes.Buffer
				if err := png.Encode(&buf, img); err == nil {
					b64 := base64.StdEncoding.EncodeToString(buf.Bytes())
					drawImages = append(drawImages, b64)
					logger.Debug("DebugSink", "[补发] ✓ 绘制图像[%d]转换成功", i)
				}
			}
		}
		if len(drawImages) > 0 {
			detailMap["draw_images"] = drawImages
			logger.Info("DebugSink", "[补发] ✓ 识别详情包含 %d 张绘制图像", len(drawImages))
		}
	}

	// 发送补充的识别成功事件
	logger.Info("DebugSink", "[补发] 发送完整识别详情, 字段数: %d", len(detailMap))
	s.emit(DebugEventData{
		Type:     EventRecoSucceeded,
		NodeName: nodeName,
		TaskID:   taskID,
		Detail:   detailMap,
	})
}

// OnNodeRecognition 节点识别事件
// 记录每次识别尝试的结果
func (s *SimpleContextSink) OnNodeRecognition(ctx *maa.Context, status maa.EventStatus, detail maa.NodeRecognitionDetail) {
	nodeName := detail.Name
	recoID := detail.RecognitionID
	taskID := detail.TaskID

	switch status {
	case maa.EventStatusStarting:
		logger.Debug("DebugSink", "识别开始: %s (RecoID=%d)", nodeName, recoID)
		s.emit(DebugEventData{
			Type:     EventRecoStarting,
			NodeName: nodeName,
			RecoID:   recoID,
			TaskID:   taskID,
		})

	case maa.EventStatusSucceeded:
		// 递增识别次数
		s.recoCountMap[nodeName]++
		runIndex := s.recoCountMap[nodeName]

		logger.Info("DebugSink", "识别成功: %s (第%d次)", nodeName, runIndex)

		// 构建识别详情
		detailMap := map[string]interface{}{
			"run_index": runIndex,
			"hit":       true,
			"reco_id":   recoID,
			"task_id":   taskID,
		}

		// 尝试获取完整的识别详情（包含 Algorithm, Box, DetailJson, Draws, Raw）
		logger.Debug("DebugSink", "[调试] 开始获取完整识别详情, ctx=%v", ctx != nil)
		if ctx != nil {
			tasker := ctx.GetTasker()
			logger.Debug("DebugSink", "[调试] Tasker=%v", tasker != nil)
			if tasker != nil {
				nodeDetail := tasker.GetLatestNode(nodeName)
				logger.Debug("DebugSink", "[调试] NodeDetail=%v", nodeDetail != nil)
				if nodeDetail != nil {
					logger.Debug("DebugSink", "[调试] Recognition=%v", nodeDetail.Recognition != nil)
					if nodeDetail.Recognition != nil {
						recoDetail := nodeDetail.Recognition
						logger.Info("DebugSink", "✓ 获取到完整识别详情: 节点=%s, 算法=%s, Hit=%v", nodeName, recoDetail.Algorithm, recoDetail.Hit)

						// 更新识别详情
						detailMap["algorithm"] = recoDetail.Algorithm
						detailMap["hit"] = recoDetail.Hit

						// Box 转换为数组 [x, y, w, h]
						boxX := recoDetail.Box.X()
						boxY := recoDetail.Box.Y()
						boxW := recoDetail.Box.Width()
						boxH := recoDetail.Box.Height()
						logger.Debug("DebugSink", "[调试] Box: x=%d, y=%d, w=%d, h=%d", boxX, boxY, boxW, boxH)
						if boxX != 0 || boxY != 0 || boxW != 0 || boxH != 0 {
							detailMap["box"] = []int{boxX, boxY, boxW, boxH}
							logger.Info("DebugSink", "✓ 识别框: [%d, %d, %d, %d]", boxX, boxY, boxW, boxH)
						}

						// DetailJson 解析为对象
						logger.Debug("DebugSink", "[调试] DetailJson 长度: %d", len(recoDetail.DetailJson))
						if recoDetail.DetailJson != "" {
							var detailObj interface{}
							if err := json.Unmarshal([]byte(recoDetail.DetailJson), &detailObj); err == nil {
								detailMap["detail"] = detailObj
								detailMap["best_result"] = detailObj
								logger.Info("DebugSink", "✓ 解析识别详情JSON成功")
							} else {
								detailMap["detail"] = recoDetail.DetailJson
								logger.Warn("DebugSink", "✗ 解析识别详情JSON失败: %v, 使用原始字符串", err)
							}
						}

						// 绘制图像转换为 base64
						logger.Debug("DebugSink", "[调试] Draws 数量: %d", len(recoDetail.Draws))
						if len(recoDetail.Draws) > 0 {
							drawImages := make([]string, 0, len(recoDetail.Draws))
							for i, img := range recoDetail.Draws {
								if img != nil {
									var buf bytes.Buffer
									if err := png.Encode(&buf, img); err == nil {
										b64 := base64.StdEncoding.EncodeToString(buf.Bytes())
										drawImages = append(drawImages, b64)
										logger.Debug("DebugSink", "✓ 绘制图像[%d]转换成功, 大小=%d bytes", i, len(buf.Bytes()))
									} else {
										logger.Warn("DebugSink", "✗ 绘制图像[%d]编码失败: %v", i, err)
									}
								}
							}
							if len(drawImages) > 0 {
								detailMap["draw_images"] = drawImages
								logger.Info("DebugSink", "✓ 识别详情包含 %d 张绘制图像", len(drawImages))
							}
						}
					} else {
						logger.Warn("DebugSink", "✗ nodeDetail.Recognition 为空")
					}
				} else {
					logger.Warn("DebugSink", "✗ nodeDetail 为空")
				}
			} else {
				logger.Warn("DebugSink", "✗ tasker 为空")
			}
		} else {
			logger.Warn("DebugSink", "✗ context 为空")
		}

		// 始终从控制器截图
		if s.screenshotter != nil {
			if _, hasRaw := detailMap["raw_image"]; !hasRaw {
				logger.Debug("DebugSink", "[截图] 开始从控制器截图...")
				if b64, err := s.screenshotter.CaptureBase64(); err == nil {
					detailMap["raw_image"] = b64
					logger.Info("DebugSink", "✓ 控制器截图成功")
				} else {
					logger.Warn("DebugSink", "✗ 控制器截图失败: %v", err)
				}
			}
		}

		logger.Info("DebugSink", "[最终] 识别详情字段数: %d", len(detailMap))
		for key := range detailMap {
			logger.Debug("DebugSink", "[最终] 字段: %s", key)
		}

		s.emit(DebugEventData{
			Type:     EventRecoSucceeded,
			NodeName: nodeName,
			RecoID:   recoID,
			TaskID:   taskID,
			Detail:   detailMap,
		})

	case maa.EventStatusFailed:
		// 递增识别次数
		s.recoCountMap[nodeName]++
		runIndex := s.recoCountMap[nodeName]

		logger.Debug("DebugSink", "识别失败: %s (第%d次)", nodeName, runIndex)
		s.emit(DebugEventData{
			Type:     EventRecoFailed,
			NodeName: nodeName,
			RecoID:   recoID,
			TaskID:   taskID,
			Detail: map[string]interface{}{
				"run_index": runIndex,
				"hit":       false,
			},
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
		// 将当前节点添加到待补发队列
		s.pendingResendNodes = append(s.pendingResendNodes, nodeName)
		s.lastActionSucceededNode = nodeName
		logger.Debug("DebugSink", "添加到待补发队列: %s, 队列长度: %d", nodeName, len(s.pendingResendNodes))

	case maa.EventStatusFailed:
		logger.Info("DebugSink", "动作失败: %s", nodeName)
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
