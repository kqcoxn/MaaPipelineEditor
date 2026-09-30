package maa

import (
	"strings"
	"sync"
	"sync/atomic"
	"unsafe"
)

type eventCallback struct {
	id   uint64
	sink any
}

var (
	lastestEventCallbackID uint64
	eventCallbacks         = make(map[uint64]eventCallback)
	eventCallbacksMutex    sync.RWMutex
)

func registerEventCallback(sink any) uint64 {
	id := atomic.AddUint64(&lastestEventCallbackID, 1)

	eventCallbacksMutex.Lock()
	eventCallbacks[id] = eventCallback{
		id:   id,
		sink: sink,
	}
	eventCallbacksMutex.Unlock()

	return id
}

func unregisterEventCallback(id uint64) {
	eventCallbacksMutex.Lock()
	delete(eventCallbacks, id)
	eventCallbacksMutex.Unlock()
}

type Event string

func (e Event) String() string {
	return string(e)
}

func (e Event) Starting() string {
	return string(e) + ".Starting"
}

func (e Event) Succeeded() string {
	return string(e) + ".Succeeded"
}

func (e Event) Failed() string {
	return string(e) + ".Failed"
}

const (
	EventResourceLoading     = Event("Resource.Loading")
	EventControllerAction    = Event("Controller.Action")
	EventTaskerTask          = Event("Tasker.Task")
	EventNodePipelineNode    = Event("Node.PipelineNode")
	EventNodeRecognitionNode = Event("Node.RecognitionNode")
	EventNodeActionNode      = Event("Node.ActionNode")
	EventNodeNextList        = Event("Node.NextList")
	EventNodeRecognition     = Event("Node.Recognition")
	EventNodeAction          = Event("Node.Action")
)

// EventStatus represents the current state of an event
type EventStatus int

// Event status constants
const (
	EventStatusUnknown EventStatus = iota
	EventStatusStarting
	EventStatusSucceeded
	EventStatusFailed
)

// ResourceLoadingDetail contains information about resource loading events
type ResourceLoadingDetail struct {
	ResID uint64 `json:"res_id"`
	Hash  string `json:"hash"`
	Path  string `json:"path"`
}

// ControllerActionDetail contains information about controller action events
type ControllerActionDetail struct {
	CtrlID uint64         `json:"ctrl_id"`
	UUID   string         `json:"uuid"`
	Action string         `json:"action"`
	Param  map[string]any `json:"param"`
	Info   map[string]any `json:"info"`
}

// TaskerTaskDetail contains information about tasker task events
type TaskerTaskDetail struct {
	TaskID uint64 `json:"task_id"`
	Entry  string `json:"entry"`
	UUID   string `json:"uuid"`
	Hash   string `json:"hash"`
}

// NodePipelineNodeDetail contains information about pipeline node events
type NodePipelineNodeDetail struct {
	TaskID uint64 `json:"task_id"`
	NodeID uint64 `json:"node_id"`
	Name   string `json:"name"`
	Focus  any    `json:"focus"`
}

// NodeRecognitionNodeDetail contains information about recognition node events
type NodeRecognitionNodeDetail struct {
	TaskID uint64 `json:"task_id"`
	NodeID uint64 `json:"node_id"`
	Name   string `json:"name"`
	Focus  any    `json:"focus"`
}

// NodeActionNodeDetail contains information about action node events
type NodeActionNodeDetail struct {
	TaskID uint64 `json:"task_id"`
	NodeID uint64 `json:"node_id"`
	Name   string `json:"name"`
	Focus  any    `json:"focus"`
}

// NodeNextListDetail contains information about node next list events
type NodeNextListDetail struct {
	TaskID uint64     `json:"task_id"`
	Name   string     `json:"name"`
	List   []NextItem `json:"list"`
	Focus  any        `json:"focus"`
}

// NodeRecognitionDetail contains information about node recognition events
type NodeRecognitionDetail struct {
	TaskID        uint64 `json:"task_id"`
	RecognitionID uint64 `json:"reco_id"`
	Name          string `json:"name"`
	Focus         any    `json:"focus"`
}

// NodeActionDetail contains information about node action events
type NodeActionDetail struct {
	TaskID   uint64 `json:"task_id"`
	ActionID uint64 `json:"action_id"`
	Name     string `json:"name"`
	Focus    any    `json:"focus"`
}

