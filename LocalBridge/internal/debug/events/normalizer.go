package events

import (
	"encoding/json"
	"fmt"
	"strings"
	"sync"

	maa "github.com/MaaXYZ/maa-framework-go/v4"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/artifact"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/protocol"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
)

type EmitFunc func(protocol.Event)

type Normalizer struct {
	sessionID string
	runID     string
	resolver  resolverIndex
	policy    protocol.ArtifactPolicy
	artifacts *artifact.Store
	emit      EmitFunc

	mu          sync.Mutex
	currentNode string

	bootstrapPending bool
	bootstrapActive  bool
}

func NewNormalizer(
	sessionID string,
	runID string,
	resolver protocol.NodeResolverSnapshot,
	policy protocol.ArtifactPolicy,
	artifacts *artifact.Store,
	emit EmitFunc,
) *Normalizer {
	return &Normalizer{
		sessionID: sessionID,
		runID:     runID,
		resolver:  newResolverIndex(resolver),
		policy:    policy,
		artifacts: artifacts,
		emit:      emit,
	}
}

func (n *Normalizer) OnTaskerTask(tasker *maa.Tasker, status maa.EventStatus, detail maa.TaskerTaskDetail) {
	if status == maa.EventStatusStarting {
		n.mu.Lock()
		n.bootstrapPending = true
		n.bootstrapActive = false
		n.currentNode = ""
		n.mu.Unlock()
	}

	event := n.baseEvent("task", "Tasker.Task", status)
	event.TaskID = int64(detail.TaskID)
	event.Data = map[string]interface{}{
		"entry": detail.Entry,
		"uuid":  detail.UUID,
		"hash":  detail.Hash,
	}

	if status == maa.EventStatusSucceeded || status == maa.EventStatusFailed {
		if ref := n.storeTaskDetail(tasker, int64(detail.TaskID)); ref != nil {
			event.DetailRef = ref.ID
		}
		n.finishBootstrap()
	}

	n.publish(event)
}

func (n *Normalizer) OnNodePipelineNode(_ *maa.Context, status maa.EventStatus, detail maa.NodePipelineNodeDetail) {
	event := n.baseEvent("node", "Node.PipelineNode", status)
	event.TaskID = int64(detail.TaskID)
	event.Node = n.nodeForPipelineEvent(status, detail.Name)
	event.Data = map[string]interface{}{
		"nodeId": detail.NodeID,
		"focus":  detail.Focus,
	}
	n.publish(event)
}

func (n *Normalizer) OnNodeRecognitionNode(_ *maa.Context, status maa.EventStatus, detail maa.NodeRecognitionNodeDetail) {
	event := n.baseEvent("recognition", "Node.RecognitionNode", status)
	event.TaskID = int64(detail.TaskID)
	event.Node = n.resolver.node(detail.Name)
	event.Data = map[string]interface{}{
		"nodeId": detail.NodeID,
		"focus":  detail.Focus,
	}
	n.publish(event)
}

func (n *Normalizer) OnNodeActionNode(_ *maa.Context, status maa.EventStatus, detail maa.NodeActionNodeDetail) {
	event := n.baseEvent("action", "Node.ActionNode", status)
	event.TaskID = int64(detail.TaskID)
	event.Node = n.resolver.node(detail.Name)
	event.Data = map[string]interface{}{
		"nodeId": detail.NodeID,
		"focus":  detail.Focus,
	}
	n.publish(event)
}

func (n *Normalizer) OnNodeNextList(_ *maa.Context, status maa.EventStatus, detail maa.NodeNextListDetail) {
	event := n.baseEvent("next-list", "Node.NextList", status)
	event.TaskID = int64(detail.TaskID)
	event.Node = n.nodeForNextListEvent(detail.Name)
	event.Data = map[string]interface{}{
		"next":  normalizeNextList(detail.List),
		"focus": detail.Focus,
	}
	n.publish(event)
}

