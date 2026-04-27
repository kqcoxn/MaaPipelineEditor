package artifact

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image"
	"image/png"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/protocol"
)

type Store struct {
	mu        sync.RWMutex
	artifacts map[string]map[string]protocol.ArtifactPayload
}

func NewStore() *Store {
	return &Store{
		artifacts: make(map[string]map[string]protocol.ArtifactPayload),
	}
}

func (s *Store) AddJSON(sessionID string, artifactType string, data interface{}) (protocol.ArtifactRef, error) {
	if sessionID == "" {
		return protocol.ArtifactRef{}, fmt.Errorf("artifact missing sessionId")
	}

	content, err := json.Marshal(data)
	if err != nil {
		return protocol.ArtifactRef{}, fmt.Errorf("marshal artifact data: %w", err)
	}

	ref := protocol.ArtifactRef{
		ID:        uuid.NewString(),
		SessionID: sessionID,
		Type:      artifactType,
		Mime:      "application/json",
		Size:      int64(len(content)),
		CreatedAt: time.Now().UTC().Format(time.RFC3339Nano),
	}
	payload := protocol.ArtifactPayload{
		Ref:      ref,
		Encoding: "json",
		Data:     data,
	}
	s.put(payload)
	return ref, nil
}

func (s *Store) AddPNG(sessionID string, artifactType string, img image.Image) (protocol.ArtifactRef, error) {
	if sessionID == "" {
		return protocol.ArtifactRef{}, fmt.Errorf("artifact missing sessionId")
	}
	if img == nil {
		return protocol.ArtifactRef{}, fmt.Errorf("artifact image is nil")
	}

	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return protocol.ArtifactRef{}, fmt.Errorf("encode png artifact: %w", err)
	}

	ref := protocol.ArtifactRef{
		ID:        uuid.NewString(),
		SessionID: sessionID,
		Type:      artifactType,
		Mime:      "image/png",
		Size:      int64(buf.Len()),
		CreatedAt: time.Now().UTC().Format(time.RFC3339Nano),
	}
	payload := protocol.ArtifactPayload{
		Ref:      ref,
		Encoding: "base64",
		Content:  base64.StdEncoding.EncodeToString(buf.Bytes()),
	}
	s.put(payload)
	return ref, nil
}

func (s *Store) SetEventSeq(sessionID string, artifactID string, seq int64) {
	s.mu.Lock()
	defer s.mu.Unlock()

	sessionArtifacts, ok := s.artifacts[sessionID]
	if !ok {
		return
	}
	payload, ok := sessionArtifacts[artifactID]
	if !ok {
		return
	}
	payload.Ref.EventSeq = seq
	sessionArtifacts[artifactID] = payload
}

func (s *Store) Get(sessionID string, artifactID string) (protocol.ArtifactPayload, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	sessionArtifacts, ok := s.artifacts[sessionID]
	if !ok {
		return protocol.ArtifactPayload{}, fmt.Errorf("artifact session not found: %s", sessionID)
	}
	payload, ok := sessionArtifacts[artifactID]
	if !ok {
		return protocol.ArtifactPayload{}, fmt.Errorf("artifact not found: %s", artifactID)
	}
	return payload, nil
}

func (s *Store) DeleteSession(sessionID string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	delete(s.artifacts, sessionID)
}

func (s *Store) put(payload protocol.ArtifactPayload) {
	s.mu.Lock()
	defer s.mu.Unlock()

	sessionID := payload.Ref.SessionID
	if _, ok := s.artifacts[sessionID]; !ok {
		s.artifacts[sessionID] = make(map[string]protocol.ArtifactPayload)
	}
	s.artifacts[sessionID][payload.Ref.ID] = payload
}