func parseEvent(msg string) (name string, status EventStatus) {
	lastDot := strings.LastIndexByte(msg, '.')

	if lastDot == -1 {
		return msg, EventStatusUnknown
	}

	switch msg[lastDot:] {
	case ".Starting":
		return msg[:lastDot], EventStatusStarting
	case ".Succeeded":
		return msg[:lastDot], EventStatusSucceeded
	case ".Failed":
		return msg[:lastDot], EventStatusFailed
	default:
		return msg, EventStatusUnknown
	}
}

func handleResourceLoading(sink any, handle uintptr, status EventStatus, detailsJSON []byte) {
	s, ok := sink.(ResourceEventSink)
	if !ok {
		return
	}

	var detail ResourceLoadingDetail
	if err := unmarshalJSON(detailsJSON, &detail); err != nil {
		return
	}

	res := borrowResource(handle)
	if res == nil {
		state := newExternalHandleState(handle)
		res = &Resource{handle: handle, state: state}
		defer state.expire()
	}
	done, err := res.state.beginCallback()
	if err != nil {
		return
	}
	defer done()
	s.OnResourceLoading(res, status, detail)
}

func handleControllerAction(sink any, handle uintptr, status EventStatus, detailsJSON []byte) {
	s, ok := sink.(ControllerEventSink)
	if !ok {
		return
	}

	var detail ControllerActionDetail
	if err := unmarshalJSON(detailsJSON, &detail); err != nil {
		return
	}

	ctrl := borrowController(handle)
	if ctrl == nil {
		state := newExternalHandleState(handle)
		ctrl = &Controller{handle: handle, state: state}
		defer state.expire()
	}
	done, err := ctrl.state.beginCallback()
	if err != nil {
		return
	}
	defer done()
	s.OnControllerAction(ctrl, status, detail)
}

func handleTaskerTask(sink any, handle uintptr, status EventStatus, detailsJSON []byte) {
	s, ok := sink.(TaskerEventSink)
	if !ok {
		return
	}

	var detail TaskerTaskDetail
	if err := unmarshalJSON(detailsJSON, &detail); err != nil {
		return
	}

	tasker := borrowTasker(handle)
	if tasker == nil {
		scope := newContextState()
		state := &taskerState{handleState: newExternalHandleState(handle), external: true, scope: scope}
		scope.track(state.handleState)
		tasker = &Tasker{handle: handle, state: state}
		defer scope.invalidate()
	}
	done, err := tasker.state.beginCallback()
	if err != nil {
		return
	}
	defer done()
	s.OnTaskerTask(tasker, status, detail)
}

func handleNodePipelineNode(sink any, handle uintptr, status EventStatus, detailsJSON []byte) {
	s, ok := sink.(ContextEventSink)
	if !ok {
		return
	}

	var detail NodePipelineNodeDetail
	if err := unmarshalJSON(detailsJSON, &detail); err != nil {
		return
	}

	ctx := newCallbackContext(handle)
	if ctx == nil {
		return
	}
	defer ctx.invalidate()
	s.OnNodePipelineNode(ctx, status, detail)
}

func handleNodeRecognitionNode(sink any, handle uintptr, status EventStatus, detailsJSON []byte) {
	s, ok := sink.(ContextEventSink)
	if !ok {
		return
	}

	var detail NodeRecognitionNodeDetail
	if err := unmarshalJSON(detailsJSON, &detail); err != nil {
		return
	}

	ctx := newCallbackContext(handle)
	if ctx == nil {
		return
	}
	defer ctx.invalidate()
	s.OnNodeRecognitionNode(ctx, status, detail)
}

func handleNodeActionNode(sink any, handle uintptr, status EventStatus, detailsJSON []byte) {
	s, ok := sink.(ContextEventSink)
	if !ok {
		return
	}

	var detail NodeActionNodeDetail
	if err := unmarshalJSON(detailsJSON, &detail); err != nil {
		return
	}

	ctx := newCallbackContext(handle)
	if ctx == nil {
		return
	}
	defer ctx.invalidate()
	s.OnNodeActionNode(ctx, status, detail)
}

