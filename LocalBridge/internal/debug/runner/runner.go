package runner

import (
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/artifact"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/diagnostics"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/performance"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/protocol"
	debugruntime "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/runtime"
	debugsession "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/session"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/trace"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/mfw"
)

type EventSender func(protocol.Event)
type SnapshotSender func(debugsession.Snapshot)

type Runner struct {
	service     *mfw.Service
	root        string
	sessions    *debugsession.Manager
	traces      *trace.Store
	artifacts   *artifact.Store
	diagnostics *diagnostics.Service
	performance *performance.Service
	agentPool   *debugruntime.AgentPool

	mu     sync.Mutex
	active map[string]*Run
}

type Run struct {
	ID        string
	SessionID string
	Mode      protocol.RunMode
	Entry     string
	StartedAt time.Time
	Runtime   *debugruntime.Runtime
	Done      chan struct{}

	mu            sync.RWMutex
	stopRequested bool
	disposed      bool
	stopReason    string
}

type StartResult struct {
	Session   debugsession.Snapshot
	SessionID string
	RunID     string
	Mode      protocol.RunMode
	Entry     string
	StartedAt string
}

func New(
	service *mfw.Service,
	sessions *debugsession.Manager,
	traces *trace.Store,
	artifacts *artifact.Store,
	root string,
) *Runner {
	return &Runner{
		service:     service,
		root:        root,
		sessions:    sessions,
		traces:      traces,
		artifacts:   artifacts,
		diagnostics: diagnostics.NewService(service, root),
		performance: performance.NewService(traces, artifacts),
		agentPool:   debugruntime.NewAgentPool(),
		active:      make(map[string]*Run),
	}
}

func (r *Runner) Start(
	req protocol.RunRequest,
	eventSender EventSender,
	snapshotSender SnapshotSender,
) (StartResult, error) {
	if req.SessionID == "" {
		return StartResult{}, fmt.Errorf("缺少必需参数: sessionId")
	}

	r.mu.Lock()
	if existing := r.active[req.SessionID]; existing != nil {
		r.mu.Unlock()
		return StartResult{}, fmt.Errorf("debug session 已有运行中的 run: %s", existing.ID)
	}
	r.mu.Unlock()

	runID := uuid.NewString()
	entry, err := debugruntime.EntryForRequest(req)
	if err != nil {
		return StartResult{}, err
	}

	preparingSnapshot, err := r.sessions.SetPreparing(req.SessionID, runID)
	if err != nil {
		return StartResult{}, err
	}
	sendSnapshot(snapshotSender, preparingSnapshot)
	r.emit(eventSender, protocol.Event{
		SessionID: req.SessionID,
		RunID:     runID,
		Source:    "localbridge",
		Kind:      "session",
		Phase:     "starting",
		Status:    "preparing",
		Data: map[string]interface{}{
			"mode":  req.Mode,
			"entry": entry,
		},
	})

	preflightDiagnostics := r.diagnostics.CheckRun(req)
	r.emitDiagnostics(req.SessionID, runID, preflightDiagnostics, eventSender)
	if diagnostics.HasBlockingDiagnostic(preflightDiagnostics) {
		err := diagnostics.FirstError(preflightDiagnostics)
		r.failStart(req.SessionID, runID, err, eventSender, snapshotSender)
		return StartResult{}, err
	}

	runtime, err := debugruntime.New(r.service, r.root, req.SessionID, runID, req, r.artifacts, r.agentPool, r.emitFunc(eventSender))
	if err != nil {
		r.failStart(req.SessionID, runID, err, eventSender, snapshotSender)
		return StartResult{}, err
	}

	run := &Run{
		ID:        runID,
		SessionID: req.SessionID,
		Mode:      req.Mode,
		Entry:     entry,
		StartedAt: time.Now().UTC(),
		Runtime:   runtime,
		Done:      make(chan struct{}),
	}

	r.mu.Lock()
	if existing := r.active[req.SessionID]; existing != nil {
		r.mu.Unlock()
		runtime.Destroy()
		return StartResult{}, fmt.Errorf("debug session 已有运行中的 run: %s", existing.ID)
	}
	r.active[req.SessionID] = run
	r.mu.Unlock()

	if err := runtime.Start(); err != nil {
		r.unregister(run)
		runtime.Destroy()
		r.failStart(req.SessionID, runID, err, eventSender, snapshotSender)
		return StartResult{}, err
	}

	runningSnapshot, err := r.sessions.SetRunning(req.SessionID, runID)
	if err != nil {
		r.unregister(run)
		runtime.Stop()
		runtime.Destroy()
		return StartResult{}, err
	}
	sendSnapshot(snapshotSender, runningSnapshot)
	r.emit(eventSender, protocol.Event{
		SessionID: req.SessionID,
		RunID:     runID,
		Source:    "localbridge",
		Kind:      "task",
		Phase:     "starting",
		Status:    "running",
		Data: map[string]interface{}{
			"mode":  req.Mode,
			"entry": entry,
		},
	})

	go r.wait(run, eventSender, snapshotSender)

	return StartResult{
		Session:   runningSnapshot,
		SessionID: req.SessionID,
		RunID:     runID,
		Mode:      req.Mode,
		Entry:     entry,
		StartedAt: run.StartedAt.Format(time.RFC3339Nano),
	}, nil
}

