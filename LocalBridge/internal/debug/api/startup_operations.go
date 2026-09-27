package api

import (
	"context"
	"fmt"
	"sync"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/server"
)

type startupOperation struct {
	cancel context.CancelFunc
	done   chan struct{}
}

type startupOperations struct {
	mu     sync.Mutex
	active map[string]*startupOperation
	closed bool
}

func (s *startupOperations) begin(key string, disconnected <-chan struct{}) (context.Context, func(), error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed {
		return nil, nil, fmt.Errorf("服务正在关闭")
	}
	if s.active == nil {
		s.active = make(map[string]*startupOperation)
	}
	if s.active[key] != nil {
		return nil, nil, fmt.Errorf("启动仍在进行，请等待完成或停止")
	}
	ctx, cancel := context.WithCancel(context.Background())
	op := &startupOperation{cancel: cancel, done: make(chan struct{})}
	s.active[key] = op
	go func() {
		select {
		case <-disconnected:
			cancel()
		case <-op.done:
		}
	}()
	return ctx, func() {
		cancel()
		s.mu.Lock()
		delete(s.active, key)
		close(op.done)
		s.mu.Unlock()
	}, nil
}

func (s *startupOperations) cancel(key string, beforeCancel func()) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if op := s.active[key]; op != nil {
		if beforeCancel != nil {
			beforeCancel()
		}
		op.cancel()
		return true
	}
	return false
}

func (s *startupOperations) close() {
	s.mu.Lock()
	s.closed = true
	var pending []*startupOperation
	for _, op := range s.active {
		op.cancel()
		pending = append(pending, op)
	}
	s.mu.Unlock()
	for _, op := range pending {
		<-op.done
	}
}

func connectionDone(conn *server.Connection) <-chan struct{} {
	if conn == nil {
		return nil
	}
	return conn.Done()
}
