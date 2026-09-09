package maa

import (
	"errors"
	"fmt"
	"image"
	"unsafe"

	"github.com/MaaXYZ/maa-framework-go/v4/internal/buffer"
	"github.com/MaaXYZ/maa-framework-go/v4/internal/native"
	"github.com/MaaXYZ/maa-framework-go/v4/internal/store"
)

// Resource manages the loading and configuration of resources required by Tasker.
// It handles pipeline definitions, OCR models, images, and inference device settings.
// Resource also provides registration of custom recognitions and actions.
//
// A Resource must be created with NewResource and should be destroyed with Destroy when no longer needed.
type Resource struct {
	handle uintptr
}

// NewResource creates a new resource.
func NewResource() (*Resource, error) {
	handle := native.MaaResourceCreate()
	if handle == 0 {
		return nil, errors.New("failed to create resource")
	}

	store.ResStore.Lock()
	store.ResStore.Set(handle, store.ResStoreValue{
		SinkIDToEventCallbackID:     make(map[int64]uint64),
		CustomRecognizersCallbackID: make(map[string]uint64),
		CustomActionsCallbackID:     make(map[string]uint64),
	})
	store.ResStore.Unlock()

	return &Resource{
		handle: handle,
	}, nil
}

// Destroy frees the resource.
func (r *Resource) Destroy() {
	store.ResStore.Lock()
	value := store.ResStore.Get(r.handle)
	for _, id := range value.SinkIDToEventCallbackID {
		unregisterEventCallback(id)
	}
	for _, id := range value.CustomRecognizersCallbackID {
		unregisterCustomRecognition(id)
	}
	for _, id := range value.CustomActionsCallbackID {
		unregisterCustomAction(id)
	}
	store.ResStore.Del(r.handle)
	store.ResStore.Unlock()

	native.MaaResourceDestroy(r.handle)
}

func (r *Resource) setOption(key native.MaaResOption, value unsafe.Pointer, valSize uintptr) error {
	if native.MaaResourceSetOption(
		r.handle,
		key,
		value,
		uint64(valSize),
	) {
		return nil
	}
	return fmt.Errorf("failed to set resource option: %v", key)
}

func (r *Resource) setInferenceDevice(device native.MaaInferenceDevice) error {
	if err := r.setOption(
		native.MaaResOption_InferenceDevice,
		unsafe.Pointer(&device),
		unsafe.Sizeof(device),
	); err != nil {
		return fmt.Errorf("failed to set inference device: %w", err)
	}
	return nil
}

func (r *Resource) setInferenceExecutionProvider(ep native.MaaInferenceExecutionProvider) error {
	if err := r.setOption(
		native.MaaResOption_InferenceExecutionProvider,
		unsafe.Pointer(&ep),
		unsafe.Sizeof(ep),
	); err != nil {
		return fmt.Errorf("failed to set inference execution provider: %w", err)
	}
	return nil
}

func (r *Resource) setInference(ep native.MaaInferenceExecutionProvider, deviceID native.MaaInferenceDevice) error {
	if err := r.setInferenceExecutionProvider(ep); err != nil {
		return err
	}
	if err := r.setInferenceDevice(deviceID); err != nil {
		return err
	}
	return nil
}

// UseCPU uses CPU for inference.
func (r *Resource) UseCPU() error {
	return r.setInference(native.MaaInferenceExecutionProvider_CPU, native.MaaInferenceDevice_CPU)
}

type InferenceDevice = native.MaaInferenceDevice

const (
	InferenceDeviceAuto InferenceDevice = -1
	InferenceDevice0    InferenceDevice = 0
	InferenceDevice1    InferenceDevice = 1
	// and more gpu id or flag...
)

// UseDirectml uses DirectML for inference.
// deviceID is the device id; use InferenceDeviceAuto for auto selection.
func (r *Resource) UseDirectml(deviceID InferenceDevice) error {
	return r.setInference(native.MaaInferenceExecutionProvider_DirectML, deviceID)
}

