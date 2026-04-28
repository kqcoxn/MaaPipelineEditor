package batch

import (
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/artifact"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/protocol"
	debugruntime "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/runtime"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/trace"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/mfw"
)

type EventSender func(protocol.Event)

type Service struct {
	service   *mfw.Service
	root      string
	traces    *trace.Store
	artifacts *artifact.Store

	mu     sync.Mutex
	active map[string]*Run
}

type Run struct {
	ID        string
	SessionID string
	stop      chan struct{}
	done      chan struct{}
}

func New(service *mfw.Service, root string, traces *trace.Store, artifacts *artifact.Store) *Service {
	return &Service{
		service:   service,
		root:      root,
		traces:    traces,
		artifacts: artifacts,
		active:    make(map[string]*Run),
	}
}

func (s *Service) Start(req protocol.BatchRecognitionRequest, sender EventSender) (protocol.BatchRecognitionResult, error) {
	if err := ValidateRequest(req); err != nil {
		return protocol.BatchRecognitionResult{}, err
	}
	sessionID := strings.TrimSpace(req.SessionID)
	batchID := uuid.NewString()
	run := &Run{ID: batchID, SessionID: sessionID, stop: make(chan struct{}), done: make(chan struct{})}

	s.mu.Lock()
	if existing := s.active[sessionID]; existing != nil {
		s.mu.Unlock()
		return protocol.BatchRecognitionResult{}, fmt.Errorf("debug session 已有运行中的 batch-recognition: %s", existing.ID)
	}
	s.active[sessionID] = run
	s.mu.Unlock()

	result := protocol.BatchRecognitionResult{
		SessionID: sessionID,
		BatchID:   batchID,
		Target:    req.Target,
		Status:    "running",
		StartedAt: time.Now().UTC().Format(time.RFC3339Nano),
		Total:     len(req.Images),
		Results:   make([]protocol.BatchRecognitionImageResult, 0, len(req.Images)),
	}

	s.emit(sender, protocol.Event{
		SessionID: sessionID,
		RunID:     batchID,
		Source:    "localbridge",
		Kind:      "session",
		Phase:     "starting",
		Status:    "running",
		Node:      eventNode(req.Target),
		Data: map[string]interface{}{
			"mode":      "batch-recognition",
			"entry":     req.Target.RuntimeName,
			"batchId":   batchID,
			"imageSize": len(req.Images),
		},
	})

	go s.run(run, req, result, sender)
	return result, nil
}

func (s *Service) Stop(req protocol.BatchRecognitionStopRequest) (protocol.BatchRecognitionResult, error) {
	sessionID := strings.TrimSpace(req.SessionID)
	if sessionID == "" {
		return protocol.BatchRecognitionResult{}, fmt.Errorf("缺少 sessionId")
	}
	run := s.activeRun(sessionID)
	if run == nil {
		return protocol.BatchRecognitionResult{}, fmt.Errorf("debug session 没有运行中的 batch-recognition: %s", sessionID)
	}
	if req.BatchID != "" && req.BatchID != run.ID {
		return protocol.BatchRecognitionResult{}, fmt.Errorf("batchId 不匹配: active=%s request=%s", run.ID, req.BatchID)
	}
	select {
	case <-run.stop:
	default:
		close(run.stop)
	}
	return protocol.BatchRecognitionResult{
		SessionID: sessionID,
		BatchID:   run.ID,
		Status:    "stopping",
		Stopped:   true,
	}, nil
}

func (s *Service) StopSession(sessionID string) {
	run := s.activeRun(sessionID)
	if run == nil {
		return
	}
	select {
	case <-run.stop:
	default:
		close(run.stop)
	}
	select {
	case <-run.done:
	case <-time.After(5 * time.Second):
		logger.Warn("DebugVNext", "等待 batch-recognition 停止超时: %s", run.ID)
	}
}

