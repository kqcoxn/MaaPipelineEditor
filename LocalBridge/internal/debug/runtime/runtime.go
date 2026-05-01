package runtime

import (
	"encoding/json"
	"fmt"
	"image"
	"strings"
	"sync"
	"time"

	maa "github.com/MaaXYZ/maa-framework-go/v4"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/artifact"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/events"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/protocol"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/runutil"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/mfw"
)

type Runtime struct {
	sessionID string
	runID     string
	mode      protocol.RunMode
	entry     string
	target    *protocol.NodeTarget
	input     *protocol.RunInput
	resolver  protocol.NodeResolverSnapshot
	override  map[string]interface{}
	policy    protocol.ArtifactPolicy

	adapter       *mfw.MaaFWAdapter
	taskJob       *maa.TaskJob
	contextSinkID int64
	taskerSinkID  int64
	agentClients  []*maa.AgentClient

	artifacts     *artifact.Store
	emit          events.EmitFunc
	screenshotRef string

	mu sync.Mutex
}

type Result struct {
	Status string
	OK     bool
	Err    error
}

func New(
	service *mfw.Service,
	root string,
	sessionID string,
	runID string,
	req protocol.RunRequest,
	artifacts *artifact.Store,
	emit events.EmitFunc,
) (*Runtime, error) {
	entry, err := EntryForRequest(req)
	if err != nil {
		return nil, err
	}

	resourcePaths := normalizeResourcePaths(req.Profile.ResourcePaths)
	if len(resourcePaths) == 0 {
		return nil, fmt.Errorf("profile.resourcePaths 不能为空")
	}

	adapter := mfw.NewMaaFWAdapter()
	controllerID, err := ControllerID(req)
	if err != nil {
		adapter.Destroy()
		return nil, err
	}
	controllerInfo, err := service.ControllerManager().GetController(controllerID)
	if err != nil {
		adapter.Destroy()
		return nil, fmt.Errorf("获取控制器失败: %w", err)
	}
	controller, ok := controllerInfo.Controller.(*maa.Controller)
	if !ok || controller == nil {
		adapter.Destroy()
		return nil, fmt.Errorf("控制器实例不可用: %s", controllerID)
	}
	if !controller.Connected() {
		adapter.Destroy()
		return nil, fmt.Errorf("控制器未连接: %s", controllerID)
	}
	adapter.SetController(controller, controllerInfo.Type, controllerInfo.UUID)

	emitResourceLoadDiagnostics(sessionID, runID, emit, "starting", resourcePaths, nil)
	if err := adapter.LoadResourcesWithProgress(resourcePaths, func(index int, total int, path string, status string, err error) {
		emitResourceLoadDiagnostic(sessionID, runID, emit, index, total, path, status, err)
	}); err != nil {
		adapter.Destroy()
		return nil, fmt.Errorf("加载资源失败: %w", err)
	}

	override := PipelineOverride(req)
	if isDirectMode(req.Mode) {
		if err := adapter.OverridePipeline(override); err != nil {
			adapter.Destroy()
			return nil, fmt.Errorf("应用 pipeline override 失败: %w", err)
		}
	}

	if err := adapter.InitTasker(); err != nil {
		adapter.Destroy()
		return nil, fmt.Errorf("初始化 Tasker 失败: %w", err)
	}

	policy := protocol.ArtifactPolicy{}
	if req.ArtifactPolicy != nil {
		policy = *req.ArtifactPolicy
	}
	normalizer := events.NewNormalizer(sessionID, runID, req.ResolverSnapshot, policy, artifacts, emit)
	contextSinkID := adapter.AddContextSink(normalizer)
	taskerSinkID := adapter.AddTaskerSink(normalizer)

	r := &Runtime{
		sessionID:     sessionID,
		runID:         runID,
		mode:          req.Mode,
		entry:         entry,
		target:        req.Target,
		input:         req.Input,
		resolver:      req.ResolverSnapshot,
		override:      override,
		policy:        policy,
		adapter:       adapter,
		contextSinkID: contextSinkID,
		taskerSinkID:  taskerSinkID,
		artifacts:     artifacts,
		emit:          emit,
	}

	if err := r.connectAgents(req.Profile.Agents); err != nil {
		r.Destroy()
		return nil, err
	}

	return r, nil
}