// UseCoreml uses CoreML for inference.
// coremlFlag is the CoreML flag; use InferenceDeviceAuto for auto selection.
func (r *Resource) UseCoreml(coremlFlag InferenceDevice) error {
	return r.setInference(native.MaaInferenceExecutionProvider_CoreML, coremlFlag)
}

// UseAutoExecutionProvider automatically selects the inference execution provider and device.
func (r *Resource) UseAutoExecutionProvider() error {
	return r.setInference(native.MaaInferenceExecutionProvider_Auto, native.MaaInferenceDevice_Auto)
}

// RegisterCustomRecognition registers a custom recognition runner to the resource.
// The registered name is referenced by pipeline nodes via
// CustomRecognitionParam{CustomRecognition: name}.
//
// Common registration forms are:
//
// 1. A type that implements CustomRecognitionRunner.
//
//	type screenTextRecognition struct{}
//
//	func (screenTextRecognition) Run(ctx *Context, arg *CustomRecognitionArg) (*CustomRecognitionResult, bool) {
//	...
//	}
//
//	err := res.RegisterCustomRecognition("ScreenText", screenTextRecognition{})
//
// 2. A named function adapted with CustomRecognitionFunc.
//
//	func runScreenText(ctx *Context, arg *CustomRecognitionArg) (*CustomRecognitionResult, bool) {
//	...
//	}
//
//	err := res.RegisterCustomRecognition("ScreenText", CustomRecognitionFunc(runScreenText))
//
// 3. An inline function adapted with CustomRecognitionFunc.
//
//	err := res.RegisterCustomRecognition("ScreenText", CustomRecognitionFunc(
//	func(ctx *Context, arg *CustomRecognitionArg) (*CustomRecognitionResult, bool) {
//	...
//	},
//	))
//
// Use UnregisterCustomRecognition or ClearCustomRecognition to remove
// registrations. Use GetCustomRecognitionList to inspect the currently
// registered names.
func (r *Resource) RegisterCustomRecognition(name string, recognition CustomRecognitionRunner) error {
	id := registerCustomRecognition(recognition)

	ok := native.MaaResourceRegisterCustomRecognition(
		r.handle,
		name,
		_MaaCustomRecognitionCallbackAgent,
		// Here, we are simply passing the uint64 value as a pointer
		// and will not actually dereference this pointer.
		uintptr(id),
	)
	if !ok {
		unregisterCustomRecognition(id)
		return fmt.Errorf("failed to register custom recognition: %s", name)
	}

	var oldID uint64
	var hadOld bool
	store.ResStore.Update(r.handle, func(v *store.ResStoreValue) {
		if existing, ok := v.CustomRecognizersCallbackID[name]; ok {
			oldID = existing
			hadOld = true
		}
		v.CustomRecognizersCallbackID[name] = id
	})
	if hadOld {
		unregisterCustomRecognition(oldID)
	}
	return nil
}

// UnregisterCustomRecognition unregisters a custom recognition runner from the resource.
func (r *Resource) UnregisterCustomRecognition(name string) error {
	var (
		found bool
		id    uint64
	)
	store.ResStore.Update(r.handle, func(v *store.ResStoreValue) {
		if storedID, ok := v.CustomRecognizersCallbackID[name]; ok {
			id = storedID
			found = true
		}
	})
	if !found {
		return fmt.Errorf("custom recognition not found: %s", name)
	}
	if !native.MaaResourceUnregisterCustomRecognition(r.handle, name) {
		return fmt.Errorf("failed to unregister custom recognition: %s", name)
	}

	store.ResStore.Update(r.handle, func(v *store.ResStoreValue) {
		delete(v.CustomRecognizersCallbackID, name)
	})
	unregisterCustomRecognition(id)
	return nil
}

// ClearCustomRecognition clears all custom recognitions runner registered from the resource.
func (r *Resource) ClearCustomRecognition() error {
	if !native.MaaResourceClearCustomRecognition(r.handle) {
		return errors.New("failed to clear custom recognition")
	}

	var ids []uint64
	store.ResStore.Update(r.handle, func(v *store.ResStoreValue) {
		for _, id := range v.CustomRecognizersCallbackID {
			ids = append(ids, id)
		}
		v.CustomRecognizersCallbackID = make(map[string]uint64)
	})
	for _, id := range ids {
		unregisterCustomRecognition(id)
	}
	return nil
}

