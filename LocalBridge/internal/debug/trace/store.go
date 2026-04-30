package trace

import (
	"fmt"
	"sync"
	"time"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/protocol"
)

type Store struct {
	mu       sync.RWMutex
	events   map[string][]protocol.Event
	nextSeqs map[string]int64
}

func NewStore() *Store {
	return &Store{
		events:   make(map[string][]protocol.Event),
		nextSeqs: make(map[string]int64),
	}
}

func (s *Store) Append(event protocol.Event) (protocol.Event, error) {
	if event.SessionID == "" {
		return protocol.Event{}, fmt.Errorf("debug event missing sessionId")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	nextSeq := s.nextSeqs[event.SessionID] + 1
	event.Seq = nextSeq
	s.nextSeqs[event.SessionID] = nextSeq
	if event.Timestamp == "" {
		event.Timestamp = time.Now().UTC().Format(time.RFC3339Nano)
	}

	stored := cloneEvent(event)
	s.events[event.SessionID] = append(s.events[event.SessionID], stored)
	return cloneEvent(stored), nil
}

func (s *Store) AttachDetailRef(sessionID string, seq int64, detailRef string, data map[string]interface{}) (protocol.Event, error) {
	if sessionID == "" {
		return protocol.Event{}, fmt.Errorf("debug event missing sessionId")
	}
	if seq <= 0 {
		return protocol.Event{}, fmt.Errorf("debug event missing seq")
	}
	if detailRef == "" {
		return protocol.Event{}, fmt.Errorf("debug event missing detailRef")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	events := s.events[sessionID]
	for index, existing := range events {
		if existing.Seq == seq {
			updated := cloneEvent(existing)
			updated.DetailRef = detailRef
			if len(data) > 0 {
				if updated.Data == nil {
					updated.Data = make(map[string]interface{}, len(data))
				}
				for key, value := range data {
					updated.Data[key] = value
				}
			}
			events[index] = cloneEvent(updated)
			s.events[sessionID] = events
			return cloneEvent(updated), nil
		}
	}
	return protocol.Event{}, fmt.Errorf("debug event not found: sessionId=%s seq=%d", sessionID, seq)
}

func (s *Store) List(sessionID string) []protocol.Event {
	s.mu.RLock()
	defer s.mu.RUnlock()

	events := s.events[sessionID]
	result := make([]protocol.Event, len(events))
	for index, event := range events {
		result[index] = cloneEvent(event)
	}
	return result
}

func (s *Store) ListRun(sessionID string, runID string) []protocol.Event {
	events := s.List(sessionID)
	if runID == "" {
		return events
	}

	result := make([]protocol.Event, 0, len(events))
	for _, event := range events {
		if event.RunID == runID {
			result = append(result, event)
		}
	}
	return result
}

func (s *Store) DeleteSession(sessionID string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	delete(s.events, sessionID)
	delete(s.nextSeqs, sessionID)
}

func cloneEvent(event protocol.Event) protocol.Event {
	if event.Node != nil {
		node := *event.Node
		event.Node = &node
	}
	if event.Edge != nil {
		edge := *event.Edge
		event.Edge = &edge
	}
	event.Data = cloneEventData(event.Data)
	return event
}

func cloneEventData(data map[string]interface{}) map[string]interface{} {
	if data == nil {
		return nil
	}
	cloned := make(map[string]interface{}, len(data))
	for key, value := range data {
		cloned[key] = value
	}
	return cloned
}