func EntryForRequest(req protocol.RunRequest) (string, error) {
	switch req.Mode {
	case protocol.RunModeRunFromNode,
		protocol.RunModeSingleNodeRun,
		protocol.RunModeRecognitionOnly,
		protocol.RunModeActionOnly:
		if req.Target == nil {
			return "", fmt.Errorf("%s 缺少 target", req.Mode)
		}
		entry := strings.TrimSpace(req.Target.RuntimeName)
		if entry == "" {
			return "", fmt.Errorf("%s 缺少 target.runtimeName", req.Mode)
		}
		return entry, nil
	default:
		return "", fmt.Errorf("暂不支持 run mode: %s", req.Mode)
	}
}

func ControllerID(req protocol.RunRequest) (string, error) {
	options := req.Profile.Controller.Options
	for _, key := range []string{"controllerId", "controller_id"} {
		if value, ok := options[key].(string); ok && strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value), nil
		}
	}
	return "", fmt.Errorf("缺少必需字段: profile.controller.options.controllerId")
}

func PipelineOverride(req protocol.RunRequest) map[string]interface{} {
	override := make(map[string]interface{})
	for _, file := range req.GraphSnapshot.Files {
		for runtimeName, node := range file.Pipeline {
			override[runtimeName] = node
		}
	}
	for _, item := range req.Overrides {
		if strings.TrimSpace(item.RuntimeName) == "" {
			continue
		}
		override[item.RuntimeName] = item.Pipeline
	}
	return override
}

func (r *Runtime) Start() error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.adapter == nil {
		return fmt.Errorf("runtime 已释放")
	}
	if r.taskJob != nil && !r.taskJob.Done() {
		return fmt.Errorf("debug run 已在执行中: %s", r.runID)
	}

	logger.Info("DebugVNext", "启动调试运行: session=%s run=%s mode=%s entry=%s", r.sessionID, r.runID, r.mode, r.entry)

	switch r.mode {
	case protocol.RunModeRunFromNode:
		return r.startTask(r.override)
	case protocol.RunModeSingleNodeRun:
		override, err := r.singleNodeOverride()
		if err != nil {
			return err
		}
		return r.startTask(override)
	case protocol.RunModeRecognitionOnly:
		return r.startDirectRecognition()
	case protocol.RunModeActionOnly:
		return r.startDirectAction()
	default:
		return fmt.Errorf("暂不支持 run mode: %s", r.mode)
	}
}

func (r *Runtime) Stop() error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.adapter == nil {
		return nil
	}
	return r.adapter.PostStop()
}

func (r *Runtime) Wait() Result {
	r.mu.Lock()
	job := r.taskJob
	r.mu.Unlock()

	if job == nil {
		return Result{Status: "invalid", Err: fmt.Errorf("任务尚未提交")}
	}

	job.Wait()
	status := job.Status()
	if isDirectMode(r.mode) {
		r.emitDirectCompletion(job, status)
	}
	return Result{
		Status: status.String(),
		OK:     status.Success() && job.Error() == nil,
		Err:    job.Error(),
	}
}

func (r *Runtime) Destroy() {
	r.mu.Lock()
	defer r.mu.Unlock()

	for _, client := range r.agentClients {
		if client != nil {
			_ = client.Disconnect()
			client.Destroy()
		}
	}
	r.agentClients = nil

	if r.adapter == nil {
		return
	}
	if r.contextSinkID > 0 {
		r.adapter.RemoveContextSink(r.contextSinkID)
	}
	if r.taskerSinkID > 0 {
		r.adapter.RemoveTaskerSink(r.taskerSinkID)
	}
	r.adapter.Destroy()
	r.adapter = nil
}

