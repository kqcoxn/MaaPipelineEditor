package maa

import (
	"errors"
	"sync"
	"sync/atomic"
	"time"
)

// ErrClosed reports an operation on a destroyed native object.
var ErrClosed = errors.New("maa: object is closed")

// ErrBorrowed reports an attempt to destroy a handle obtained from a getter or callback.
var ErrBorrowed = errors.New("maa: borrowed object cannot be destroyed")

// ErrBound reports an attempt to destroy a resource or controller still bound to a tasker.
var ErrBound = errors.New("maa: object is bound to a tasker")

// ErrInCallback reports an attempt to destroy an object from one of its callbacks.
var ErrInCallback = errors.New("maa: object cannot be destroyed during a callback")

// ErrInUse reports an attempt to destroy an object while a call or job is active.
var ErrInUse = errors.New("maa: object has an active call")

// ErrTaskerRunning reports an attempt to rebind a running tasker.
var ErrTaskerRunning = errors.New("maa: tasker is running")

// handleState keeps a native handle alive while calls use it. Successful
// close runs cleanup once before returning.
type handleState struct {
	mu          sync.Mutex
	cond        *sync.Cond
	handle      uintptr
	active      int
	callbacks   int
	bindings    int
	closed      bool
	external    bool
	cleanup     func(uintptr)
	cleanupDone chan struct{}
	jobStatus   func(uintptr, int64) Status
	jobRunning  func(uintptr) bool
	jobs        map[int64]struct{}
	reapingJobs bool
}

const jobReapInterval = 250 * time.Millisecond

// liveNativeObjects counts owned native handles until their cleanup finishes.
// Release uses it to avoid unloading a library while one of those handles
// still needs its native destroy function.
var liveNativeObjects atomic.Int64

func newHandleState(handle uintptr, cleanup func(uintptr)) *handleState {
	state := &handleState{handle: handle, cleanup: cleanup}
	if cleanup != nil {
		liveNativeObjects.Add(1)
		state.cleanupDone = make(chan struct{})
	}
	state.cond = sync.NewCond(&state.mu)
	return state
}

func newExternalHandleState(handle uintptr) *handleState {
	state := newHandleState(handle, nil)
	state.external = true
	return state
}

func (s *handleState) begin() (uintptr, func(), error) {
	if s == nil {
		return 0, nil, ErrClosed
	}
	s.mu.Lock()
	if s.closed || s.handle == 0 {
		s.mu.Unlock()
		return 0, nil, ErrClosed
	}
	s.active++
	handle := s.handle
	s.mu.Unlock()
	return handle, s.end, nil
}

func (s *handleState) beginCallback() (func(), error) {
	if s == nil {
		return nil, ErrClosed
	}
	s.mu.Lock()
	if s.closed || s.handle == 0 {
		s.mu.Unlock()
		return nil, ErrClosed
	}
	s.active++
	s.callbacks++
	s.mu.Unlock()
	return func() {
		s.mu.Lock()
		s.callbacks--
		s.active--
		if s.active == 0 {
			s.cond.Broadcast()
		}
		handle, cleanup := s.takeCleanupLocked()
		s.mu.Unlock()
		s.runCleanup(handle, cleanup)
	}, nil
}

