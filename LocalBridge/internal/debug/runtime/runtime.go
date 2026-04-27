package runtime

import (
	"fmt"
	"strings"
	"sync"

	maa "github.com/MaaXYZ/maa-framework-go/v4"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/artifact"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/events"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/protocol"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/mfw"
)

type Runtime struct {
	sessionID string
	runID     string
	entry     string
	override  map[string]interface{}

	adapter       *mfw.MaaFWAdapter
	taskJob       *maa.TaskJob
	contextSinkID int64
	taskerSinkID  int64

	mu sync.Mutex
}

type Result struct {
	Status string
	OK     bool
	Err    error
}

func New(
	service *mfw.Service,
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

	controllerID, err := ControllerID(req)
	if err != nil {
		return nil, err
	}
	controllerInfo, err := service.ControllerManager().GetController(controllerID)
	if err != nil {
		return nil, fmt.Errorf("获取控制器失败: %w", err)
	}
	controller, ok := controllerInfo.Controller.(*maa.Controller)
	if !ok || controller == nil {
		return nil, fmt.Errorf("控制器实例不可用: %s", controllerID)
	}
	if !controller.Connected() {
		return nil, fmt.Errorf("控制器未连接: %s", controllerID)
	}

	resourcePaths := normalizeResourcePaths(req.Profile.ResourcePaths)
	if len(resourcePaths) == 0 {
		return nil, fmt.Errorf("profile.resourcePaths 不能为空")
	}

	adapter := mfw.NewMaaFWAdapter()
	adapter.SetController(controller, controllerInfo.Type, controllerInfo.UUID)
	if err := adapter.LoadResources(resourcePaths); err != nil {
		adapter.Destroy()
		return nil, fmt.Errorf("加载资源失败: %w", err)
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

	return &Runtime{
		sessionID:     sessionID,
		runID:         runID,
		entry:         entry,
		override:      PipelineOverride(req),
		adapter:       adapter,
		contextSinkID: contextSinkID,
		taskerSinkID:  taskerSinkID,
	}, nil
}

func EntryForRequest(req protocol.RunRequest) (string, error) {
	switch req.Mode {
	case protocol.RunModeFullRun:
		entry := strings.TrimSpace(req.Profile.Entry.RuntimeName)
		if entry == "" {
			return "", fmt.Errorf("full-run 缺少 profile.entry.runtimeName")
		}
		return entry, nil
	case protocol.RunModeRunFromNode:
		if req.Target == nil {
			return "", fmt.Errorf("run-from-node 缺少 target")
		}
		entry := strings.TrimSpace(req.Target.RuntimeName)
		if entry == "" {
			return "", fmt.Errorf("run-from-node 缺少 target.runtimeName")
		}
		return entry, nil
	default:
		return "", fmt.Errorf("P2 暂不支持 run mode: %s", req.Mode)
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
	if !r.entryExists() {
		return fmt.Errorf("入口节点不存在: %s", r.entry)
	}

	logger.Info("DebugVNext", "启动调试运行: session=%s run=%s entry=%s", r.sessionID, r.runID, r.entry)
	job, err := r.adapter.PostTask(r.entry, r.override)
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

func (r *Runtime) Stop() error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.adapter == nil {
		return nil
	}
	r.adapter.PostStop()
	return nil
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
		OK:     status.Success(),
		Err:    job.Error(),
	}
}

func (r *Runtime) Destroy() {
	r.mu.Lock()
	defer r.mu.Unlock()

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

func (r *Runtime) entryExists() bool {
	if _, ok := r.override[r.entry]; ok {
		return true
	}
	if r.adapter == nil {
		return false
	}
	_, ok := r.adapter.GetNodeJSON(r.entry)
	return ok
}

func normalizeResourcePaths(paths []string) []string {
	result := make([]string, 0, len(paths))
	for _, path := range paths {
		if strings.TrimSpace(path) != "" {
			result = append(result, strings.TrimSpace(path))
		}
	}
	return result
}