func (r *Runtime) Entry() string {
	return r.entry
}

func (r *Runtime) startTask(override map[string]interface{}) error {
	if !r.entryExists(override) {
		return fmt.Errorf("入口节点不存在: %s", r.entry)
	}
	job, err := r.adapter.PostTask(r.entry, override)
	if err != nil {
		return err
	}
	if job == nil {
		return fmt.Errorf("提交任务失败")
	}
	if err := job.Error(); err != nil {
		return fmt.Errorf("提交任务失败: %w", err)
	}
	r.taskJob = job
	return nil
}

func (r *Runtime) startDirectRecognition() error {
	node, ok := r.adapter.GetNode(r.entry)
	if !ok || node == nil {
		return fmt.Errorf("目标节点不存在: %s", r.entry)
	}
	if node.Recognition == nil {
		return fmt.Errorf("目标节点没有 recognition: %s", r.entry)
	}
	ensureRecognitionDefaults(node.Recognition)

	img, err := r.adapter.ScreencapImage()
	if err != nil {
		return fmt.Errorf("获取识别输入截图失败: %w", err)
	}
	r.storeRecognitionInput(img)

	r.emitDirectEvent("node", "starting", "running", "", r.screenshotRef)
	r.emitDirectEvent("recognition", "starting", "running", "", r.screenshotRef)

	job, err := r.adapter.PostRecognition(node.Recognition.Type, node.Recognition.Param, img)
	if err != nil {
		return err
	}
	if err := job.Error(); err != nil {
		return err
	}
	r.taskJob = job
	return nil
}

func (r *Runtime) startDirectAction() error {
	node, ok := r.adapter.GetNode(r.entry)
	if !ok || node == nil {
		return fmt.Errorf("目标节点不存在: %s", r.entry)
	}
	if node.Action == nil {
		return fmt.Errorf("目标节点没有 action: %s", r.entry)
	}
	ensureActionDefaults(node.Action)

	r.emitDirectEvent("node", "starting", "running", "", "")
	r.emitDirectEvent("action", "starting", "running", "", "")

	job, err := r.adapter.PostAction(node.Action.Type, node.Action.Param, maa.Rect{}, nil)
	if err != nil {
		return err
	}
	if err := job.Error(); err != nil {
		return err
	}
	r.taskJob = job
	return nil
}

func (r *Runtime) singleNodeOverride() (map[string]interface{}, error) {
	override, err := cloneOverride(r.override)
	if err != nil {
		return nil, err
	}
	node, ok := override[r.entry].(map[string]interface{})
	if !ok {
		if raw, exists := r.adapter.GetNodeJSON(r.entry); exists {
			var parsed map[string]interface{}
			if err := json.Unmarshal([]byte(raw), &parsed); err == nil {
				node = parsed
			}
		}
	}
	if node == nil {
		return nil, fmt.Errorf("无法构造单节点运行 override: %s", r.entry)
	}
	node["next"] = []interface{}{}
	node["on_error"] = []interface{}{}
	override[r.entry] = node
	return override, nil
}

func (r *Runtime) emitDirectCompletion(job *maa.TaskJob, status maa.Status) {
	phase := "failed"
	if status.Success() && job.Error() == nil {
		phase = "succeeded"
	}
	detailRef := r.storeDirectDetail(job)
	switch r.mode {
	case protocol.RunModeRecognitionOnly:
		r.emitDirectEvent("recognition", phase, status.String(), detailRef, r.screenshotRef)
	case protocol.RunModeActionOnly:
		r.emitDirectEvent("action", phase, status.String(), detailRef, "")
	}
	r.emitDirectEvent("node", phase, status.String(), detailRef, r.screenshotRef)
}