func (s *Service) run(run *Run, req protocol.BatchRecognitionRequest, result protocol.BatchRecognitionResult, sender EventSender) {
	defer close(run.done)
	defer s.unregister(run)

	var totalDuration int64
	for index, input := range req.Images {
		select {
		case <-run.stop:
			result.Stopped = true
			result.Status = "stopped"
			s.finish(result, sender)
			return
		default:
		}

		start := time.Now()
		item := protocol.BatchRecognitionImageResult{
			Index:             index,
			ImagePath:         input.ImagePath,
			ImageRelativePath: input.ImageRelativePath,
			Status:            "running",
		}
		s.emit(sender, protocol.Event{
			SessionID: req.SessionID,
			RunID:     run.ID,
			Source:    "localbridge",
			Kind:      "recognition",
			Phase:     "starting",
			Status:    "running",
			Node:      eventNode(req.Target),
			Data: map[string]interface{}{
				"mode":              "batch-recognition",
				"batchId":           run.ID,
				"index":             index,
				"imagePath":         input.ImagePath,
				"imageRelativePath": input.ImageRelativePath,
			},
		})

		runID := run.ID + "-" + fmt.Sprintf("%04d", index+1)
		runReq := batchRunRequest(req, input)
		item.RunID = runID
		runtime, err := debugruntime.New(s.service, s.root, req.SessionID, runID, runReq, s.artifacts, s.emitFunc(sender))
		if err == nil {
			err = runtime.Start()
		}
		if err == nil {
			waitResult := runtime.Wait()
			if !waitResult.OK {
				err = waitResult.Err
				if err == nil {
					err = fmt.Errorf("recognition status: %s", waitResult.Status)
				}
			}
		}
		if runtime != nil {
			runtime.Destroy()
		}

		item.DurationMs = time.Since(start).Milliseconds()
		totalDuration += item.DurationMs
		item.DetailRefs, item.ScreenshotRefs = refsForRun(s.traces.ListRun(req.SessionID, runID))
		if err != nil {
			item.Status = "failed"
			item.Error = err.Error()
			result.Failed++
			s.emit(sender, protocol.Event{
				SessionID: req.SessionID,
				RunID:     run.ID,
				Source:    "localbridge",
				Kind:      "recognition",
				Phase:     "failed",
				Status:    "failed",
				Node:      eventNode(req.Target),
				Data: map[string]interface{}{
					"mode":    "batch-recognition",
					"batchId": run.ID,
					"index":   index,
					"error":   err.Error(),
				},
			})
		} else {
			item.Status = "succeeded"
			hit := true
			item.Hit = &hit
			result.Succeeded++
			s.emit(sender, protocol.Event{
				SessionID:     req.SessionID,
				RunID:         run.ID,
				Source:        "localbridge",
				Kind:          "recognition",
				Phase:         "succeeded",
				Status:        "succeeded",
				Node:          eventNode(req.Target),
				DetailRef:     firstString(item.DetailRefs),
				ScreenshotRef: firstString(item.ScreenshotRefs),
				Data: map[string]interface{}{
					"mode":       "batch-recognition",
					"batchId":    run.ID,
					"index":      index,
					"durationMs": item.DurationMs,
				},
			})
		}
		result.Completed++
		result.Results = append(result.Results, item)
	}

	if result.Failed > 0 {
		result.Status = "failed"
	} else {
		result.Status = "completed"
	}
	if result.Completed > 0 {
		result.AverageDurationMs = totalDuration / int64(result.Completed)
	}
	s.finish(result, sender)
}

func (s *Service) finish(result protocol.BatchRecognitionResult, sender EventSender) {
	result.CompletedAt = time.Now().UTC().Format(time.RFC3339Nano)
	ref, err := s.artifacts.AddJSON(result.SessionID, "batch-recognition-summary", result)
	if err != nil {
		logger.Warn("DebugVNext", "写入 batch-recognition summary artifact 失败: %v", err)
	} else {
		result.SummaryArtifactRef = ref.ID
	}
	phase := "completed"
	if result.Status == "failed" {
		phase = "failed"
	}
	s.emit(sender, protocol.Event{
		SessionID: result.SessionID,
		RunID:     result.BatchID,
		Source:    "localbridge",
		Kind:      "session",
		Phase:     phase,
		Status:    result.Status,
		Node:      eventNode(result.Target),
		DetailRef: result.SummaryArtifactRef,
		Data: map[string]interface{}{
			"mode":              "batch-recognition",
			"batchId":           result.BatchID,
			"completed":         result.Completed,
			"succeeded":         result.Succeeded,
			"failed":            result.Failed,
			"averageDurationMs": result.AverageDurationMs,
			"stopped":           result.Stopped,
		},
	})
}

