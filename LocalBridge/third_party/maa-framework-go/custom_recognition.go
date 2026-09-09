package maa

import (
	"image"
	"sync"
	"sync/atomic"

	"github.com/MaaXYZ/maa-framework-go/v4/internal/buffer"
)

var (
	customRecognitionRunnerCallbackID          uint64
	customRecognitionRunnerCallbackAgents      = make(map[uint64]CustomRecognitionRunner)
	customRecognitionRunnerCallbackAgentsMutex sync.RWMutex
)

func registerCustomRecognition(recognizer CustomRecognitionRunner) uint64 {
	id := atomic.AddUint64(&customRecognitionRunnerCallbackID, 1)

	customRecognitionRunnerCallbackAgentsMutex.Lock()
	customRecognitionRunnerCallbackAgents[id] = recognizer
	customRecognitionRunnerCallbackAgentsMutex.Unlock()

	return id
}

func unregisterCustomRecognition(id uint64) bool {
	customRecognitionRunnerCallbackAgentsMutex.Lock()
	defer customRecognitionRunnerCallbackAgentsMutex.Unlock()

	if _, ok := customRecognitionRunnerCallbackAgents[id]; !ok {
		return false
	}
	delete(customRecognitionRunnerCallbackAgents, id)
	return true
}

type CustomRecognitionArg struct {
	TaskID                 int64 // Task ID. Task details can be retrieved via Tasker.GetTaskDetail.
	CurrentTaskName        string
	CustomRecognitionName  string
	CustomRecognitionParam string
	Img                    image.Image
	Roi                    Rect
}

type CustomRecognitionResult struct {
	Box    Rect   `json:"box"`
	Detail string `json:"detail"`
}

type CustomRecognitionRunner interface {
	Run(ctx *Context, arg *CustomRecognitionArg) (*CustomRecognitionResult, bool)
}

// CustomRecognitionFunc is an adapter to allow use of ordinary functions as CustomRecognitionRunner.
// If f is a function with the appropriate signature, CustomRecognitionFunc(f) is a
// CustomRecognitionRunner that calls f.
type CustomRecognitionFunc func(ctx *Context, arg *CustomRecognitionArg) (*CustomRecognitionResult, bool)

func (f CustomRecognitionFunc) Run(ctx *Context, arg *CustomRecognitionArg) (*CustomRecognitionResult, bool) {
	return f(ctx, arg)
}

func _MaaCustomRecognitionCallbackAgent(
	context uintptr,
	taskId int64,
	currentTaskName, customRecognitionName, customRecognitionParam *byte,
	image, roi uintptr,
	transArg uintptr,
	outBox, outDetail uintptr,
) uintptr {
	// Here, we are simply passing the uint64 value as a pointer
	// and will not actually dereference this pointer.
	id := uint64(transArg)

	customRecognitionRunnerCallbackAgentsMutex.RLock()
	recognition, exists := customRecognitionRunnerCallbackAgents[id]
	customRecognitionRunnerCallbackAgentsMutex.RUnlock()

	if !exists || recognition == nil {
		return 0
	}

	imgBuffer := buffer.NewImageBufferByHandle(image)
	imgImg := imgBuffer.Get()

	ret, ok := recognition.Run(
		&Context{handle: context},
		&CustomRecognitionArg{
			TaskID:                 taskId,
			CurrentTaskName:        cStringToString(currentTaskName),
			CustomRecognitionName:  cStringToString(customRecognitionName),
			CustomRecognitionParam: cStringToString(customRecognitionParam),
			Img:                    imgImg,
			Roi:                    buffer.NewRectBufferByHandle(roi).Get(),
		},
	)
	if !ok || ret == nil {
		return 0
	}

	box := ret.Box
	outBoxRect := buffer.NewRectBufferByHandle(outBox)
	outBoxRect.Set(box)
	outDetailString := buffer.NewStringBufferByHandle(outDetail)
	outDetailString.Set(ret.Detail)
	return 1
}