func (n *Normalizer) OnNodeRecognition(ctx *maa.Context, status maa.EventStatus, detail maa.NodeRecognitionDetail) {
	event := n.baseEvent("recognition", "Node.Recognition", status)
	event.TaskID = int64(detail.TaskID)
	event.Node = n.resolver.node(detail.Name)
	event.Data = map[string]interface{}{
		"recognitionId": detail.RecognitionID,
		"focus":         detail.Focus,
	}

	n.mu.Lock()
	currentNode := n.currentNode
	n.mu.Unlock()
	if currentNode != "" {
		event.Data["parentNode"] = currentNode
	}

	if status == maa.EventStatusSucceeded || status == maa.EventStatusFailed {
		if ref := n.storeRecognitionDetail(ctx, int64(detail.RecognitionID)); ref != nil {
			event.DetailRef = ref.ID
			if screenshotRef, ok := ref.Data["screenshotRef"].(string); ok {
				event.ScreenshotRef = screenshotRef
			}
		}
	}

	n.publish(event)
}

func (n *Normalizer) OnNodeAction(ctx *maa.Context, status maa.EventStatus, detail maa.NodeActionDetail) {
	event := n.baseEvent("action", "Node.Action", status)
	event.TaskID = int64(detail.TaskID)
	event.Node = n.resolver.node(detail.Name)
	event.Data = map[string]interface{}{
		"actionId": detail.ActionID,
		"focus":    detail.Focus,
	}

	if status == maa.EventStatusSucceeded || status == maa.EventStatusFailed {
		if ref := n.storeActionDetail(ctx, int64(detail.ActionID)); ref != nil {
			event.DetailRef = ref.ID
		}
	}

	n.publish(event)
}

func (n *Normalizer) baseEvent(kind string, baseMessage string, status maa.EventStatus) protocol.Event {
	return protocol.Event{
		SessionID:    n.sessionID,
		RunID:        n.runID,
		Source:       "maafw",
		Kind:         kind,
		MaaFWMessage: maafwMessage(baseMessage, status),
		Phase:        eventPhase(status),
	}
}

func (n *Normalizer) publish(event protocol.Event) {
	if n.emit != nil {
		n.emit(event)
	}
}

func (n *Normalizer) finishBootstrap() {
	n.mu.Lock()
	defer n.mu.Unlock()
	n.bootstrapPending = false
	n.bootstrapActive = false
	if n.currentNode == protocol.TaskerBootstrapRuntimeName {
		n.currentNode = ""
	}
}

func (n *Normalizer) nodeForPipelineEvent(status maa.EventStatus, runtimeName string) *protocol.EventNode {
	n.mu.Lock()
	defer n.mu.Unlock()

	if status == maa.EventStatusStarting {
		if n.bootstrapPending && n.resolver.hasNode(runtimeName) {
			n.bootstrapPending = false
			n.bootstrapActive = false
			n.currentNode = runtimeName
			return n.resolver.node(runtimeName)
		}
		if n.bootstrapPending && !n.resolver.hasNode(runtimeName) {
			n.bootstrapActive = true
			n.currentNode = protocol.TaskerBootstrapRuntimeName
			return protocol.NewTaskerBootstrapEventNode()
		}

		n.currentNode = runtimeName
		return n.resolver.node(runtimeName)
	}

	if n.bootstrapActive {
		return protocol.NewTaskerBootstrapEventNode()
	}
	return n.resolver.node(runtimeName)
}

func (n *Normalizer) nodeForNextListEvent(runtimeName string) *protocol.EventNode {
	n.mu.Lock()
	defer n.mu.Unlock()

	if n.bootstrapPending || n.bootstrapActive {
		n.bootstrapActive = true
		n.currentNode = protocol.TaskerBootstrapRuntimeName
		return protocol.NewTaskerBootstrapEventNode()
	}
	return n.resolver.node(runtimeName)
}

type detailRef struct {
	ID   string
	Data map[string]interface{}
}

func (n *Normalizer) storeTaskDetail(tasker *maa.Tasker, taskID int64) *detailRef {
	if tasker == nil || n.artifacts == nil {
		return nil
	}
	detail, err := tasker.GetTaskDetail(taskID)
	if err != nil {
		logger.Warn("DebugVNext", "读取任务详情失败: %v", err)
		return nil
	}
	if detail == nil {
		return nil
	}
	data := SummarizeTaskDetail(detail)
	ref, err := n.artifacts.AddJSON(n.sessionID, "task-detail", data)
	if err != nil {
		logger.Warn("DebugVNext", "写入任务详情 artifact 失败: %v", err)
		return nil
	}
	return &detailRef{ID: ref.ID, Data: data}
}