func (r *Runner) Stop(
	sessionID string,
	runID string,
	reason string,
	eventSender EventSender,
	snapshotSender SnapshotSender,
) error {
	run := r.activeRun(sessionID)
	if run == nil {
		return fmt.Errorf("debug session 没有运行中的 run: %s", sessionID)
	}
	if runID != "" && run.ID != runID {
		return fmt.Errorf("runId 不匹配: active=%s request=%s", run.ID, runID)
	}

	if !run.markStopRequested(reason) {
		return nil
	}
	snapshot, err := r.sessions.SetStopping(sessionID)
	if err != nil {
		return err
	}
	sendSnapshot(snapshotSender, snapshot)
	r.emit(eventSender, protocol.Event{
		SessionID: sessionID,
		RunID:     run.ID,
		Source:    "localbridge",
		Kind:      "session",
		Phase:     "starting",
		Status:    "stopping",
		Data: map[string]interface{}{
			"reason": reason,
		},
	})

	return run.Runtime.Stop()
}

func (r *Runner) DisposeSession(sessionID string) {
	run := r.activeRun(sessionID)
	if run != nil {
		run.markDisposed()
		if err := run.Runtime.Stop(); err != nil {
			logger.Warn("DebugVNext", "销毁 session 时停止 run 失败: %v", err)
		}
		select {
		case <-run.Done:
		case <-time.After(5 * time.Second):
			logger.Warn("DebugVNext", "等待 debug run 停止超时，强制释放 runtime: %s", run.ID)
			run.Runtime.Destroy()
		}
		r.unregister(run)
	}
	r.traces.DeleteSession(sessionID)
	r.artifacts.DeleteSession(sessionID)
}

func (r *Runner) ArtifactStore() *artifact.Store {
	return r.artifacts
}

func (r *Runner) AgentPool() *debugruntime.AgentPool {
	return r.agentPool
}

func (r *Runner) failStart(
	sessionID string,
	runID string,
	err error,
	eventSender EventSender,
	snapshotSender SnapshotSender,
) {
	snapshot, snapshotErr := r.sessions.SetFailed(sessionID)
	if snapshotErr == nil {
		sendSnapshot(snapshotSender, snapshot)
	}
	r.emit(eventSender, protocol.Event{
		SessionID: sessionID,
		RunID:     runID,
		Source:    "localbridge",
		Kind:      "session",
		Phase:     "failed",
		Status:    "failed",
		Data: map[string]interface{}{
			"error": err.Error(),
		},
	})
}

func (r *Runner) wait(run *Run, eventSender EventSender, snapshotSender SnapshotSender) {
	defer close(run.Done)
	result := run.Runtime.Wait()
	run.Runtime.Destroy()

	if !r.unregister(run) || run.isDisposed() {
		return
	}

	if run.wasStopRequested() {
		terminalEvent, ok := r.appendTerminalEventWithPerformanceSummary(run, protocol.Event{
			SessionID: run.SessionID,
			RunID:     run.ID,
			Source:    "localbridge",
			Kind:      "session",
			Phase:     "completed",
			Status:    "stopped",
			Data: map[string]interface{}{
				"status": result.Status,
				"reason": run.stopReasonOrDefault(),
			},
		})
		snapshot, err := r.sessions.SetCompleted(run.SessionID)
		if err == nil {
			sendSnapshot(snapshotSender, snapshot)
		}
		if ok {
			sendAppendedEvent(eventSender, terminalEvent)
		}
		return
	}

	if result.OK {
		terminalEvent, ok := r.appendTerminalEventWithPerformanceSummary(run, protocol.Event{
			SessionID: run.SessionID,
			RunID:     run.ID,
			Source:    "localbridge",
			Kind:      "session",
			Phase:     "completed",
			Status:    "completed",
			Data: map[string]interface{}{
				"status": result.Status,
			},
		})
		snapshot, err := r.sessions.SetCompleted(run.SessionID)
		if err == nil {
			sendSnapshot(snapshotSender, snapshot)
		}
		if ok {
			sendAppendedEvent(eventSender, terminalEvent)
		}
		return
	}

	data := map[string]interface{}{
		"status": result.Status,
	}
	if result.Err != nil {
		data["error"] = result.Err.Error()
	}
	terminalEvent, ok := r.appendTerminalEventWithPerformanceSummary(run, protocol.Event{
		SessionID: run.SessionID,
		RunID:     run.ID,
		Source:    "localbridge",
		Kind:      "session",
		Phase:     "failed",
		Status:    "failed",
		Data:      data,
	})
	snapshot, err := r.sessions.SetFailed(run.SessionID)
	if err == nil {
		sendSnapshot(snapshotSender, snapshot)
	}
	if ok {
		sendAppendedEvent(eventSender, terminalEvent)
	}
}