// RegisterCustomAction registers a custom action runner to the resource.
// The registered name is referenced by pipeline nodes via
// CustomActionParam{CustomAction: name}.
//
// Common registration forms are:
//
// 1. A type that implements CustomActionRunner.
//
//	type closeDialogAction struct{}
//
//	func (closeDialogAction) Run(ctx *Context, arg *CustomActionArg) bool {
//	...
//	}
//
//	err := res.RegisterCustomAction("CloseDialog", closeDialogAction{})
//
// 2. A named function adapted with CustomActionFunc.
//
//	func runCloseDialog(ctx *Context, arg *CustomActionArg) bool {
//	...
//	}
//
//	err := res.RegisterCustomAction("CloseDialog", CustomActionFunc(runCloseDialog))
//
// 3. An inline function adapted with CustomActionFunc.
//
//	err := res.RegisterCustomAction("CloseDialog", CustomActionFunc(
//	func(ctx *Context, arg *CustomActionArg) bool {
//	...
//	},
//	))
//
// Use UnregisterCustomAction or ClearCustomAction to remove registrations.
// Use GetCustomActionList to inspect the currently registered names.
func (r *Resource) RegisterCustomAction(name string, action CustomActionRunner) error {
	id := registerCustomAction(action)

	ok := native.MaaResourceRegisterCustomAction(
		r.handle,
		name,
		_MaaCustomActionCallbackAgent,
		// Here, we are simply passing the uint64 value as a pointer
		// and will not actually dereference this pointer.
		uintptr(id),
	)
	if !ok {
		unregisterCustomAction(id)
		return fmt.Errorf("failed to register custom action: %s", name)
	}

	var oldID uint64
	var hadOld bool
	store.ResStore.Update(r.handle, func(v *store.ResStoreValue) {
		if existing, ok := v.CustomActionsCallbackID[name]; ok {
			oldID = existing
			hadOld = true
		}
		v.CustomActionsCallbackID[name] = id
	})
	if hadOld {
		unregisterCustomAction(oldID)
	}
	return nil
}

// UnregisterCustomAction unregisters a custom action runner from the resource.
func (r *Resource) UnregisterCustomAction(name string) error {
	var (
		found bool
		id    uint64
	)
	store.ResStore.Update(r.handle, func(v *store.ResStoreValue) {
		if storedID, ok := v.CustomActionsCallbackID[name]; ok {
			id = storedID
			found = true
		}
	})
	if !found {
		return fmt.Errorf("custom action not found: %s", name)
	}
	if !native.MaaResourceUnregisterCustomAction(r.handle, name) {
		return fmt.Errorf("failed to unregister custom action: %s", name)
	}

	store.ResStore.Update(r.handle, func(v *store.ResStoreValue) {
		delete(v.CustomActionsCallbackID, name)
	})
	unregisterCustomAction(id)
	return nil
}

// ClearCustomAction clears all custom actions runners registered from the resource.
func (r *Resource) ClearCustomAction() error {
	if !native.MaaResourceClearCustomAction(r.handle) {
		return errors.New("failed to clear custom action")
	}

	var ids []uint64
	store.ResStore.Update(r.handle, func(v *store.ResStoreValue) {
		for _, id := range v.CustomActionsCallbackID {
			ids = append(ids, id)
		}
		v.CustomActionsCallbackID = make(map[string]uint64)
	})
	for _, id := range ids {
		unregisterCustomAction(id)
	}
	return nil
}

// PostBundle asynchronously loads resource paths and returns a Job.
// This is an async operation that immediately returns a Job, which can be queried via status/wait.
func (r *Resource) PostBundle(path string) *Job {
	id := native.MaaResourcePostBundle(r.handle, path)
	return newJob(id, r.status, r.wait)
}

// PostOcrModel asynchronously loads an OCR model directory and returns a Job.
// This is an async operation that immediately returns a Job, which can be queried via status/wait.
func (r *Resource) PostOcrModel(path string) *Job {
	id := native.MaaResourcePostOcrModel(r.handle, path)
	return newJob(id, r.status, r.wait)
}