func (n *Normalizer) storeRecognitionDetail(ctx *maa.Context, recognitionID int64) *detailRef {
	tasker := taskerFromContext(ctx)
	if tasker == nil || n.artifacts == nil {
		return nil
	}
	detail, err := tasker.GetRecognitionDetail(recognitionID)
	if err != nil {
		logger.Warn("DebugVNext", "读取识别详情失败: %v", err)
		return nil
	}
	if detail == nil {
		return nil
	}

	data := SummarizeRecognitionDetail(detail)
	if n.policy.IncludeRawImage && detail.Raw != nil {
		if ref, err := n.artifacts.AddPNG(n.sessionID, "recognition-raw-image", detail.Raw); err == nil {
			data["rawImageRef"] = ref.ID
			data["screenshotRef"] = ref.ID
		} else {
			logger.Warn("DebugVNext", "写入识别原图 artifact 失败: %v", err)
		}
	}
	if n.policy.IncludeDrawImage && len(detail.Draws) > 0 {
		drawRefs := make([]string, 0, len(detail.Draws))
		for _, img := range detail.Draws {
			if img == nil {
				continue
			}
			ref, err := n.artifacts.AddPNG(n.sessionID, "recognition-draw-image", img)
			if err != nil {
				logger.Warn("DebugVNext", "写入识别绘制图 artifact 失败: %v", err)
				continue
			}
			drawRefs = append(drawRefs, ref.ID)
			if _, ok := data["screenshotRef"]; !ok {
				data["screenshotRef"] = ref.ID
			}
		}
		if len(drawRefs) > 0 {
			data["drawImageRefs"] = drawRefs
		}
	}

	ref, err := n.artifacts.AddJSON(n.sessionID, "recognition-detail", data)
	if err != nil {
		logger.Warn("DebugVNext", "写入识别详情 artifact 失败: %v", err)
		return nil
	}
	return &detailRef{ID: ref.ID, Data: data}
}

func (n *Normalizer) storeActionDetail(ctx *maa.Context, actionID int64) *detailRef {
	tasker := taskerFromContext(ctx)
	if tasker == nil || n.artifacts == nil {
		return nil
	}
	detail, err := tasker.GetActionDetail(actionID)
	if err != nil {
		logger.Warn("DebugVNext", "读取动作详情失败: %v", err)
		return nil
	}
	if detail == nil {
		return nil
	}

	data := SummarizeActionDetail(detail)
	ref, err := n.artifacts.AddJSON(n.sessionID, "action-detail", data)
	if err != nil {
		logger.Warn("DebugVNext", "写入动作详情 artifact 失败: %v", err)
		return nil
	}
	return &detailRef{ID: ref.ID, Data: data}
}

func taskerFromContext(ctx *maa.Context) *maa.Tasker {
	if ctx == nil {
		return nil
	}
	return ctx.GetTasker()
}

type resolverIndex struct {
	nodes map[string]protocol.EventNode
	edges map[string]protocol.EventEdge
}

func newResolverIndex(snapshot protocol.NodeResolverSnapshot) resolverIndex {
	nodes := make(map[string]protocol.EventNode, len(snapshot.Nodes))
	for _, node := range snapshot.Nodes {
		nodes[node.RuntimeName] = protocol.EventNode{
			RuntimeName: node.RuntimeName,
			FileID:      node.FileID,
			NodeID:      node.NodeID,
			Label:       node.DisplayName,
		}
	}

	edges := make(map[string]protocol.EventEdge, len(snapshot.Edges))
	for _, edge := range snapshot.Edges {
		key := edgeKey(edge.FromRuntimeName, edge.ToRuntimeName)
		edges[key] = protocol.EventEdge{
			FromRuntimeName: edge.FromRuntimeName,
			ToRuntimeName:   edge.ToRuntimeName,
			EdgeID:          edge.EdgeID,
			Reason:          edge.Reason,
		}
	}

	return resolverIndex{nodes: nodes, edges: edges}
}