func (r *Runner) storePerformanceSummary(run *Run) string {
	ref, _, err := r.performance.Store(run.SessionID, run.ID)
	if err != nil {
		logger.Warn("DebugVNext", "写入 performance summary artifact 失败: %v", err)
		return ""
	}
	return ref.ID
}

func (r *Runner) appendTerminalEventWithPerformanceSummary(run *Run, event protocol.Event) (protocol.Event, bool) {
	appended, err := r.traces.Append(event)
	if err != nil {
		logger.Warn("DebugVNext", "写入 trace 失败: %v", err)
		return protocol.Event{}, false
	}

	performanceRef := r.storePerformanceSummary(run)
	if performanceRef == "" {
		return appended, true
	}

	updated, err := r.traces.AttachDetailRef(appended.SessionID, appended.Seq, performanceRef, map[string]interface{}{
		"performanceSummaryRef": performanceRef,
	})
	if err != nil {
		logger.Warn("DebugVNext", "回填 performance summary trace 引用失败: %v", err)
	} else {
		appended = updated
	}
	r.artifacts.SetEventSeq(appended.SessionID, performanceRef, appended.Seq)
	return appended, true
}

func (r *Runner) emitFunc(sender EventSender) func(protocol.Event) {
	return func(event protocol.Event) {
		r.emit(sender, event)
	}
}

func (r *Runner) emit(sender EventSender, event protocol.Event) {
	appended, err := r.traces.Append(event)
	if err != nil {
		logger.Warn("DebugVNext", "写入 trace 失败: %v", err)
		return
	}
	if appended.DetailRef != "" {
		r.artifacts.SetEventSeq(appended.SessionID, appended.DetailRef, appended.Seq)
	}
	if appended.ScreenshotRef != "" {
		r.artifacts.SetEventSeq(appended.SessionID, appended.ScreenshotRef, appended.Seq)
	}
	if sender != nil {
		sender(appended)
	}
}

func sendAppendedEvent(sender EventSender, event protocol.Event) {
	if sender != nil {
		sender(event)
	}
}

func (r *Runner) emitDiagnostics(sessionID string, runID string, values []protocol.Diagnostic, sender EventSender) {
	for _, diagnostic := range values {
		data := map[string]interface{}{
			"severity":   diagnostic.Severity,
			"code":       diagnostic.Code,
			"message":    diagnostic.Message,
			"fileId":     diagnostic.FileID,
			"nodeId":     diagnostic.NodeID,
			"fieldPath":  diagnostic.FieldPath,
			"sourcePath": diagnostic.SourcePath,
		}
		for key, value := range diagnostic.Data {
			data[key] = value
		}

		phase := "completed"
		if diagnostic.Severity == "error" {
			phase = "failed"
		}
		r.emit(sender, protocol.Event{
			SessionID: sessionID,
			RunID:     runID,
			Source:    "localbridge",
			Kind:      "diagnostic",
			Phase:     phase,
			Status:    diagnostic.Severity,
			Data:      data,
		})
	}
}

func (r *Runner) activeRun(sessionID string) *Run {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.active[sessionID]
}

func (r *Runner) unregister(run *Run) bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.active[run.SessionID] != run {
		return false
	}
	delete(r.active, run.SessionID)
	return true
}

func (r *Run) markStopRequested(reason string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.stopRequested {
		return false
	}
	r.stopRequested = true
	r.stopReason = reason
	return true
}

func (r *Run) markDisposed() {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.disposed = true
}

func (r *Run) wasStopRequested() bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.stopRequested
}

func (r *Run) isDisposed() bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.disposed
}

func (r *Run) stopReasonOrDefault() string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if r.stopReason != "" {
		return r.stopReason
	}
	return "user_stop"
}

func sendSnapshot(sender SnapshotSender, snapshot debugsession.Snapshot) {
	if sender != nil {
		sender(snapshot)
	}
}