// PostPipeline asynchronously loads a pipeline and returns a Job.
// Supports loading a directory or a single json/jsonc file.
// This is an async operation that immediately returns a Job, which can be queried via status/wait.
func (r *Resource) PostPipeline(path string) *Job {
	id := native.MaaResourcePostPipeline(r.handle, path)
	return newJob(id, r.status, r.wait)
}

// PostImage asynchronously loads image resources and returns a Job.
// Supports loading a directory or a single image file.
// This is an async operation that immediately returns a Job, which can be queried via status/wait.
func (r *Resource) PostImage(path string) *Job {
	id := native.MaaResourcePostImage(r.handle, path)
	return newJob(id, r.status, r.wait)
}

func (r *Resource) overridePipeline(override string) error {
	if native.MaaResourceOverridePipeline(r.handle, override) {
		return nil
	}
	return errors.New("failed to override pipeline")
}

// OverridePipeline overrides the pipeline.
// override can be a JSON string or any value that can be marshaled to JSON.
func (r *Resource) OverridePipeline(override any) error {
	switch v := override.(type) {
	case string:
		return r.overridePipeline(v)
	case []byte:
		return r.overridePipeline(string(v))
	default:
		jsonBytes, err := marshalJSON(v)
		if err != nil {
			return fmt.Errorf("failed to marshal override: %w", err)
		}
		return r.overridePipeline(string(jsonBytes))
	}
}

// OverrideNext overrides the next list of a task by name.
// It sets the list directly and will create the node if it doesn't exist.
func (r *Resource) OverrideNext(name string, nextList []NextItem) error {
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
	if native.MaaResourceOverrideNext(r.handle, name, list.Handle()) {
		return nil
	}
	return errors.New("failed to override next")
}

// OverrideImage overrides the image data for the specified image name.
func (r *Resource) OverrideImage(imageName string, image image.Image) error {
	img := buffer.NewImageBuffer()
	defer img.Destroy()
	img.Set(image)
	if native.MaaResourceOverrideImage(r.handle, imageName, img.Handle()) {
		return nil
	}
	return errors.New("failed to override image")
}

// GetNodeJSON gets the task definition JSON by name.
func (r *Resource) GetNodeJSON(name string) (string, error) {
	buf := buffer.NewStringBuffer()
	defer buf.Destroy()
	ok := native.MaaResourceGetNodeData(r.handle, name, buf.Handle())
	if !ok {
		return "", fmt.Errorf("failed to get node data: %s", name)
	}
	return buf.Get(), nil
}

// GetNode returns the node definition by name.
// It fetches the node JSON via GetNodeJSON and unmarshals it into a Node struct.
func (r *Resource) GetNode(name string) (*Node, error) {
	raw, err := r.GetNodeJSON(name)
	if err != nil {
		return nil, err
	}

	var node Node
	if err := unmarshalJSON([]byte(raw), &node); err != nil {
		return nil, err
	}
	node.Name = name
	if node.Attach == nil {
		node.Attach = make(map[string]any)
	}
	return &node, nil
}

// Clear clears loaded content.
// This method fails if resources are currently loading.
func (r *Resource) Clear() error {
	if native.MaaResourceClear(r.handle) {
		return nil
	}
	return errors.New("failed to clear resource")
}

// status returns the loading status of a resource identified by id.
func (r *Resource) status(resId int64) Status {
	return Status(native.MaaResourceStatus(r.handle, resId))
}

func (r *Resource) wait(resId int64) Status {
	return Status(native.MaaResourceWait(r.handle, resId))
}

// Loaded checks if resources are loaded.
func (r *Resource) Loaded() bool {
	return native.MaaResourceLoaded(r.handle)
}

// GetHash returns the hash of the resource.
func (r *Resource) GetHash() (string, error) {
	hash := buffer.NewStringBuffer()
	defer hash.Destroy()

	got := native.MaaResourceGetHash(r.handle, hash.Handle())
	if !got {
		return "", errors.New("failed to get resource hash")
	}
	return hash.Get(), nil
}

