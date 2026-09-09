package store

import "sync"

type Store[T any] struct {
	data map[uintptr]T
	mu   sync.RWMutex
}

func New[T any]() *Store[T] {
	return &Store[T]{data: make(map[uintptr]T)}
}

func (s *Store[T]) Lock() {
	s.mu.Lock()
}

func (s *Store[T]) Unlock() {
	s.mu.Unlock()
}

func (s *Store[T]) Set(handle uintptr, value T) {
	s.data[handle] = value
}

func (s *Store[T]) Get(handle uintptr) T {
	return s.data[handle]
}

func (s *Store[T]) Del(handle uintptr) {
	delete(s.data, handle)
}

// Update locks the store, passes the value to the callback for modification,
// then saves the modified value and unlocks.
func (s *Store[T]) Update(handle uintptr, fn func(*T)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	value := s.data[handle]
	fn(&value)
	s.data[handle] = value
}

type TaskerStoreValue struct {
	SinkIDToEventCallbackID        map[int64]uint64
	ContextSinkIDToEventCallbackID map[int64]uint64
}

type CtrlStoreValue struct {
	SinkIDToEventCallbackID     map[int64]uint64
	CustomControllerCallbacksID uint64
}

type ResStoreValue struct {
	SinkIDToEventCallbackID     map[int64]uint64
	CustomRecognizersCallbackID map[string]uint64
	CustomActionsCallbackID     map[string]uint64
}

var (
	TaskerStore = New[TaskerStoreValue]()
	CtrlStore   = New[CtrlStoreValue]()
	ResStore    = New[ResStoreValue]()
)