func handleNodeNextList(sink any, handle uintptr, status EventStatus, detailsJSON []byte) {
	s, ok := sink.(ContextEventSink)
	if !ok {
		return
	}

	var detail NodeNextListDetail
	if err := unmarshalJSON(detailsJSON, &detail); err != nil {
		return
	}

	ctx := newCallbackContext(handle)
	if ctx == nil {
		return
	}
	defer ctx.invalidate()
	s.OnNodeNextList(ctx, status, detail)
}

func handleNodeRecognition(sink any, handle uintptr, status EventStatus, detailsJSON []byte) {
	s, ok := sink.(ContextEventSink)
	if !ok {
		return
	}

	var detail NodeRecognitionDetail
	if err := unmarshalJSON(detailsJSON, &detail); err != nil {
		return
	}

	ctx := newCallbackContext(handle)
	if ctx == nil {
		return
	}
	defer ctx.invalidate()
	s.OnNodeRecognition(ctx, status, detail)
}

func handleNodeAction(sink any, handle uintptr, status EventStatus, detailsJSON []byte) {
	s, ok := sink.(ContextEventSink)
	if !ok {
		return
	}

	var detail NodeActionDetail
	if err := unmarshalJSON(detailsJSON, &detail); err != nil {
		return
	}

	ctx := newCallbackContext(handle)
	if ctx == nil {
		return
	}
	defer ctx.invalidate()
	s.OnNodeAction(ctx, status, detail)
}

func (c *eventCallback) handleRaw(handle uintptr, msg string, detailsJSON []byte) {
	if c.sink == nil {
		return
	}

	eventName, eventStatus := parseEvent(msg)
	switch Event(eventName) {
	case EventResourceLoading:
		handleResourceLoading(c.sink, handle, eventStatus, detailsJSON)
	case EventControllerAction:
		handleControllerAction(c.sink, handle, eventStatus, detailsJSON)
	case EventTaskerTask:
		handleTaskerTask(c.sink, handle, eventStatus, detailsJSON)
	case EventNodePipelineNode:
		handleNodePipelineNode(c.sink, handle, eventStatus, detailsJSON)
	case EventNodeRecognitionNode:
		handleNodeRecognitionNode(c.sink, handle, eventStatus, detailsJSON)

	case EventNodeActionNode:
		handleNodeActionNode(c.sink, handle, eventStatus, detailsJSON)

	case EventNodeNextList:
		handleNodeNextList(c.sink, handle, eventStatus, detailsJSON)

	case EventNodeRecognition:
		handleNodeRecognition(c.sink, handle, eventStatus, detailsJSON)

	case EventNodeAction:
		handleNodeAction(c.sink, handle, eventStatus, detailsJSON)

	default:
		// do nothing
	}
}

// handle uintptr:
// - Tasker handle for MaaTasker event
// - Resource handle for MaaResource event
// - Controller handle for MaaController event
// - Context handle for MaaContext event
func _MaaEventCallbackAgent(handle uintptr, message, detailsJson *byte, transArg uintptr) uintptr {
	// Here, we are simply passing the uint64 value as a pointer
	// and will not actually dereference this pointer.
	id := uint64(transArg)

	eventCallbacksMutex.RLock()
	cb, exists := eventCallbacks[id]
	eventCallbacksMutex.RUnlock()

	if !exists || cb.sink == nil {
		return 0
	}

	cb.handleRaw(
		handle,
		// Event message is consumed immediately in this stack frame.
		cStringToStringNoCopy(message),
		cStringToBytes(detailsJson),
	)
	return 0
}

func cStringToString(b *byte) string {
	if b == nil {
		return ""
	}

	// Keep copy semantics for user-facing callback arguments.
	return string(cStringToBytes(b))
}

func cStringToStringNoCopy(b *byte) string {
	if b == nil {
		return ""
	}

	return unsafe.String(b, cStringLen(b))
}

func cStringToBytes(b *byte) []byte {
	if b == nil {
		return nil
	}

	return unsafe.Slice(b, cStringLen(b))
}

func cStringLen(b *byte) int {
	ptr := unsafe.Pointer(b)
	length := 0

	for {
		if *(*byte)(ptr) == 0 {
			break
		}
		ptr = unsafe.Add(ptr, 1)
		length++
	}

	return length
}