func (r resolverIndex) node(runtimeName string) *protocol.EventNode {
	if node, ok := r.nodes[runtimeName]; ok {
		return &node
	}
	return &protocol.EventNode{RuntimeName: runtimeName}
}

func (r resolverIndex) hasNode(runtimeName string) bool {
	if strings.TrimSpace(runtimeName) == "" {
		return false
	}
	_, ok := r.nodes[runtimeName]
	return ok
}

func edgeKey(from string, to string) string {
	return from + "\x00" + to
}

func normalizeNextList(items []maa.NextItem) []map[string]interface{} {
	result := make([]map[string]interface{}, 0, len(items))
	for _, item := range items {
		result = append(result, map[string]interface{}{
			"name":     item.Name,
			"jumpBack": item.JumpBack,
			"anchor":   item.Anchor,
		})
	}
	return result
}

func SummarizeTaskDetail(detail *maa.TaskDetail) map[string]interface{} {
	if detail == nil {
		return map[string]interface{}{}
	}
	nodes := make([]map[string]interface{}, 0, len(detail.NodeDetails))
	for _, node := range detail.NodeDetails {
		if node == nil {
			continue
		}
		nodeData := map[string]interface{}{
			"id":           node.ID,
			"name":         node.Name,
			"runCompleted": node.RunCompleted,
		}
		if node.Recognition != nil {
			nodeData["recognition"] = SummarizeRecognitionDetail(node.Recognition)
		}
		if node.Action != nil {
			nodeData["action"] = SummarizeActionDetail(node.Action)
		}
		nodes = append(nodes, nodeData)
	}
	return map[string]interface{}{
		"id":     detail.ID,
		"entry":  detail.Entry,
		"status": detail.Status.String(),
		"nodes":  nodes,
	}
}

func SummarizeRecognitionDetail(detail *maa.RecognitionDetail) map[string]interface{} {
	if detail == nil {
		return map[string]interface{}{}
	}
	data := map[string]interface{}{
		"id":        detail.ID,
		"name":      detail.Name,
		"algorithm": detail.Algorithm,
		"hit":       detail.Hit,
		"box":       detail.Box,
	}
	if strings.TrimSpace(detail.DetailJson) != "" {
		data["detailJson"] = detail.DetailJson
		data["detail"] = parseDetailJSON(detail.DetailJson)
	}
	if len(detail.CombinedResult) > 0 {
		combined := make([]map[string]interface{}, 0, len(detail.CombinedResult))
		for _, item := range detail.CombinedResult {
			if item != nil {
				combined = append(combined, SummarizeRecognitionDetail(item))
			}
		}
		data["combinedResult"] = combined
	}
	return data
}

func SummarizeActionDetail(detail *maa.ActionDetail) map[string]interface{} {
	if detail == nil {
		return map[string]interface{}{}
	}
	data := map[string]interface{}{
		"id":      detail.ID,
		"name":    detail.Name,
		"action":  detail.Action,
		"box":     detail.Box,
		"success": detail.Success,
	}
	if strings.TrimSpace(detail.DetailJson) != "" {
		data["detailJson"] = detail.DetailJson
		data["detail"] = parseDetailJSON(detail.DetailJson)
	}
	return data
}

func parseDetailJSON(raw string) interface{} {
	var parsed interface{}
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		return raw
	}
	return parsed
}

func maafwMessage(base string, status maa.EventStatus) string {
	suffix := eventStatusSuffix(status)
	if suffix == "" {
		return base
	}
	return fmt.Sprintf("%s.%s", base, suffix)
}

func eventStatusSuffix(status maa.EventStatus) string {
	switch status {
	case maa.EventStatusStarting:
		return "Starting"
	case maa.EventStatusSucceeded:
		return "Succeeded"
	case maa.EventStatusFailed:
		return "Failed"
	default:
		return ""
	}
}

func eventPhase(status maa.EventStatus) string {
	switch status {
	case maa.EventStatusStarting:
		return "starting"
	case maa.EventStatusSucceeded:
		return "succeeded"
	case maa.EventStatusFailed:
		return "failed"
	default:
		return ""
	}
}