// GetNodeList returns the node list of the resource.
func (r *Resource) GetNodeList() ([]string, error) {
	nodeList := buffer.NewStringListBuffer()
	defer nodeList.Destroy()

	got := native.MaaResourceGetNodeList(r.handle, nodeList.Handle())
	if !got {
		return nil, errors.New("failed to get node list")
	}
	taskListArr := nodeList.GetAll()

	return taskListArr, nil
}

// GetCustomRecognitionList returns the custom recognition list of the resource.
func (r *Resource) GetCustomRecognitionList() ([]string, error) {
	recognitionList := buffer.NewStringListBuffer()
	defer recognitionList.Destroy()

	got := native.MaaResourceGetCustomRecognitionList(r.handle, recognitionList.Handle())
	if !got {
		return nil, errors.New("failed to get custom recognition list")
	}

	return recognitionList.GetAll(), nil
}

// GetCustomActionList returns the custom action list of the resource.
func (r *Resource) GetCustomActionList() ([]string, error) {
	actionList := buffer.NewStringListBuffer()
	defer actionList.Destroy()

	got := native.MaaResourceGetCustomActionList(r.handle, actionList.Handle())
	if !got {
		return nil, errors.New("failed to get custom action list")
	}

	return actionList.GetAll(), nil
}

// GetDefaultRecognitionParam returns the default recognition parameters for the specified type from DefaultPipelineMgr.
// recoType is a recognition type (e.g., RecognitionTypeOCR, RecognitionTypeTemplateMatch).
// Returns the parsed RecognitionParam interface.
func (r *Resource) GetDefaultRecognitionParam(recoType RecognitionType) (RecognitionParam, error) {
	buf := buffer.NewStringBuffer()
	defer buf.Destroy()
	ok := native.MaaResourceGetDefaultRecognitionParam(r.handle, string(recoType), buf.Handle())
	if !ok {
		return nil, fmt.Errorf("failed to get default recognition param: %s", recoType)
	}

	jsonStr := buf.Get()
	if jsonStr == "" {
		return nil, errors.New("default recognition param is empty")
	}

	// Create the appropriate param type based on recoType
	var param RecognitionParam
	switch recoType {
	case RecognitionTypeDirectHit, "":
		param = &DirectHitParam{}
	case RecognitionTypeTemplateMatch:
		param = &TemplateMatchParam{}
	case RecognitionTypeFeatureMatch:
		param = &FeatureMatchParam{}
	case RecognitionTypeColorMatch:
		param = &ColorMatchParam{}
	case RecognitionTypeOCR:
		param = &OCRParam{}
	case RecognitionTypeNeuralNetworkClassify:
		param = &NeuralNetworkClassifyParam{}
	case RecognitionTypeNeuralNetworkDetect:
		param = &NeuralNetworkDetectParam{}
	case RecognitionTypeAnd:
		param = &AndRecognitionParam{}
	case RecognitionTypeOr:
		param = &OrRecognitionParam{}
	case RecognitionTypeCustom:
		param = &CustomRecognitionParam{}
	default:
		return nil, fmt.Errorf("unknown recognition type: %s", recoType)
	}

	// Unmarshal the JSON string into the param
	if err := unmarshalJSON([]byte(jsonStr), param); err != nil {
		return nil, fmt.Errorf("failed to unmarshal default recognition param: %w", err)
	}

	return param, nil
}

