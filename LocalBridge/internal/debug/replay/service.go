package replay

import (
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/protocol"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/trace"
)

type Service struct {
	traces *trace.Store

	mu       sync.Mutex
	statuses map[string]protocol.TraceReplayStatus
}

func NewService(traces *trace.Store) *Service {
	return &Service{
		traces:   traces,
		statuses: make(map[string]protocol.TraceReplayStatus),
	}
}

func (s *Service) Snapshot(req protocol.TraceSnapshotRequest) (protocol.TraceSnapshot, error) {
	sessionID := strings.TrimSpace(req.SessionID)
	if sessionID == "" {
		return protocol.TraceSnapshot{}, fmt.Errorf("缺少 sessionId")
	}
	return protocol.TraceSnapshot{
		SessionID: sessionID,
		RunID:     strings.TrimSpace(req.RunID),
		Events:    s.traces.ListRun(sessionID, strings.TrimSpace(req.RunID)),
	}, nil
}

func (s *Service) Start(req protocol.TraceReplayRequest) (protocol.TraceReplayStatus, error) {
	sessionID := strings.TrimSpace(req.SessionID)
	if sessionID == "" {
		return protocol.TraceReplayStatus{}, fmt.Errorf("缺少 sessionId")
	}
	events := filterNodeEvents(s.traces.ListRun(sessionID, strings.TrimSpace(req.RunID)), strings.TrimSpace(req.NodeID))
	minSeq, maxSeq := seqBounds(events)
	cursor := req.CursorSeq
	if cursor <= 0 {
		cursor = minSeq
	}
	if maxSeq > 0 && cursor > maxSeq {
		cursor = maxSeq
	}

	now := time.Now().UTC().Format(time.RFC3339Nano)
	status := protocol.TraceReplayStatus{
		SessionID: sessionID,
		RunID:     strings.TrimSpace(req.RunID),
		Active:    true,
		Playing:   true,
		CursorSeq: cursor,
		MinSeq:    minSeq,
		MaxSeq:    maxSeq,
		NodeID:    strings.TrimSpace(req.NodeID),
		Speed:     normalizeSpeed(req.Speed),
		StartedAt: now,
		UpdatedAt: now,
	}
	s.mu.Lock()
	s.statuses[sessionID] = status
	s.mu.Unlock()
	return status, nil
}

func (s *Service) Seek(req protocol.TraceReplayRequest) (protocol.TraceReplayStatus, error) {
	sessionID := strings.TrimSpace(req.SessionID)
	if sessionID == "" {
		return protocol.TraceReplayStatus{}, fmt.Errorf("缺少 sessionId")
	}
	events := filterNodeEvents(s.traces.ListRun(sessionID, strings.TrimSpace(req.RunID)), strings.TrimSpace(req.NodeID))
	minSeq, maxSeq := seqBounds(events)
	cursor := req.CursorSeq
	if cursor <= 0 {
		cursor = minSeq
	}
	if maxSeq > 0 && cursor > maxSeq {
		cursor = maxSeq
	}

	s.mu.Lock()
	status := s.statuses[sessionID]
	if status.SessionID == "" {
		status.SessionID = sessionID
		status.StartedAt = time.Now().UTC().Format(time.RFC3339Nano)
	}
	status.RunID = strings.TrimSpace(req.RunID)
	status.Active = true
	status.Playing = false
	status.CursorSeq = cursor
	status.MinSeq = minSeq
	status.MaxSeq = maxSeq
	status.NodeID = strings.TrimSpace(req.NodeID)
	status.Speed = normalizeSpeed(req.Speed)
	status.UpdatedAt = time.Now().UTC().Format(time.RFC3339Nano)
	s.statuses[sessionID] = status
	s.mu.Unlock()
	return status, nil
}

func (s *Service) Stop(req protocol.TraceReplayStopRequest) (protocol.TraceReplayStatus, error) {
	sessionID := strings.TrimSpace(req.SessionID)
	if sessionID == "" {
		return protocol.TraceReplayStatus{}, fmt.Errorf("缺少 sessionId")
	}
	s.mu.Lock()
	status := s.statuses[sessionID]
	if status.SessionID == "" {
		status.SessionID = sessionID
	}
	status.Active = false
	status.Playing = false
	status.StoppedAt = time.Now().UTC().Format(time.RFC3339Nano)
	status.Reason = strings.TrimSpace(req.Reason)
	if status.Reason == "" {
		status.Reason = "user_stop"
	}
	delete(s.statuses, sessionID)
	s.mu.Unlock()
	return status, nil
}

func (s *Service) StopSession(sessionID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.statuses, sessionID)
}

func filterNodeEvents(events []protocol.Event, nodeID string) []protocol.Event {
	if nodeID == "" {
		return events
	}
	result := make([]protocol.Event, 0, len(events))
	for _, event := range events {
		if event.Node != nil && event.Node.NodeID == nodeID {
			result = append(result, event)
		}
	}
	return result
}

func seqBounds(events []protocol.Event) (int64, int64) {
	var minSeq int64
	var maxSeq int64
	for _, event := range events {
		if minSeq == 0 || event.Seq < minSeq {
			minSeq = event.Seq
		}
		if event.Seq > maxSeq {
			maxSeq = event.Seq
		}
	}
	return minSeq, maxSeq
}

func normalizeSpeed(speed int) int {
	if speed <= 0 {
		return 1
	}
	if speed > 16 {
		return 16
	}
	return speed
}
