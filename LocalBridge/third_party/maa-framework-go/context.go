package maa

import (
	"errors"
	"image"
	"reflect"
	"time"

	"github.com/MaaXYZ/maa-framework-go/v4/internal/buffer"
	"github.com/MaaXYZ/maa-framework-go/v4/internal/native"
)

// Context provides the runtime context for custom actions/recognitions
// and exposes task, recognition, action, and pipeline operations.
type Context struct {
	handle uintptr
	tasker *Tasker
}

func isNilOverride(v any) bool {
	if v == nil {
		return true
	}

	rv := reflect.ValueOf(v)
	switch rv.Kind() {
	case reflect.Chan, reflect.Func, reflect.Interface, reflect.Map, reflect.Pointer, reflect.Slice:
		return rv.IsNil()
	default:
		return false
	}
}

func (ctx *Context) handleOverride(override ...any) string {
	if len(override) == 0 {
		return "{}"
	}

	overrideValue := override[0]
	if isNilOverride(overrideValue) {
		return "{}"
	}

	switch v := overrideValue.(type) {
	case string:
		return v
	case []byte:
		return string(v)
	default:
		jsonBytes, err := marshalJSON(v)
		if err != nil {
			return "{}"
		}
		return string(jsonBytes)
	}
}

func (ctx *Context) runTask(entry, override string) (*TaskDetail, error) {
	taskId := native.MaaContextRunTask(ctx.handle, entry, override)
	if taskId == 0 {
		return nil, errors.New("failed to run task")
	}
	tasker := ctx.GetTasker()
	return tasker.GetTaskDetail(taskId)
}

// RunTask runs a pipeline task by entry name and returns its detail.
// It accepts an entry string and an optional override parameter which can be
// a JSON string or any data type that can be marshaled to JSON. The override
// must be a JSON object (map). If the override value is nil, an empty JSON
// object will be used. If multiple overrides are provided, only the first one
// will be used.
//
// Example 1:
//
//	pipeline := NewPipeline()
//	node := NewNode("Task").
//		SetAction(ActClick(ClickParam{Target: NewTargetRect(Rect{100, 200, 100, 100})}))
//	pipeline.AddNode(node)
//	ctx.RunTask(node.Name, pipeline)
//
// Example 2:
//
//	ctx.RunTask("Task", map[string]any{
//	    "Task": map[string]any{
//	        "action": "Click",
//	        "target": []int{100, 200, 100, 100},
//		}
//	})
//
// Example 3:
//
//	ctx.RunTask("Task", `{"Task":{"action":"Click","target":[100, 200, 100, 100]}}`)
func (ctx *Context) RunTask(entry string, override ...any) (*TaskDetail, error) {
	return ctx.runTask(entry, ctx.handleOverride(override...))
}

func (ctx *Context) runRecognition(
	entry, override string,
	img image.Image,
) (*RecognitionDetail, error) {
	imgBuf := buffer.NewImageBuffer()
	imgBuf.Set(img)
	defer imgBuf.Destroy()

	recId := native.MaaContextRunRecognition(ctx.handle, entry, override, imgBuf.Handle())
	if recId == 0 {
		return nil, errors.New("failed to run recognition")
	}
	tasker := ctx.GetTasker()
	recognitionDetail, err := tasker.GetRecognitionDetail(recId)
	return recognitionDetail, err
}

// RunRecognition runs a recognition by entry name and returns its detail.
// It accepts an entry string and an optional override parameter which can be
// a JSON string or any data type that can be marshaled to JSON. The override
// must be a JSON object (map). If the override value is nil, an empty JSON
// object will be used. If multiple overrides are provided, only the first one
// will be used.
//
// Example 1:
//
//	pipeline := NewPipeline()
//	node := NewNode("Task").
//		SetRecognition(RecOCR(OCRParam{Expected: []string{"Hello"}}))
//	pipeline.AddNode(node)
//	ctx.RunRecognition(node.Name, img, pipeline)
//
// Example 2:
//
//	ctx.RunRecognition("Task", img, map[string]any{
//	    "Task": map[string]any{
//	        "recognition": "OCR",
//	        "expected": "Hello",
//		}
//	})
//
// Example 3:
//
//	ctx.RunRecognition("Task", img, `{"Task":{"recognition":"OCR","expected":"Hello"}}`)
func (ctx *Context) RunRecognition(
	entry string,
	img image.Image,
	override ...any,
) (*RecognitionDetail, error) {
	return ctx.runRecognition(entry, ctx.handleOverride(override...), img)
}