func (r *Runtime) emitDirectEvent(kind string, phase string, status string, detailRef string, screenshotRef string) {
	if r.emit == nil {
		return
	}
	r.emit(protocol.Event{
		SessionID:     r.sessionID,
		RunID:         r.runID,
		Source:        "localbridge",
		Kind:          kind,
		Phase:         phase,
		Status:        status,
		Node:          r.eventNode(),
		DetailRef:     detailRef,
		ScreenshotRef: screenshotRef,
		Data: map[string]interface{}{
			"mode":  r.mode,
			"entry": r.entry,
		},
	})
}

func (r *Runtime) storeDirectDetail(job *maa.TaskJob) string {
	if job == nil || r.artifacts == nil {
		return ""
	}
	detail, err := job.GetDetail()
	if err != nil || detail == nil {
		if err != nil {
			logger.Warn("DebugVNext", "读取 direct task detail 失败: %v", err)
		}
		return ""
	}

	taskData := events.SummarizeTaskDetail(detail)
	taskRef, err := r.artifacts.AddJSON(r.sessionID, "task-detail", taskData)
	if err != nil {
		logger.Warn("DebugVNext", "写入 direct task detail artifact 失败: %v", err)
	}

	for _, node := range detail.NodeDetails {
		if node == nil {
			continue
		}
		if r.mode == protocol.RunModeRecognitionOnly && node.Recognition != nil {
			if ref := r.storeRecognitionDetail(node.Recognition); ref != "" {
				return ref
			}
		}
		if r.mode == protocol.RunModeActionOnly && node.Action != nil {
			if ref := r.storeActionDetail(node.Action); ref != "" {
				return ref
			}
		}
	}

	return taskRef.ID
}

func (r *Runtime) storeRecognitionDetail(detail *maa.RecognitionDetail) string {
	data := events.SummarizeRecognitionDetail(detail)
	if r.policy.IncludeRawImage && detail != nil && detail.Raw != nil {
		if ref, err := r.artifacts.AddPNG(r.sessionID, "recognition-raw-image", detail.Raw); err == nil {
			data["rawImageRef"] = ref.ID
		}
	}
	if r.policy.IncludeDrawImage && detail != nil && len(detail.Draws) > 0 {
		drawRefs := make([]string, 0, len(detail.Draws))
		for _, img := range detail.Draws {
			if img == nil {
				continue
			}
			if ref, err := r.artifacts.AddPNG(r.sessionID, "recognition-draw-image", img); err == nil {
				drawRefs = append(drawRefs, ref.ID)
			}
		}
		if len(drawRefs) > 0 {
			data["drawImageRefs"] = drawRefs
		}
	}
	if r.screenshotRef != "" {
		data["screenshotRef"] = r.screenshotRef
	}
	ref, err := r.artifacts.AddJSON(r.sessionID, "recognition-detail", data)
	if err != nil {
		logger.Warn("DebugVNext", "写入 direct recognition detail artifact 失败: %v", err)
		return ""
	}
	return ref.ID
}

func (r *Runtime) storeActionDetail(detail *maa.ActionDetail) string {
	ref, err := r.artifacts.AddJSON(r.sessionID, "action-detail", events.SummarizeActionDetail(detail))
	if err != nil {
		logger.Warn("DebugVNext", "写入 direct action detail artifact 失败: %v", err)
		return ""
	}
	return ref.ID
}

func (r *Runtime) storeRecognitionInput(img image.Image) {
	if r.artifacts == nil || img == nil {
		return
	}
	ref, err := r.artifacts.AddPNG(r.sessionID, "recognition-input", img)
	if err != nil {
		logger.Warn("DebugVNext", "写入识别输入图 artifact 失败: %v", err)
		return
	}
	r.screenshotRef = ref.ID
}

