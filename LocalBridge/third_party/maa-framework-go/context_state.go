package maa

import (
	"sync"

	"github.com/MaaXYZ/maa-framework-go/v4/internal/native"
)

// contextState bounds all copies and clones of a callback context to its call.
type contextState struct {
	mu         sync.Mutex
	cond       *sync.Cond
	active     int
	closed     bool
	borrowed   []*handleState
	taskerDone func()
}

func newCallbackContext(handle uintptr) *Context {
	state := newContextState()
	if handle != 0 {
		taskerHandle := native.MaaContextGetTasker(handle)
		if taskerHandle == 0 {
			return nil
		}
		if tasker := borrowTasker(taskerHandle); tasker != nil {
			done, err := tasker.state.beginCallback()
			if err != nil {
				return nil
			}
			state.taskerDone = done
		}
	}
	return &Context{handle: handle, state: state}
}

func newContextState() *contextState {
	state := &contextState{}
	state.cond = sync.NewCond(&state.mu)
	return state
}

func (s *contextState) begin() (func(), error) {
	if s == nil {
		return nil, ErrClosed
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed {
		return nil, ErrClosed
	}
	s.active++
	return s.end, nil
}

func (s *contextState) end() {
	s.mu.Lock()
	s.active--
	if s.active == 0 {
		s.cond.Broadcast()
	}
	s.mu.Unlock()
}

func (s *contextState) invalidate() {
	s.mu.Lock()
	s.closed = true
	for s.active != 0 {
		s.cond.Wait()
	}
	borrowed := s.borrowed
	s.borrowed = nil
	taskerDone := s.taskerDone
	s.taskerDone = nil
	s.mu.Unlock()
	for _, state := range borrowed {
		state.expire()
	}
	if taskerDone != nil {
		taskerDone()
	}
}

func (s *contextState) track(state *handleState) bool {
	s.mu.Lock()
	if s.closed && s.active == 0 {
		s.mu.Unlock()
		state.expire()
		return false
	}
	s.borrowed = append(s.borrowed, state)
	s.mu.Unlock()
	return true
}

func (ctx *Context) invalidate() {
	if ctx != nil && ctx.state != nil {
		ctx.state.invalidate()
	}
}