func (ctx *Context) runAction(
	entry, override string,
	box Rect,
	recognitionDetail string,
) (*ActionDetail, error) {
	rectBuf := buffer.NewRectBuffer()
	rectBuf.Set(box)
	defer rectBuf.Destroy()

	actId := native.MaaContextRunAction(
		ctx.handle,
		entry,
		override,
		rectBuf.Handle(),
		recognitionDetail,
	)
	if actId == 0 {
		return nil, errors.New("failed to run action")
	}
	tasker := ctx.GetTasker()
	actionDetail, err := tasker.GetActionDetail(actId)
	return actionDetail, err
}

// RunAction runs an action by entry name and returns its detail.
// It accepts an entry string and an optional override parameter which can be
// a JSON string or any data type that can be marshaled to JSON. The override
// must be a JSON object (map). If the override value is nil, an empty JSON
// object will be used. If multiple overrides are provided, only the first one
// will be used.
// recognitionDetail should be a JSON string for the previous recognition
// detail (e.g., RecognitionDetail.DetailJson). Pass "" if not available.
//
// Example 1:
//
//	pipeline := NewPipeline()
//	node := NewNode("Task").
//		SetAction(ActClick(ClickParam{Target: NewTargetRect(Rect{100, 200, 100, 100})}))
//	pipeline.AddNode(node)
//	ctx.RunAction(node.Name, box, recognitionDetail, pipeline)
//
// Example 2:
//
//	ctx.RunAction("Task", box, recognitionDetail, map[string]any{
//	    "Task": map[string]any{
//	        "action": "Click",
//	        "target": []int{100, 200, 100, 100},
//		}
//	})
//
// Example 3:
//
//	ctx.RunAction("Task", box, recognitionDetail, `{"Task":{"action":"Click","target":[100, 200, 100, 100]}}`)
func (ctx *Context) RunAction(
	entry string,
	box Rect,
	recognitionDetail string,
	override ...any,
) (*ActionDetail, error) {
	return ctx.runAction(
		entry,
		ctx.handleOverride(override...),
		box,
		recognitionDetail,
	)
}

// RunRecognitionDirect runs recognition directly by type and parameters, without a pipeline entry.
// It accepts a recognition type (e.g., RecognitionTypeOCR, RecognitionTypeTemplateMatch),
// a recognition parameter implementing RecognitionParam (marshaled to JSON), and an image.
// recoParam may be nil; it is then marshaled as JSON null.
//
// Example:
//
//	recParam := &OCRParam{Expected: []string{"Hello"}}
//	detail, err := ctx.RunRecognitionDirect(RecognitionTypeOCR, recParam, img)
func (ctx *Context) RunRecognitionDirect(
	recoType RecognitionType,
	recoParam RecognitionParam,
	img image.Image,
) (*RecognitionDetail, error) {
	imgBuf := buffer.NewImageBuffer()
	imgBuf.Set(img)
	defer imgBuf.Destroy()

	recParamJSON, err := marshalJSON(recoParam)
	if err != nil {
		return nil, err
	}

	recId := native.MaaContextRunRecognitionDirect(
		ctx.handle,
		string(recoType),
		string(recParamJSON),
		imgBuf.Handle(),
	)
	if recId == 0 {
		return nil, errors.New("failed to run recognition direct")
	}
	tasker := ctx.GetTasker()
	recognitionDetail, err := tasker.GetRecognitionDetail(recId)
	return recognitionDetail, err
}