func (r *Runtime) connectAgents(agents []protocol.AgentProfile) error {
	for _, agent := range agents {
		if !agent.Enabled {
			continue
		}
		prepared, err := r.prepareAgent(agent)
		if err != nil {
			if requiredAgent(agent) {
				return err
			}
			r.emitAgentDiagnostic(agent, "warning", "debug.agent.prepare_failed", err.Error(), nil, nil)
			continue
		}

		client, err := createAgentClient(prepared)
		if err != nil {
			if requiredAgent(prepared) {
				return err
			}
			r.emitAgentDiagnostic(prepared, "warning", "debug.agent.create_failed", err.Error(), nil, nil)
			continue
		}
		if prepared.TimeoutMS > 0 {
			if err := client.SetTimeout(time.Duration(prepared.TimeoutMS) * time.Millisecond); err != nil {
				client.Destroy()
				if requiredAgent(prepared) {
					return err
				}
				r.emitAgentDiagnostic(prepared, "warning", "debug.agent.timeout_failed", err.Error(), nil, nil)
				continue
			}
		}
		if resource := r.adapter.GetResource(); resource != nil {
			if err := client.BindResource(resource); err != nil {
				client.Destroy()
				if requiredAgent(prepared) {
					return err
				}
				r.emitAgentDiagnostic(prepared, "warning", "debug.agent.bind_resource_failed", err.Error(), nil, nil)
				continue
			}
		}
		if tasker := r.adapter.GetTasker(); tasker != nil {
			if err := client.RegisterTaskerSink(*tasker); err != nil {
				r.emitAgentDiagnostic(prepared, "warning", "debug.agent.register_tasker_sink_failed", err.Error(), nil, nil)
			}
		}
		if controller := r.adapter.GetController(); controller != nil {
			if err := client.RegisterControllerSink(*controller); err != nil {
				r.emitAgentDiagnostic(prepared, "warning", "debug.agent.register_controller_sink_failed", err.Error(), nil, nil)
			}
		}
		if err := connectAgent(prepared, client); err != nil {
			client.Destroy()
			if requiredAgent(prepared) {
				return err
			}
			r.emitAgentDiagnostic(prepared, "warning", "debug.agent.connect_failed", err.Error(), nil, nil)
			continue
		}
		r.agentClients = append(r.agentClients, client)
		recognitions, _ := client.GetCustomRecognitionList()
		actions, _ := client.GetCustomActionList()
		r.emitAgentDiagnostic(prepared, "info", "debug.agent.connected", "agent 已连接", recognitions, actions)
	}
	return nil
}

func (r *Runtime) prepareAgent(agent protocol.AgentProfile) (protocol.AgentProfile, error) {
	prepared := agent
	if prepared.Transport == "tcp" {
		if prepared.TCPPort <= 0 {
			return prepared, fmt.Errorf("tcp agent 缺少 tcpPort: %s", prepared.ID)
		}
		return prepared, nil
	}
	if strings.TrimSpace(prepared.Identifier) == "" {
		return prepared, fmt.Errorf("identifier agent 缺少 identifier: %s", prepared.ID)
	}
	prepared.Transport = "identifier"
	return prepared, nil
}

func (r *Runtime) emitAgentDiagnostic(agent protocol.AgentProfile, severity string, code string, message string, recognitions []string, actions []string) {
	if r.emit == nil {
		return
	}
	data := map[string]interface{}{
		"severity":  severity,
		"code":      code,
		"message":   message,
		"agentId":   agent.ID,
		"transport": agent.Transport,
	}
	if recognitions != nil {
		data["customRecognitions"] = recognitions
	}
	if actions != nil {
		data["customActions"] = actions
	}
	r.emit(protocol.Event{
		SessionID: r.sessionID,
		RunID:     r.runID,
		Source:    "localbridge",
		Kind:      "diagnostic",
		Phase:     "completed",
		Status:    severity,
		Data:      data,
	})
}

func (r *Runtime) eventNode() *protocol.EventNode {
	if r.target != nil {
		return &protocol.EventNode{
			RuntimeName: r.target.RuntimeName,
			FileID:      r.target.FileID,
			NodeID:      r.target.NodeID,
			Label:       r.labelForRuntimeName(r.target.RuntimeName),
		}
	}
	return &protocol.EventNode{RuntimeName: r.entry, Label: r.labelForRuntimeName(r.entry)}
}

