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

	s.events[event.SessionID] = append(s.events[event.SessionID], event)
	return event, nil
}

func (s *Store) List(sessionID string) []protocol.Event {
	s.mu.RLock()
	defer s.mu.RUnlock()

	events := s.events[sessionID]
	result := make([]protocol.Event, len(events))
	copy(result, events)
	return result
}

func (s *Store) DeleteSession(sessionID string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	delete(s.events, sessionID)
	delete(s.nextSeqs, sessionID)
}