// RunActionDirect runs action directly by type and parameters, without a pipeline entry.
// It accepts an action type string (e.g., "Click", "Swipe"), an action parameter that will be
// marshaled to JSON, a box for the action position, and recognition details. If action parameters
// or recognition details are nil, they will be marshaled to JSON null.
//
// Example:
//
//	actParam := &ClickParam{Target: NewTargetRect(Rect{100, 200, 100, 100})}
//	box := Rect{100, 200, 100, 100}
//	ctx.RunActionDirect(ActionTypeClick, actParam, box, nil)
func (ctx *Context) RunActionDirect(
	actionType ActionType,
	actionParam ActionParam,
	box Rect,
	recoDetail *RecognitionDetail,
) (*ActionDetail, error) {
	rectBuf := buffer.NewRectBuffer()
	rectBuf.Set(box)
	defer rectBuf.Destroy()

	actParamJSON, err := marshalJSON(actionParam)
	if err != nil {
		return nil, err
	}
	recoDetailJSON, err := marshalJSON(recoDetail)
	if err != nil {
		return nil, err
	}

	actId := native.MaaContextRunActionDirect(
		ctx.handle,
		string(actionType),
		string(actParamJSON),
		rectBuf.Handle(),
		string(recoDetailJSON),
	)
	if actId == 0 {
		return nil, errors.New("failed to run action direct")
	}
	tasker := ctx.GetTasker()
	actionDetail, err := tasker.GetActionDetail(actId)
	return actionDetail, err
}

func (ctx *Context) overridePipeline(override string) error {
	if !native.MaaContextOverridePipeline(ctx.handle, override) {
		return errors.New("failed to override pipeline")
	}
	return nil
}

// OverridePipeline overrides the current pipeline definition.
// The override parameter can be a JSON string, raw JSON bytes, a Pipeline, or any
// data type that can be marshaled to JSON. The resulting JSON must be an object
// or an array of objects. If override is nil, an empty JSON object will be used.
//
// Example 1:
//
//	pipeline := NewPipeline()
//	node := NewNode("Task").SetAction(ActDoNothing())
//	pipeline.AddNode(node)
//	ctx.OverridePipeline(pipeline)
//
// Example 2:
//
//	ctx.OverridePipeline(map[string]any{
//		"Task": map[string]any{
//			"action": "Click",
//			"target": []int{100, 200, 100, 100},
//		},
//	})
//
// Example 3:
//
//	ctx.OverridePipeline(`{"Task":{"action":"Click","target":[100,200,100,100]}}`)
func (ctx *Context) OverridePipeline(override any) error {
	switch v := override.(type) {
	case string:
		return ctx.overridePipeline(v)
	case []byte:
		return ctx.overridePipeline(string(v))
	default:
		if v == nil {
			return ctx.overridePipeline("{}")
		}

		jsonBytes, err := marshalJSON(v)
		if err != nil {
			return err
		}
		return ctx.overridePipeline(string(jsonBytes))
	}
}

// OverrideNext overrides the next list of a node by name.
// If the underlying call fails (e.g., node not found or list invalid), it returns an error.
func (ctx *Context) OverrideNext(name string, nextList []NextItem) error {
	list := buffer.NewStringListBuffer()
	defer list.Destroy()
	size := len(nextList)
	items := make([]*buffer.StringBuffer, size)
	for i := 0; i < size; i++ {
		items[i] = buffer.NewStringBuffer()
		items[i].Set(nextList[i].FormatName())
		list.Append(items[i])
	}
	defer func() {
		for _, item := range items {
			item.Destroy()
		}
	}()
	if !native.MaaContextOverrideNext(ctx.handle, name, list.Handle()) {
		return errors.New("failed to override next")
	}
	return nil
}

// OverrideImage overrides an image by name.
func (ctx *Context) OverrideImage(imageName string, image image.Image) error {
	img := buffer.NewImageBuffer()
	defer img.Destroy()
	img.Set(image)
	if !native.MaaContextOverrideImage(ctx.handle, imageName, img.Handle()) {
		return errors.New("failed to override image")
	}
	return nil
}