func (r *Runtime) labelForRuntimeName(runtimeName string) string {
	for _, node := range r.resolver.Nodes {
		if node.RuntimeName == runtimeName {
			return node.DisplayName
		}
	}
	return ""
}

func (r *Runtime) entryExists(override map[string]interface{}) bool {
	if _, ok := override[r.entry]; ok {
		return true
	}
	if r.adapter == nil {
		return false
	}
	_, ok := r.adapter.GetNodeJSON(r.entry)
	return ok
}

func normalizeResourcePaths(paths []string) []string {
	return runutil.NonEmptyResourcePaths(paths)
}

func isDirectMode(mode protocol.RunMode) bool {
	return mode == protocol.RunModeRecognitionOnly ||
		mode == protocol.RunModeActionOnly
}

func cloneOverride(override map[string]interface{}) (map[string]interface{}, error) {
	data, err := json.Marshal(override)
	if err != nil {
		return nil, fmt.Errorf("序列化 pipeline override 失败: %w", err)
	}
	var cloned map[string]interface{}
	if err := json.Unmarshal(data, &cloned); err != nil {
		return nil, fmt.Errorf("复制 pipeline override 失败: %w", err)
	}
	return cloned, nil
}

func ensureRecognitionDefaults(recognition *maa.Recognition) {
	if recognition.Type == "" {
		recognition.Type = maa.RecognitionTypeDirectHit
	}
	if recognition.Param == nil {
		recognition.Param = &maa.DirectHitParam{}
	}
}

func ensureActionDefaults(action *maa.Action) {
	if action.Type == "" {
		action.Type = maa.ActionTypeDoNothing
	}
	if action.Param == nil {
		action.Param = &maa.DoNothingParam{}
	}
}

func createAgentClient(agent protocol.AgentProfile) (*maa.AgentClient, error) {
	switch agent.Transport {
	case "tcp":
		return maa.NewAgentClient(maa.WithTcpPort(uint16(agent.TCPPort)))
	default:
		return maa.NewAgentClient(maa.WithIdentifier(agent.Identifier))
	}
}

func connectAgent(agent protocol.AgentProfile, client *maa.AgentClient) error {
	return client.Connect()
}

func requiredAgent(agent protocol.AgentProfile) bool {
	return agent.Required == nil || *agent.Required
}

func emitResourceLoadDiagnostics(sessionID string, runID string, emit events.EmitFunc, status string, paths []string, err error) {
	if emit == nil {
		return
	}
	emit(protocol.Event{
		SessionID: sessionID,
		RunID:     runID,
		Source:    "localbridge",
		Kind:      "diagnostic",
		Phase:     "starting",
		Status:    status,
		Data: map[string]interface{}{
			"severity": "info",
			"code":     "debug.resource_load.starting",
			"message":  "开始按顺序加载 resource",
			"paths":    paths,
			"error":    errorString(err),
		},
	})
}

func emitResourceLoadDiagnostic(sessionID string, runID string, emit events.EmitFunc, index int, total int, path string, status string, err error) {
	if emit == nil {
		return
	}
	severity := "info"
	phase := "completed"
	code := "debug.resource_load." + status
	if status == "starting" {
		phase = "starting"
	}
	if status == "failed" {
		severity = "error"
		phase = "failed"
	}
	emit(protocol.Event{
		SessionID: sessionID,
		RunID:     runID,
		Source:    "localbridge",
		Kind:      "diagnostic",
		Phase:     phase,
		Status:    status,
		Data: map[string]interface{}{
			"severity":   severity,
			"code":       code,
			"message":    "resource 加载" + status,
			"sourcePath": path,
			"index":      index,
			"total":      total,
			"error":      errorString(err),
		},
	})
}

func errorString(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}
