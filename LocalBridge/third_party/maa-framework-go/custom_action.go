package maa

import (
	"sync"
	"sync/atomic"

	"github.com/MaaXYZ/maa-framework-go/v4/internal/buffer"
)

var (
	customActionRunnerCallbackID          uint64
	customActionRunnerCallbackAgents      = make(map[uint64]CustomActionRunner)
	customActionRunnerCallbackAgentsMutex sync.RWMutex
)

func registerCustomAction(action CustomActionRunner) uint64 {
	id := atomic.AddUint64(&customActionRunnerCallbackID, 1)

	customActionRunnerCallbackAgentsMutex.Lock()
	customActionRunnerCallbackAgents[id] = action
	customActionRunnerCallbackAgentsMutex.Unlock()

	return id
}

func unregisterCustomAction(id uint64) bool {
	customActionRunnerCallbackAgentsMutex.Lock()
	defer customActionRunnerCallbackAgentsMutex.Unlock()

	if _, ok := customActionRunnerCallbackAgents[id]; !ok {
		return false
	}
	delete(customActionRunnerCallbackAgents, id)
	return true
}

type CustomActionArg struct {
	TaskID            int64 // Task ID. Task details can be retrieved via Tasker.GetTaskDetail.
	CurrentTaskName   string
	CustomActionName  string
	CustomActionParam string
	// RecognitionDetail may be nil when the custom action runs on an action-only
	// node (e.g. invoked via Context.RunAction), where reco_id is invalid.
	RecognitionDetail *RecognitionDetail
	Box               Rect
}

type CustomActionRunner interface {
	Run(ctx *Context, arg *CustomActionArg) bool
}

// CustomActionFunc is an adapter to allow use of ordinary functions as CustomActionRunner.
// If f is a function with the appropriate signature, CustomActionFunc(f) is a
// CustomActionRunner that calls f.
type CustomActionFunc func(ctx *Context, arg *CustomActionArg) bool

func (f CustomActionFunc) Run(ctx *Context, arg *CustomActionArg) bool {
	return f(ctx, arg)
}

func _MaaCustomActionCallbackAgent(
	context uintptr,
	taskId int64,
	currentTaskName, customActionName, customActionParam *byte,
	recoId int64,
	box uintptr,
	transArg uintptr,
) uintptr {
	// Here, we are simply passing the uint64 value as a pointer
	// and will not actually dereference this pointer.
	id := uint64(transArg)

	customActionRunnerCallbackAgentsMutex.RLock()
	action, exists := customActionRunnerCallbackAgents[id]
	customActionRunnerCallbackAgentsMutex.RUnlock()

	if !exists || action == nil {
		return 0
	}

	ctx := &Context{handle: context}
	tasker := ctx.GetTasker()
	// Skip GetRecognitionDetail for invalid recoId to avoid a spurious framework error log.
	var recognitionDetail *RecognitionDetail
	if recoId != 0 {
		var err error
		recognitionDetail, err = tasker.GetRecognitionDetail(recoId)
		if err != nil {
			return 0
		}
	}
	curBoxRectBuffer := buffer.NewRectBufferByHandle(box)

	ok := action.Run(
		ctx,
		&CustomActionArg{
			TaskID:            taskId,
			CurrentTaskName:   cStringToString(currentTaskName),
			CustomActionName:  cStringToString(customActionName),
			CustomActionParam: cStringToString(customActionParam),
			RecognitionDetail: recognitionDetail,
			Box:               curBoxRectBuffer.Get(),
		},
	)
	if ok {
		return 1
	}
	return 0
}