// GetNodeJSON gets the node JSON by name.
func (ctx *Context) GetNodeJSON(name string) (string, error) {
	buf := buffer.NewStringBuffer()
	defer buf.Destroy()
	ok := native.MaaContextGetNodeData(ctx.handle, name, buf.Handle())
	if !ok {
		return "", errors.New("failed to get node JSON")
	}
	return buf.Get(), nil
}

// GetNode returns the node definition by name.
// It fetches the node JSON via GetNodeJSON and unmarshals it into a Node struct.
func (ctx *Context) GetNode(name string) (*Node, error) {
	raw, err := ctx.GetNodeJSON(name)
	if err != nil {
		return nil, err
	}

	var node Node
	err = unmarshalJSON([]byte(raw), &node)
	if err != nil {
		return nil, err
	}
	node.Name = name
	if node.Attach == nil {
		node.Attach = make(map[string]any)
	}
	return &node, nil
}

// GetTaskJob returns current task job.
func (ctx *Context) GetTaskJob() *TaskJob {
	tasker := ctx.GetTasker()
	taskId := native.MaaContextGetTaskId(ctx.handle)
	return newTaskJob(
		taskId,
		tasker.status,
		tasker.wait,
		tasker.GetTaskDetail,
		tasker.overridePipeline,
		nil,
	)
}

// GetTasker returns the current Tasker.
func (ctx *Context) GetTasker() *Tasker {
	if ctx.tasker != nil {
		return ctx.tasker
	}
	handle := native.MaaContextGetTasker(ctx.handle)
	ctx.tasker = &Tasker{handle: handle}
	return ctx.tasker
}

// WaitFreezes waits until the screen stabilizes (no significant changes).
// duration is the duration that the screen must remain stable.
// box is the recognition hit box, used when target is "Self" to calculate the ROI; if nil, uses entire screen.
// waitFreezesParam is optional; nil uses default params. duration and waitFreezesParam.Time are mutually exclusive;
// one of them must be non-zero.
// Returns nil if the screen stabilized within the timeout; returns an error on timeout or failure.
func (ctx *Context) WaitFreezes(
	duration time.Duration,
	box *Rect,
	waitFreezesParam *WaitFreezesParam,
) error {
	var boxHandle uintptr
	if box != nil {
		rectBuf := buffer.NewRectBuffer()
		rectBuf.Set(*box)
		defer rectBuf.Destroy()
		boxHandle = rectBuf.Handle()
	}

	ok := native.MaaContextWaitFreezes(
		ctx.handle,
		uint64(duration.Milliseconds()),
		boxHandle,
		ctx.handleOverride(waitFreezesParam),
	)
	if !ok {
		return errors.New("wait freezes timeout or failed")
	}

	return nil
}

// Clone clones current Context.
func (ctx *Context) Clone() *Context {
	handle := native.MaaContextClone(ctx.handle)
	return &Context{handle: handle}
}

// SetAnchor sets an anchor by name.
func (ctx *Context) SetAnchor(anchorName, nodeName string) error {
	if !native.MaaContextSetAnchor(ctx.handle, anchorName, nodeName) {
		return errors.New("failed to set anchor")
	}
	return nil
}

// GetAnchor gets an anchor by name.
func (ctx *Context) GetAnchor(anchorName string) (string, error) {
	buf := buffer.NewStringBuffer()
	defer buf.Destroy()
	ok := native.MaaContextGetAnchor(ctx.handle, anchorName, buf.Handle())
	if !ok {
		return "", errors.New("failed to get anchor")
	}
	return buf.Get(), nil
}

// GetHitCount gets the hit count of a node by name.
func (ctx *Context) GetHitCount(nodeName string) (uint64, error) {
	var count uint64
	ok := native.MaaContextGetHitCount(ctx.handle, nodeName, &count)
	if !ok {
		return 0, errors.New("failed to get hit count")
	}
	return count, nil
}

// ClearHitCount clears the hit count of a node by name.
func (ctx *Context) ClearHitCount(nodeName string) error {
	if !native.MaaContextClearHitCount(ctx.handle, nodeName) {
		return errors.New("failed to clear hit count")
	}
	return nil
}
