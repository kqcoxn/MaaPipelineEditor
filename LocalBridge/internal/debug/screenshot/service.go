package screenshot

import (
	"context"
	"fmt"
	"image"
	"sync"
	"time"

	maa "github.com/MaaXYZ/maa-framework-go/v4"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/artifact"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/protocol"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/mfw"
)

const (
	DefaultStreamIntervalMS = 1000
	MinStreamIntervalMS     = 250
)

type EventEmitter func(protocol.Event)

type Service struct {
	mfwService *mfw.Service
	artifacts  *artifact.Store

	mu      sync.Mutex
	streams map[string]*stream
}

type stream struct {
	sessionID    string
	runID        string
	controllerID string
	interval     time.Duration
	intervalMS   int
	force        bool
	maxFrames    int
	startedAt    time.Time
	cancel       context.CancelFunc
	done         chan struct{}

	mu         sync.RWMutex
	frameCount int64
}

func NewService(mfwService *mfw.Service, artifacts *artifact.Store) *Service {
	return &Service{
		mfwService: mfwService,
		artifacts:  artifacts,
		streams:    make(map[string]*stream),
	}
}

func (s *Service) Capture(sessionID string, controllerID string, force bool) (protocol.ArtifactRef, image.Rectangle, error) {
	ctrl, err := s.controller(controllerID)
	if err != nil {
		return protocol.ArtifactRef{}, image.Rectangle{}, err
	}
	img, err := cachedOrFreshImage(ctrl, force)
	if err != nil {
		return protocol.ArtifactRef{}, image.Rectangle{}, err
	}
	ref, err := s.artifacts.AddPNG(sessionID, "screenshot", img)
	if err != nil {
		return protocol.ArtifactRef{}, image.Rectangle{}, err
	}
	return ref, img.Bounds(), nil
}

func (s *Service) Start(req protocol.ScreenshotStreamStartRequest, emit EventEmitter) (protocol.ScreenshotStreamStatus, error) {
	if req.SessionID == "" {
		return protocol.ScreenshotStreamStatus{}, fmt.Errorf("缺少 sessionId")
	}
	if req.ControllerID == "" {
		return protocol.ScreenshotStreamStatus{}, fmt.Errorf("缺少 controllerId")
	}
	if s.artifacts == nil {
		return protocol.ScreenshotStreamStatus{}, fmt.Errorf("artifact store 不可用")
	}
	if _, err := s.controller(req.ControllerID); err != nil {
		return protocol.ScreenshotStreamStatus{}, err
	}

	intervalMS := normalizeInterval(req.IntervalMS)
	ctx, cancel := context.WithCancel(context.Background())
	next := &stream{
		sessionID:    req.SessionID,
		runID:        req.RunID,
		controllerID: req.ControllerID,
		interval:     time.Duration(intervalMS) * time.Millisecond,
		intervalMS:   intervalMS,
		force:        req.Force,
		maxFrames:    req.MaxFrames,
		startedAt:    time.Now().UTC(),
		cancel:       cancel,
		done:         make(chan struct{}),
	}

	var previous *stream
	s.mu.Lock()
	previous = s.streams[req.SessionID]
	s.streams[req.SessionID] = next
	s.mu.Unlock()
	if previous != nil {
		previous.stop()
	}

	go s.loop(ctx, next, emit)
	return next.status(true, ""), nil
}

func (s *Service) Stop(sessionID string, reason string) (protocol.ScreenshotStreamStatus, bool) {
	active := s.take(sessionID)
	if active == nil {
		return protocol.ScreenshotStreamStatus{
			SessionID: sessionID,
			Active:    false,
			StoppedAt: time.Now().UTC().Format(time.RFC3339Nano),
			Reason:    reason,
		}, false
	}
	active.stop()
	return active.status(false, reason), true
}

func (s *Service) StopRunBound(sessionID string, runID string, reason string) {
	s.mu.Lock()
	active := s.streams[sessionID]
	if active == nil || active.runID == "" || (runID != "" && active.runID != runID) {
		s.mu.Unlock()
		return
	}
	delete(s.streams, sessionID)
	s.mu.Unlock()
	active.stop()
}

func (s *Service) StopSession(sessionID string) {
	active := s.take(sessionID)
	if active != nil {
		active.stop()
	}
}

func (s *Service) controller(controllerID string) (*maa.Controller, error) {
	if s.mfwService == nil {
		return nil, fmt.Errorf("MaaFramework service 不可用")
	}
	if s.artifacts == nil {
		return nil, fmt.Errorf("artifact store 不可用")
	}
	if controllerID == "" {
		return nil, fmt.Errorf("缺少 controllerId")
	}

	info, err := s.mfwService.ControllerManager().GetController(controllerID)
	if err != nil {
		return nil, err
	}
	if info == nil || !info.Connected {
		return nil, fmt.Errorf("controller 未连接: %s", controllerID)
	}
	ctrl, ok := info.Controller.(*maa.Controller)
	if !ok || ctrl == nil {
		return nil, fmt.Errorf("controller 实例不可用: %s", controllerID)
	}
	return ctrl, nil
}

