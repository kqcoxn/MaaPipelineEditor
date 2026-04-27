package session

import (
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/protocol"
)

type Status string

const (
	StatusIdle      Status = "idle"
	StatusPreparing Status = "preparing"
	StatusRunning   Status = "running"
	StatusStopping  Status = "stopping"
	StatusCompleted Status = "completed"
	StatusFailed    Status = "failed"
	StatusDisposed  Status = "disposed"
)

type Session struct {
	ID           string
	Status       Status
	CreatedAt    time.Time
	UpdatedAt    time.Time
	Capabilities protocol.CapabilityManifest
}

type Snapshot struct {
	SessionID    string                      `json:"sessionId"`
	Status       Status                      `json:"status"`
	CreatedAt    string                      `json:"createdAt"`
	UpdatedAt    string                      `json:"updatedAt"`
	Capabilities protocol.CapabilityManifest `json:"capabilities"`
}

type Manager struct {
	mu       sync.RWMutex
	sessions map[string]*Session
}

func NewManager() *Manager {
	return &Manager{
		sessions: make(map[string]*Session),
	}
}

func (m *Manager) Create(capabilities protocol.CapabilityManifest) Snapshot {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now().UTC()
	session := &Session{
		ID:           uuid.NewString(),
		Status:       StatusIdle,
		CreatedAt:    now,
		UpdatedAt:    now,
		Capabilities: capabilities,
	}
	m.sessions[session.ID] = session
	return session.Snapshot()
}

func (m *Manager) Destroy(sessionID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	session, ok := m.sessions[sessionID]
	if !ok {
		return fmt.Errorf("debug session not found: %s", sessionID)
	}
	session.Status = StatusDisposed
	session.UpdatedAt = time.Now().UTC()
	delete(m.sessions, sessionID)
	return nil
}

func (m *Manager) Snapshot(sessionID string) (Snapshot, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	session, ok := m.sessions[sessionID]
	if !ok {
		return Snapshot{}, fmt.Errorf("debug session not found: %s", sessionID)
	}
	return session.Snapshot(), nil
}

func (s *Session) Snapshot() Snapshot {
	return Snapshot{
		SessionID:    s.ID,
		Status:       s.Status,
		CreatedAt:    s.CreatedAt.Format(time.RFC3339Nano),
		UpdatedAt:    s.UpdatedAt.Format(time.RFC3339Nano),
		Capabilities: s.Capabilities,
	}
}