func (s *handleState) check() error {
	if s == nil {
		return ErrClosed
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed || s.handle == 0 {
		return ErrClosed
	}
	return nil
}

// trackJob records a submitted native job before the posting call releases its
// active reference. A job need not be retained by its Go caller to keep its
// native owner alive.
func (s *handleState) trackJob(id int64) {
	if s == nil || id == 0 {
		return
	}
	startReaper := false
	s.mu.Lock()
	if s.jobStatus != nil && !s.closed {
		if s.jobs == nil {
			s.jobs = make(map[int64]struct{})
		}
		s.jobs[id] = struct{}{}
		if !s.reapingJobs {
			s.reapingJobs = true
			startReaper = true
		}
	}
	s.mu.Unlock()
	if startReaper {
		go s.reapJobs()
	}
}

// reapJobs removes completed jobs even when callers discard their Jobs and
// submit no further work. One reaper runs per owner while jobs are tracked.
func (s *handleState) reapJobs() {
	ticker := time.NewTicker(jobReapInterval)
	defer ticker.Stop()
	for range ticker.C {
		s.mu.Lock()
		if !s.closed && len(s.jobs) != 0 {
			s.pruneCompletedJobsLocked()
		}
		if s.closed || len(s.jobs) == 0 {
			s.reapingJobs = false
			s.mu.Unlock()
			return
		}
		s.mu.Unlock()
	}
}

func (s *handleState) untrackJob(id int64) {
	if s == nil || id == 0 {
		return
	}
	s.mu.Lock()
	delete(s.jobs, id)
	s.mu.Unlock()
}

func (s *handleState) pruneCompletedJobsLocked() bool {
	active := false
	for id := range s.jobs {
		status := s.jobStatus(s.handle, id)
		if status.Done() || status.Invalid() {
			delete(s.jobs, id)
		} else {
			active = true
		}
	}
	return active
}

// jobsActiveLocked checks native completion while close still excludes new
// calls. Only terminal or invalid jobs can be removed from the tracking set.
func (s *handleState) jobsActiveLocked() bool {
	if s.jobRunning != nil && s.jobRunning(s.handle) {
		return true
	}
	return s.pruneCompletedJobsLocked()
}

func (s *handleState) end() {
	s.mu.Lock()
	s.active--
	if s.active == 0 {
		s.cond.Broadcast()
	}
	handle, cleanup := s.takeCleanupLocked()
	s.mu.Unlock()
	s.runCleanup(handle, cleanup)
}

func (s *handleState) runCleanup(handle uintptr, cleanup func(uintptr)) {
	if cleanup == nil {
		return
	}
	defer close(s.cleanupDone)
	// Publish the released lifetime before waking concurrent Destroy callers.
	defer liveNativeObjects.Add(-1)
	cleanup(handle)
}

// expire invalidates a borrowed external handle and waits for calls in flight.
func (s *handleState) expire() {
	s.mu.Lock()
	s.closed = true
	for s.active != 0 {
		s.cond.Wait()
	}
	s.mu.Unlock()
}

func (s *handleState) takeCleanupLocked() (uintptr, func(uintptr)) {
	if !s.closed || s.active != 0 || s.cleanup == nil {
		return 0, nil
	}
	handle, cleanup := s.handle, s.cleanup
	s.handle = 0
	s.cleanup = nil
	return handle, cleanup
}

func (s *handleState) close() error {
	if s == nil {
		return nil
	}
	s.mu.Lock()
	if s.closed {
		done := s.cleanupDone
		s.mu.Unlock()
		if done != nil {
			<-done
		}
		return nil
	}
	if s.callbacks != 0 {
		s.mu.Unlock()
		return ErrInCallback
	}
	if s.bindings != 0 {
		s.mu.Unlock()
		return ErrBound
	}
	if s.active != 0 {
		s.mu.Unlock()
		return ErrInUse
	}
	if s.jobsActiveLocked() {
		s.mu.Unlock()
		return ErrInUse
	}
	s.closed = true
	handle, cleanup := s.takeCleanupLocked()
	done := s.cleanupDone
	s.mu.Unlock()
	if cleanup != nil {
		s.runCleanup(handle, cleanup)
	} else if done != nil {
		<-done
	}
	return nil
}

func (s *handleState) addBinding() (uintptr, error) {
	if s == nil {
		return 0, ErrClosed
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed || s.handle == 0 {
		return 0, ErrClosed
	}
	if s.external {
		return 0, ErrBorrowed
	}
	s.bindings++
	return s.handle, nil
}

func (s *handleState) removeBinding() {
	s.mu.Lock()
	s.bindings--
	s.mu.Unlock()
}

type taskerState struct {
	*handleState
	postMu          sync.Mutex
	bindingsMu      sync.Mutex
	resource        *Resource
	controller      *Controller
	heldResources   map[*handleState]struct{}
	heldControllers map[*handleState]struct{}
	external        bool
	scope           *contextState
}

var (
	taskerStates     sync.Map // map[uintptr]*taskerState
	resourceStates   sync.Map // map[uintptr]*handleState
	controllerStates sync.Map // map[uintptr]*handleState
)

func borrowTasker(handle uintptr) *Tasker {
	if state, ok := taskerStates.Load(handle); ok {
		return &Tasker{handle: handle, state: state.(*taskerState)}
	}
	return nil
}

func borrowTaskerForContext(handle uintptr, scope *contextState) *Tasker {
	if handle == 0 {
		return nil
	}
	if tasker := borrowTasker(handle); tasker != nil {
		return tasker
	}
	state := &taskerState{
		handleState: newExternalHandleState(handle),
		external:    true,
		scope:       scope,
	}
	if !scope.track(state.handleState) {
		return nil
	}
	return &Tasker{handle: handle, state: state}
}

func borrowResource(handle uintptr) *Resource {
	if state, ok := resourceStates.Load(handle); ok {
		return &Resource{handle: handle, state: state.(*handleState)}
	}
	return nil
}

func borrowResourceForContext(handle uintptr, scope *contextState) *Resource {
	if handle == 0 {
		return nil
	}
	if res := borrowResource(handle); res != nil {
		return res
	}
	state := newExternalHandleState(handle)
	if !scope.track(state) {
		return nil
	}
	return &Resource{handle: handle, state: state}
}

func borrowController(handle uintptr) *Controller {
	if state, ok := controllerStates.Load(handle); ok {
		return &Controller{handle: handle, state: state.(*handleState)}
	}
	return nil
}

func borrowControllerForContext(handle uintptr, scope *contextState) *Controller {
	if handle == 0 {
		return nil
	}
	if ctrl := borrowController(handle); ctrl != nil {
		return ctrl
	}
	state := newExternalHandleState(handle)
	if !scope.track(state) {
		return nil
	}
	return &Controller{handle: handle, state: state}
}