func (s *Service) loop(ctx context.Context, active *stream, emit EventEmitter) {
	defer close(active.done)
	ticker := time.NewTicker(active.interval)
	defer ticker.Stop()

	s.captureFrame(active, emit)
	for {
		if active.reachedLimit() {
			s.takeIfSame(active)
			return
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.captureFrame(active, emit)
		}
	}
}

func (s *Service) captureFrame(active *stream, emit EventEmitter) {
	ctrl, err := s.controller(active.controllerID)
	if err != nil {
		s.emitStreamError(active, err, emit)
		s.takeIfSame(active)
		active.cancel()
		return
	}
	img, err := cachedOrFreshImage(ctrl, active.force)
	if err != nil {
		s.emitStreamError(active, err, emit)
		s.takeIfSame(active)
		active.cancel()
		return
	}
	ref, err := s.artifacts.AddPNG(active.sessionID, "screenshot/live", img)
	if err != nil {
		s.emitStreamError(active, err, emit)
		s.takeIfSame(active)
		active.cancel()
		return
	}
	frame := active.incrementFrame()
	bounds := img.Bounds()
	if emit != nil {
		emit(protocol.Event{
			SessionID:     active.sessionID,
			RunID:         active.runID,
			Source:        "localbridge",
			Kind:          "screenshot",
			Phase:         "completed",
			Status:        "streaming",
			ScreenshotRef: ref.ID,
			Data: map[string]interface{}{
				"controllerId": active.controllerID,
				"intervalMs":   active.intervalMS,
				"force":        active.force,
				"frame":        frame,
				"width":        bounds.Dx(),
				"height":       bounds.Dy(),
				"source":       "live",
			},
		})
	}
}

func (s *Service) emitStreamError(active *stream, err error, emit EventEmitter) {
	logger.Warn("DebugVNext", "live screenshot 推流失败: %v", err)
	if emit == nil {
		return
	}
	emit(protocol.Event{
		SessionID: active.sessionID,
		RunID:     active.runID,
		Source:    "localbridge",
		Kind:      "diagnostic",
		Phase:     "failed",
		Status:    "error",
		Data: map[string]interface{}{
			"severity":     "error",
			"code":         "debug.screenshot.stream_failed",
			"message":      err.Error(),
			"controllerId": active.controllerID,
		},
	})
}

func (s *Service) take(sessionID string) *stream {
	s.mu.Lock()
	defer s.mu.Unlock()
	active := s.streams[sessionID]
	delete(s.streams, sessionID)
	return active
}

func (s *Service) takeIfSame(active *stream) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.streams[active.sessionID] == active {
		delete(s.streams, active.sessionID)
	}
}

func (s *stream) stop() {
	s.cancel()
	select {
	case <-s.done:
	case <-time.After(2 * time.Second):
		logger.Warn("DebugVNext", "等待 live screenshot 推流停止超时: session=%s", s.sessionID)
	}
}

func (s *stream) incrementFrame() int64 {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.frameCount++
	return s.frameCount
}

func (s *stream) reachedLimit() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.maxFrames > 0 && s.frameCount >= int64(s.maxFrames)
}

func (s *stream) status(active bool, reason string) protocol.ScreenshotStreamStatus {
	s.mu.RLock()
	defer s.mu.RUnlock()
	status := protocol.ScreenshotStreamStatus{
		SessionID:    s.sessionID,
		RunID:        s.runID,
		ControllerID: s.controllerID,
		IntervalMS:   s.intervalMS,
		Force:        s.force,
		Active:       active,
		FrameCount:   s.frameCount,
		StartedAt:    s.startedAt.Format(time.RFC3339Nano),
		Reason:       reason,
	}
	if !active {
		status.StoppedAt = time.Now().UTC().Format(time.RFC3339Nano)
	}
	return status
}

func normalizeInterval(intervalMS int) int {
	if intervalMS <= 0 {
		return DefaultStreamIntervalMS
	}
	if intervalMS < MinStreamIntervalMS {
		return MinStreamIntervalMS
	}
	return intervalMS
}

func cachedOrFreshImage(ctrl *maa.Controller, force bool) (image.Image, error) {
	if !force {
		if img, err := ctrl.CacheImage(); err == nil && img != nil {
			return img, nil
		}
	}
	job := ctrl.PostScreencap()
	if job == nil {
		return nil, fmt.Errorf("发起截图失败")
	}
	job.Wait()
	if !job.Success() {
		return nil, fmt.Errorf("截图失败: %v", job.Status())
	}
	img, err := ctrl.CacheImage()
	if err != nil || img == nil {
		return nil, fmt.Errorf("读取截图缓存失败")
	}
	return img, nil
}