func ValidateRequest(req protocol.BatchRecognitionRequest) error {
	if strings.TrimSpace(req.SessionID) == "" {
		return fmt.Errorf("缺少必需参数: sessionId")
	}
	if !isCompleteTarget(req.Target) {
		return fmt.Errorf("batch-recognition 需要完整 target")
	}
	if len(req.Images) == 0 {
		return fmt.Errorf("batch-recognition images 不能为空")
	}
	if len(req.Images) > 500 {
		return fmt.Errorf("batch-recognition images 不能超过 500")
	}
	if len(req.Profile.ResourcePaths) == 0 {
		return fmt.Errorf("profile.resourcePaths 不能为空")
	}
	if len(req.GraphSnapshot.Files) == 0 {
		return fmt.Errorf("graphSnapshot.files 不能为空")
	}
	if len(req.ResolverSnapshot.Nodes) == 0 {
		return fmt.Errorf("resolverSnapshot.nodes 不能为空")
	}
	for i, image := range req.Images {
		if strings.TrimSpace(image.ImagePath) == "" && strings.TrimSpace(image.ImageRelativePath) == "" {
			return fmt.Errorf("images[%d] 缺少 imagePath 或 imageRelativePath", i)
		}
	}
	return nil
}

func (s *Service) emitFunc(sender EventSender) func(protocol.Event) {
	return func(event protocol.Event) {
		s.emit(sender, event)
	}
}

func (s *Service) emit(sender EventSender, event protocol.Event) {
	appended, err := s.traces.Append(event)
	if err != nil {
		logger.Warn("DebugVNext", "写入 batch trace 失败: %v", err)
		return
	}
	if appended.DetailRef != "" {
		s.artifacts.SetEventSeq(appended.SessionID, appended.DetailRef, appended.Seq)
	}
	if appended.ScreenshotRef != "" {
		s.artifacts.SetEventSeq(appended.SessionID, appended.ScreenshotRef, appended.Seq)
	}
	if sender != nil {
		sender(appended)
	}
}

func (s *Service) activeRun(sessionID string) *Run {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.active[sessionID]
}

func (s *Service) unregister(run *Run) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.active[run.SessionID] == run {
		delete(s.active, run.SessionID)
	}
}

func batchRunRequest(req protocol.BatchRecognitionRequest, input protocol.BatchRecognitionInput) protocol.RunRequest {
	runInput := &protocol.RunInput{
		ImagePath:         input.ImagePath,
		ImageRelativePath: input.ImageRelativePath,
	}
	return protocol.RunRequest{
		SessionID:        req.SessionID,
		ProfileID:        req.ProfileID,
		Profile:          req.Profile,
		Mode:             protocol.RunModeFixedImageRecognition,
		GraphSnapshot:    req.GraphSnapshot,
		ResolverSnapshot: req.ResolverSnapshot,
		Target:           &req.Target,
		Overrides:        req.Overrides,
		ArtifactPolicy:   req.ArtifactPolicy,
		Input:            runInput,
	}
}

func refsForRun(events []protocol.Event) ([]string, []string) {
	details := []string{}
	screenshots := []string{}
	seenDetails := map[string]struct{}{}
	seenScreenshots := map[string]struct{}{}
	for _, event := range events {
		if event.DetailRef != "" {
			if _, ok := seenDetails[event.DetailRef]; !ok {
				seenDetails[event.DetailRef] = struct{}{}
				details = append(details, event.DetailRef)
			}
		}
		if event.ScreenshotRef != "" {
			if _, ok := seenScreenshots[event.ScreenshotRef]; !ok {
				seenScreenshots[event.ScreenshotRef] = struct{}{}
				screenshots = append(screenshots, event.ScreenshotRef)
			}
		}
	}
	return details, screenshots
}

func eventNode(target protocol.NodeTarget) *protocol.EventNode {
	return &protocol.EventNode{
		RuntimeName: target.RuntimeName,
		FileID:      target.FileID,
		NodeID:      target.NodeID,
	}
}

func isCompleteTarget(target protocol.NodeTarget) bool {
	return strings.TrimSpace(target.FileID) != "" &&
		strings.TrimSpace(target.NodeID) != "" &&
		strings.TrimSpace(target.RuntimeName) != ""
}

func firstString(values []string) string {
	if len(values) == 0 {
		return ""
	}
	return values[0]
}