// GetDefaultActionParam returns the default action parameters for the specified type from DefaultPipelineMgr.
// actionType is an action type (e.g., ActionTypeClick, ActionTypeSwipe).
// Returns the parsed ActionParam interface.
func (r *Resource) GetDefaultActionParam(actionType ActionType) (ActionParam, error) {
	buf := buffer.NewStringBuffer()
	defer buf.Destroy()
	ok := native.MaaResourceGetDefaultActionParam(r.handle, string(actionType), buf.Handle())
	if !ok {
		return nil, fmt.Errorf("failed to get default action param: %s", actionType)
	}

	jsonStr := buf.Get()
	if jsonStr == "" {
		return nil, errors.New("default action param is empty")
	}

	// Create the appropriate param type based on actionType
	var param ActionParam
	switch actionType {
	case ActionTypeDoNothing, "":
		param = &DoNothingParam{}
	case ActionTypeClick:
		param = &ClickParam{}
	case ActionTypeLongPress:
		param = &LongPressParam{}
	case ActionTypeSwipe:
		param = &SwipeParam{}
	case ActionTypeMultiSwipe:
		param = &MultiSwipeParam{}
	case ActionTypeTouchDown:
		param = &TouchDownParam{}
	case ActionTypeTouchMove:
		param = &TouchMoveParam{}
	case ActionTypeTouchUp:
		param = &TouchUpParam{}
	case ActionTypeClickKey:
		param = &ClickKeyParam{}
	case ActionTypeLongPressKey:
		param = &LongPressKeyParam{}
	case ActionTypeKeyDown:
		param = &KeyDownParam{}
	case ActionTypeKeyUp:
		param = &KeyUpParam{}
	case ActionTypeInputText:
		param = &InputTextParam{}
	case ActionTypeStartApp:
		param = &StartAppParam{}
	case ActionTypeStopApp:
		param = &StopAppParam{}
	case ActionTypeStopTask:
		param = &StopTaskParam{}
	case ActionTypeScroll:
		param = &ScrollParam{}
	case ActionTypeCommand:
		param = &CommandParam{}
	case ActionTypeShell:
		param = &ShellParam{}
	case ActionTypeScreencap:
		param = &ScreencapParam{}
	case ActionTypeCustom:
		param = &CustomActionParam{}
	default:
		return nil, fmt.Errorf("unknown action type: %s", actionType)
	}

	// Unmarshal the JSON string into the param
	if err := unmarshalJSON([]byte(jsonStr), param); err != nil {
		return nil, fmt.Errorf("failed to unmarshal default action param: %w", err)
	}

	return param, nil
}

// AddSink adds a event callback sink and returns the sink ID.
// The sink ID can be used to remove the sink later.
func (r *Resource) AddSink(sink ResourceEventSink) int64 {
	id := registerEventCallback(sink)
	sinkId := native.MaaResourceAddSink(
		r.handle,
		_MaaEventCallbackAgent,
		uintptr(id),
	)

	store.ResStore.Update(r.handle, func(v *store.ResStoreValue) {
		v.SinkIDToEventCallbackID[sinkId] = id
	})

	return sinkId
}

// RemoveSink removes a event callback sink by sink ID.
func (r *Resource) RemoveSink(sinkId int64) {
	store.ResStore.Update(r.handle, func(v *store.ResStoreValue) {
		unregisterEventCallback(v.SinkIDToEventCallbackID[sinkId])
		delete(v.SinkIDToEventCallbackID, sinkId)
	})

	native.MaaResourceRemoveSink(r.handle, sinkId)
}

// ClearSinks clears all event callback sinks.
func (r *Resource) ClearSinks() {
	store.ResStore.Update(r.handle, func(v *store.ResStoreValue) {
		for _, id := range v.SinkIDToEventCallbackID {
			unregisterEventCallback(id)
		}
		v.SinkIDToEventCallbackID = make(map[int64]uint64)
	})

	native.MaaResourceClearSinks(r.handle)
}

type ResourceEventSink interface {
	OnResourceLoading(res *Resource, event EventStatus, detail ResourceLoadingDetail)
}

// resourceEventSinkAdapter is a lightweight adapter that makes it easy to register
// a single-event handler via a callback function.
type resourceEventSinkAdapter struct {
	onResourceLoading func(EventStatus, ResourceLoadingDetail)
}

func (a *resourceEventSinkAdapter) OnResourceLoading(res *Resource, status EventStatus, detail ResourceLoadingDetail) {
	if a == nil || a.onResourceLoading == nil {
		return
	}
	a.onResourceLoading(status, detail)
}

// OnResourceLoading registers a callback sink that only handles Resource.Loading events and returns the sink ID.
// The sink ID can be used to remove the sink later.
func (r *Resource) OnResourceLoading(fn func(EventStatus, ResourceLoadingDetail)) int64 {
	sink := &resourceEventSinkAdapter{onResourceLoading: fn}
	return r.AddSink(sink)
}
