package runtime

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
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
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/utils"
)

type Runtime struct {
	sessionID     string
	runID         string
	mode          protocol.RunMode
	entry         string
	target        *protocol.NodeTarget
	input         *protocol.RunInput
	resolver      protocol.NodeResolverSnapshot
	override      map[string]interface{}
	policy        protocol.ArtifactPolicy
	resourcePaths []string

	adapter       *mfw.MaaFWAdapter
	taskJob       *maa.TaskJob
	contextSinkID int64
	taskerSinkID  int64
	agentClients  []*maa.AgentClient
	agentPool     *AgentPool

	emit events.EmitFunc

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
	agentPool *AgentPool,
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
	if err := adapter.LoadResourcesWithProgress(resourcePaths, func(index int, total int, resolution mfw.ResourceBundleResolution, status string, err error) {
		emitResourceLoadDiagnostic(sessionID, runID, emit, index, total, resolution, status, err)
	}); err != nil {
		adapter.Destroy()
		return nil, fmt.Errorf("加载资源失败: %w", err)
	}

	override, err := PipelineOverride(root, req)
	if err != nil {
		adapter.Destroy()
		return nil, err
	}
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
		resourcePaths: resourcePaths,
		adapter:       adapter,
		contextSinkID: contextSinkID,
		taskerSinkID:  taskerSinkID,
		agentPool:     agentPool,
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

func PipelineOverride(root string, req protocol.RunRequest) (map[string]interface{}, error) {
	selectedFileID, selectedSourcePath := resolveRunSource(req)

	switch req.Profile.SavePolicy {
	case "sandbox":
		if file := findGraphFileSnapshot(req, selectedFileID, selectedSourcePath); file != nil {
			return file.Pipeline, nil
		}
		if selectedSourcePath == "" {
			return nil, fmt.Errorf("sandbox 模式未找到目标文件快照: %s", selectedFileID)
		}
		return loadPipelineOverrideFromDisk(root, selectedSourcePath)
	case "save-open-files", "use-disk":
		sourcePath, err := resolveRunSourcePath(root, req, selectedFileID, selectedSourcePath)
		if err != nil {
			return nil, err
		}
		return loadPipelineOverrideFromDisk(root, sourcePath)
	default:
		return nil, fmt.Errorf("不支持的 savePolicy: %s", req.Profile.SavePolicy)
	}
}

func resolveRunSource(req protocol.RunRequest) (string, string) {
	fileID := strings.TrimSpace(req.GraphSnapshot.RootFileID)
	sourcePath := ""

	if strings.TrimSpace(req.Profile.Entry.FileID) != "" {
		fileID = strings.TrimSpace(req.Profile.Entry.FileID)
	}
	if strings.TrimSpace(req.Profile.Entry.SourcePath) != "" {
		sourcePath = strings.TrimSpace(req.Profile.Entry.SourcePath)
	}
	if req.Target != nil {
		if strings.TrimSpace(req.Target.FileID) != "" {
			fileID = strings.TrimSpace(req.Target.FileID)
		}
		if strings.TrimSpace(req.Target.SourcePath) != "" {
			sourcePath = strings.TrimSpace(req.Target.SourcePath)
		}
	}

	if sourcePath == "" {
		if file := findGraphFileSnapshot(req, fileID, ""); file != nil && strings.TrimSpace(file.Path) != "" {
			sourcePath = strings.TrimSpace(file.Path)
		}
	}

	return fileID, sourcePath
}

func findGraphFileSnapshot(
	req protocol.RunRequest,
	fileID string,
	sourcePath string,
) *protocol.GraphFileSnapshot {
	trimmedFileID := strings.TrimSpace(fileID)
	trimmedSourcePath := strings.TrimSpace(sourcePath)
	for i := range req.GraphSnapshot.Files {
		file := &req.GraphSnapshot.Files[i]
		if trimmedFileID != "" && strings.TrimSpace(file.FileID) == trimmedFileID {
			return file
		}
		if trimmedSourcePath != "" && strings.TrimSpace(file.Path) == trimmedSourcePath {
			return file
		}
	}
	return nil
}

func resolveRunSourcePath(
	root string,
	req protocol.RunRequest,
	fileID string,
	sourcePath string,
) (string, error) {
	if strings.TrimSpace(sourcePath) != "" {
		return normalizeRunSourcePath(root, sourcePath)
	}
	if file := findGraphFileSnapshot(req, fileID, ""); file != nil && strings.TrimSpace(file.Path) != "" {
		return normalizeRunSourcePath(root, file.Path)
	}
	if looksLikeJSONPath(fileID) {
		return normalizeRunSourcePath(root, fileID)
	}
	return "", fmt.Errorf("%s 模式要求目标文件已保存到磁盘", req.Profile.SavePolicy)
}

func normalizeRunSourcePath(root string, candidate string) (string, error) {
	trimmed := strings.TrimSpace(candidate)
	if trimmed == "" {
		return "", fmt.Errorf("目标文件路径为空")
	}

	resolved := filepath.Clean(trimmed)
	if root != "" && !filepath.IsAbs(resolved) {
		resolved = filepath.Join(root, resolved)
	}
	if root != "" {
		cleanRoot := filepath.Clean(root)
		rel, err := filepath.Rel(cleanRoot, resolved)
		if err != nil {
			return "", fmt.Errorf("无法校验目标文件路径: %w", err)
		}
		if rel == ".." || strings.HasPrefix(rel, fmt.Sprintf("..%c", filepath.Separator)) {
			return "", fmt.Errorf("目标文件不在工作区内: %s", resolved)
		}
	}
	return resolved, nil
}

func loadPipelineOverrideFromDisk(root string, candidate string) (map[string]interface{}, error) {
	resolved, err := normalizeRunSourcePath(root, candidate)
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(resolved)
	if err != nil {
		return nil, fmt.Errorf("读取调试目标文件失败: %w", err)
	}

	var parsed map[string]interface{}
	if err := utils.ParseJSONC(data, &parsed); err != nil {
		return nil, fmt.Errorf("解析调试目标文件失败: %w", err)
	}
	if len(parsed) == 0 {
		return nil, fmt.Errorf("调试目标文件内容为空: %s", resolved)
	}
	return parsed, nil
}

func looksLikeJSONPath(value string) bool {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return false
	}
	lower := strings.ToLower(trimmed)
	if strings.HasSuffix(lower, ".json") || strings.HasSuffix(lower, ".jsonc") {
		return true
	}
	return strings.Contains(trimmed, "/") || strings.Contains(trimmed, `\`)
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
	return Result{
		Status: status.String(),
		OK:     status.Success() && job.Error() == nil,
		Err:    job.Error(),
	}
}

func (r *Runtime) Destroy() {
	r.mu.Lock()
	defer r.mu.Unlock()

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
	override, err := r.directModeOverride(protocol.RunModeRecognitionOnly)
	if err != nil {
		return err
	}
	return r.startTask(override)
}

func (r *Runtime) startDirectAction() error {
	override, err := r.directModeOverride(protocol.RunModeActionOnly)
	if err != nil {
		return err
	}
	return r.startTask(override)
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

func (r *Runtime) directModeOverride(mode protocol.RunMode) (map[string]interface{}, error) {
	override, err := r.singleNodeOverride()
	if err != nil {
		return nil, err
	}
	node, ok := override[r.entry].(map[string]interface{})
	if !ok || node == nil {
		return nil, fmt.Errorf("failed to build direct-mode override: %s", r.entry)
	}
	switch mode {
	case protocol.RunModeRecognitionOnly:
		node["action"] = map[string]interface{}{
			"type":  string(maa.ActionTypeDoNothing),
			"param": map[string]interface{}{},
		}
	case protocol.RunModeActionOnly:
		node["recognition"] = map[string]interface{}{
			"type":  string(maa.RecognitionTypeDirectHit),
			"param": map[string]interface{}{},
		}
	default:
		return nil, fmt.Errorf("unsupported direct mode override: %s", mode)
	}
	override[r.entry] = node
	return override, nil
}

func (r *Runtime) connectAgents(agents []protocol.AgentProfile) error {
	for _, agent := range agents {
		if !agent.Enabled {
			continue
		}
		prepared, err := normalizeAgentProfile(agent)
		if err != nil {
			if requiredAgent(agent) {
				return err
			}
			r.emitAgentDiagnostic(agent, "warning", "debug.agent.prepare_failed", err.Error(), nil, nil)
			continue
		}

		client, err := r.acquireAgentClient(prepared)
		if err != nil {
			if requiredAgent(prepared) {
				return err
			}
			r.emitAgentDiagnostic(prepared, "warning", "debug.agent.create_failed", err.Error(), nil, nil)
			continue
		}
		alreadyConnected := client.Connected()
		if !alreadyConnected && prepared.TimeoutMS > 0 {
			if err := client.SetTimeout(time.Duration(prepared.TimeoutMS) * time.Millisecond); err != nil {
				if requiredAgent(prepared) {
					return err
				}
				r.emitAgentDiagnostic(prepared, "warning", "debug.agent.timeout_failed", err.Error(), nil, nil)
				continue
			}
		}
		if !alreadyConnected {
			if err := connectAgent(prepared, client); err != nil {
				if requiredAgent(prepared) {
					return err
				}
				r.emitAgentDiagnostic(prepared, "warning", "debug.agent.connect_failed", err.Error(), nil, nil)
				continue
			}
		}
		r.agentClients = append(r.agentClients, client)
		message := "agent 已连接"
		if alreadyConnected {
			message = "agent 复用已有连接"
		}
		r.emitAgentDiagnostic(prepared, "info", "debug.agent.connected", message, nil, nil)
	}
	return nil
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

func (r *Runtime) acquireAgentClient(agent protocol.AgentProfile) (*maa.AgentClient, error) {
	if r.agentPool != nil {
		return r.agentPool.EnsureBound(agent, r.resourcePaths)
	}
	client, err := createAgentClient(agent)
	if err != nil {
		return nil, err
	}
	if resource := r.adapter.GetResource(); resource != nil {
		if err := client.BindResource(resource); err != nil {
			return nil, err
		}
	}
	return client, nil
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

func emitResourceLoadDiagnostic(sessionID string, runID string, emit events.EmitFunc, index int, total int, resolution mfw.ResourceBundleResolution, status string, err error) {
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
	data := resolution.DiagnosticData()
	data["severity"] = severity
	data["code"] = code
	data["message"] = "resource 加载" + status
	data["sourcePath"] = resolution.InputPath
	data["index"] = index
	data["total"] = total
	data["error"] = errorString(err)
	emit(protocol.Event{
		SessionID: sessionID,
		RunID:     runID,
		Source:    "localbridge",
		Kind:      "diagnostic",
		Phase:     phase,
		Status:    status,
		Data:      data,
	})
}

func errorString(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}
