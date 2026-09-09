// MPE modifications (2026-09-09): bind MaaLinuxControllerCreate.
package native

import (
	"fmt"
	"path/filepath"
	"runtime"
	"unsafe"

	"github.com/ebitengine/purego"
)

var maaFramework uintptr

var MaaLinuxControllerCreate func(configJSON string) uintptr

const maaFrameworkName = "MaaFramework"

var (
	MaaVersion func() string
)

type MaaEventCallback func(handle uintptr, message, detailsJson *byte, transArg uintptr) uintptr

type MaaTaskerOption int32

var (
	MaaTaskerCreate               func() uintptr
	MaaTaskerDestroy              func(tasker uintptr)
	MaaTaskerAddSink              func(tasker uintptr, sink MaaEventCallback, transArg uintptr) int64
	MaaTaskerRemoveSink           func(tasker uintptr, sinkId int64)
	MaaTaskerClearSinks           func(tasker uintptr)
	MaaTaskerAddContextSink       func(tasker uintptr, sink MaaEventCallback, transArg uintptr) int64
	MaaTaskerRemoveContextSink    func(tasker uintptr, sinkId int64)
	MaaTaskerClearContextSinks    func(tasker uintptr)
	MaaTaskerSetOption            func(tasker uintptr, key MaaTaskerOption, value unsafe.Pointer, valSize uint64) bool
	MaaTaskerBindResource         func(tasker uintptr, res uintptr) bool
	MaaTaskerBindController       func(tasker uintptr, ctrl uintptr) bool
	MaaTaskerInited               func(tasker uintptr) bool
	MaaTaskerPostTask             func(tasker uintptr, entry, pipelineOverride string) int64
	MaaTaskerPostRecognition      func(tasker uintptr, recognitionType, recognitionParam string, image uintptr) int64
	MaaTaskerPostAction           func(tasker uintptr, actionType, actionParam string, box uintptr, recoDetail string) int64
	MaaTaskerStatus               func(tasker uintptr, id int64) int32
	MaaTaskerWait                 func(tasker uintptr, id int64) int32
	MaaTaskerRunning              func(tasker uintptr) bool
	MaaTaskerPostStop             func(tasker uintptr) int64
	MaaTaskerStopping             func(tasker uintptr) bool
	MaaTaskerGetResource          func(tasker uintptr) uintptr
	MaaTaskerGetController        func(tasker uintptr) uintptr
	MaaTaskerClearCache           func(tasker uintptr) bool
	MaaTaskerGetRecognitionDetail func(tasker uintptr, recoId int64, nodeName uintptr, algorithm uintptr, hit *bool, box uintptr, detailJson uintptr, raw uintptr, draws uintptr) bool
	MaaTaskerGetActionDetail      func(tasker uintptr, actionId int64, nodeName uintptr, action uintptr, box uintptr, success *bool, detailJson uintptr) bool
	MaaTaskerGetWaitFreezesDetail func(tasker uintptr, wfId int64, nodeName uintptr, phase uintptr, success *bool, elapsedMs *uint64, recoIdList uintptr, recoIdListSize *uint64, roi uintptr) bool
	MaaTaskerGetNodeDetail        func(tasker uintptr, nodeId int64, nodeName uintptr, recoId *int64, actionId *int64, completed *bool) bool
	MaaTaskerGetTaskDetail        func(tasker uintptr, taskId int64, entry uintptr, nodeIdList uintptr, nodeIdListSize *uint64, status *int32) bool
	MaaTaskerGetLatestNode        func(tasker uintptr, taskName string, latestId *int64) bool
	MaaTaskerOverridePipeline     func(tasker uintptr, taskId int64, pipelineOverride string) bool
)

type MaaCustomRecognitionCallback func(context uintptr, taskId int64, currentTaskName, customRecognitionName, customRecognitionParam *byte, image, roi, transArg, outBox, outDetail uintptr) uintptr

type MaaCustomActionCallback func(context uintptr, taskId int64, currentTaskName, customActionName, customActionParam *byte, recoId int64, box, transArg uintptr) uintptr

type MaaInferenceDevice int32

const (
	MaaInferenceDevice_CPU  MaaInferenceDevice = -2
	MaaInferenceDevice_Auto MaaInferenceDevice = -1
	MaaInferenceDevice_0    MaaInferenceDevice = 0
	MaaInferenceDevice_1    MaaInferenceDevice = 1
	// and more gpu id or flag...
)

type MaaInferenceExecutionProvider int32

const (

	// I don't recommend setting up MaaResOption_InferenceDevice in this case,
	// because you don't know which EP will be used on different user devices.
	MaaInferenceExecutionProvider_Auto = 0

	// MaaResOption_InferenceDevice will not work.
	MaaInferenceExecutionProvider_CPU = 1

	// MaaResOption_InferenceDevice will be used to set adapter id,
	// It's from Win32 API `EnumAdapters1`.
	MaaInferenceExecutionProvider_DirectML = 2

	// MaaResOption_InferenceDevice will be used to set coreml_flag,
	// Reference to
	// https://github.com/microsoft/onnxruntime/blob/main/include/onnxruntime/core/providers/coreml/coreml_provider_factory.h
	// But you need to pay attention to the onnxruntime version we use, the latest flag may not be supported.
	MaaInferenceExecutionProvider_CoreML = 3

	// MaaResOption_InferenceDevice will be used to set NVIDIA GPU ID
	// TODO!
	MaaInferenceExecutionProvider_CUDA = 4
)

type MaaResOption int32

const (
	MaaResOption_Invalid MaaResOption = 0

	/// Use the specified inference device.
	/// Please set this option before loading the model.
	///
	/// value: MaaInferenceDevice, eg: 0; val_size: sizeof(MaaInferenceDevice)
	/// default value is MaaInferenceDevice_Auto
	MaaResOption_InferenceDevice MaaResOption = 1

	/// Use the specified inference execution provider
	/// Please set this option before loading the model.
	///
	/// value: MaaInferenceExecutionProvider, eg: 0; val_size: sizeof(MaaInferenceExecutionProvider)
	/// default value is MaaInferenceExecutionProvider_Auto
	MaaResOption_InferenceExecutionProvider MaaResOption = 2
)

var (
	MaaResourceCreate                      func() uintptr
	MaaResourceDestroy                     func(res uintptr)
	MaaResourceAddSink                     func(res uintptr, sink MaaEventCallback, transArg uintptr) int64
	MaaResourceRemoveSink                  func(res uintptr, sinkId int64)
	MaaResourceClearSinks                  func(res uintptr)
	MaaResourceRegisterCustomRecognition   func(res uintptr, name string, recognition MaaCustomRecognitionCallback, transArg uintptr) bool
	MaaResourceUnregisterCustomRecognition func(res uintptr, name string) bool
	MaaResourceClearCustomRecognition      func(res uintptr) bool
	MaaResourceRegisterCustomAction        func(res uintptr, name string, action MaaCustomActionCallback, transArg uintptr) bool
	MaaResourceUnregisterCustomAction      func(res uintptr, name string) bool
	MaaResourceClearCustomAction           func(res uintptr) bool
	MaaResourcePostBundle                  func(res uintptr, path string) int64
	MaaResourcePostOcrModel                func(res uintptr, path string) int64
	MaaResourcePostPipeline                func(res uintptr, path string) int64
	MaaResourcePostImage                   func(res uintptr, path string) int64
	MaaResourceOverridePipeline            func(res uintptr, pipelineOverride string) bool
	MaaResourceOverrideNext                func(res uintptr, nodeName string, nextList uintptr) bool
	MaaResourceOverrideImage               func(res uintptr, imageName string, image uintptr) bool
	MaaResourceGetNodeData                 func(res uintptr, nodeName string, buffer uintptr) bool
	MaaResourceClear                       func(res uintptr) bool
	MaaResourceStatus                      func(res uintptr, id int64) int32
	MaaResourceWait                        func(res uintptr, id int64) int32
	MaaResourceLoaded                      func(res uintptr) bool
	MaaResourceSetOption                   func(res uintptr, key MaaResOption, value unsafe.Pointer, valSize uint64) bool
	MaaResourceGetHash                     func(res uintptr, buffer uintptr) bool
	MaaResourceGetNodeList                 func(res uintptr, buffer uintptr) bool
	MaaResourceGetCustomRecognitionList    func(res uintptr, buffer uintptr) bool
	MaaResourceGetCustomActionList         func(res uintptr, buffer uintptr) bool
	MaaResourceGetDefaultRecognitionParam  func(res uintptr, recoType string, buffer uintptr) bool
	MaaResourceGetDefaultActionParam       func(res uintptr, actionType string, buffer uintptr) bool
)

type MaaCtrlOption int32

const (
	MaaCtrlOption_Invalid MaaCtrlOption = 0

	// MaaCtrlOptionScreenshotTargetLongSide specifies that only the long side can be set, and the short side
	// is automatically scaled according to the aspect ratio.
	MaaCtrlOption_ScreenshotTargetLongSide MaaCtrlOption = 1

	// MaaCtrlOptionScreenshotTargetShortSide specifies that only the short side can be set, and the long side
	// is automatically scaled according to the aspect ratio.
	MaaCtrlOption_ScreenshotTargetShortSide MaaCtrlOption = 2

	// MaaCtrlOptionScreenshotUseRawSize specifies that the screenshot uses the raw size without scaling.
	// Note that this option may cause incorrect coordinates on user devices with different resolutions if scaling is not performed.
	MaaCtrlOption_ScreenshotUseRawSize MaaCtrlOption = 3

	// MaaCtrlOption_MouseLockFollow enables or disables mouse-lock-follow mode for Win32 controllers.
	// This is designed for TPS/FPS games that lock the mouse to their window in the background.
	// Only valid for Win32 controllers using message-based input methods.
	//
	// value: bool, eg: true; val_size: sizeof(bool)
	MaaCtrlOption_MouseLockFollow MaaCtrlOption = 4

	// MaaCtrlOption_ScreenshotResizeMethod sets the interpolation method used when resizing screenshots.
	// Value corresponds to cv::InterpolationFlags:
	//   INTER_NEAREST=0, INTER_LINEAR=1, INTER_CUBIC=2, INTER_AREA=3, INTER_LANCZOS4=4
	// Default is INTER_AREA (3).
	//
	// value: int, eg: 3; val_size: sizeof(int)
	MaaCtrlOption_ScreenshotResizeMethod MaaCtrlOption = 6
)

type MaaGamepadType uint64

const (
	MaaGamepadType_Xbox360    MaaGamepadType = 0
	MaaGamepadType_DualShock4 MaaGamepadType = 1
)

// MaaMacOSScreencapMethod defines the macOS screencap method.
// Select ONE method only.
type MaaMacOSScreencapMethod uint64

const (
	MaaMacOSScreencapMethod_None             MaaMacOSScreencapMethod = 0
	MaaMacOSScreencapMethod_ScreenCaptureKit MaaMacOSScreencapMethod = 1
)

// MaaMacOSInputMethod defines the macOS input method.
// Select ONE method only.
type MaaMacOSInputMethod uint64

const (
	MaaMacOSInputMethod_None        MaaMacOSInputMethod = 0
	MaaMacOSInputMethod_GlobalEvent MaaMacOSInputMethod = 1
	MaaMacOSInputMethod_PostToPid   MaaMacOSInputMethod = 1 << 1
)

// NOTE: MaaDbgControllerCreate is intentionally NOT implemented in the Go binding.
// MaaDbgControllerCreate has been superseded by more specific alternatives:
//   - BlankController (blank_controller.go): no-op stub that always succeeds
//   - NewReplayController: replay recorded operations from a JSONL file
// Do NOT add a Go binding for MaaDbgControllerCreate or MaaDbgControllerType here.
// The api-check CI tool also blacklists MaaDbgControllerCreate for the same reason.

var (
	MaaAdbControllerCreate           func(adbPath, address string, screencapMethods uint64, inputMethods uint64, config, agentPath string) uintptr
	MaaPlayCoverControllerCreate     func(address, uuid string) uintptr
	MaaWin32ControllerCreate         func(hWnd unsafe.Pointer, screencapMethods uint64, mouseMethod, keyboardMethod uint64) uintptr
	MaaWlRootsControllerCreate       func(wlrSocketPath string, useWin32VkCode bool) uintptr
	MaaCustomControllerCreate        func(controller unsafe.Pointer, controllerArg uintptr) uintptr
	MaaGamepadControllerCreate       func(hWnd unsafe.Pointer, gamepadType MaaGamepadType, screencapMethod uint64) uintptr
	MaaMacOSControllerCreate         func(windowID uint32, screencapMethod MaaMacOSScreencapMethod, inputMethod MaaMacOSInputMethod) uintptr
	MaaAndroidNativeControllerCreate func(configJson string) uintptr
	MaaReplayControllerCreate        func(recordingPath string) uintptr
	MaaRecordControllerCreate        func(inner uintptr, recordingPath string) uintptr
	MaaControllerDestroy             func(ctrl uintptr)
	MaaControllerAddSink             func(ctrl uintptr, sink MaaEventCallback, transArg uintptr) int64
	MaaControllerRemoveSink          func(ctrl uintptr, sinkId int64)
	MaaControllerClearSinks          func(ctrl uintptr)
	MaaControllerSetOption           func(ctrl uintptr, key MaaCtrlOption, value unsafe.Pointer, valSize uint64) bool
	MaaControllerPostConnection      func(ctrl uintptr) int64
	MaaControllerPostClick           func(ctrl uintptr, x, y int32) int64
	// for adb controller, contact means finger id (0 for first finger, 1 for second finger, etc)
	// for win32 controller, contact means mouse button id (0 for left, 1 for right, 2 for middle)
	MaaControllerPostClickV2      func(ctrl uintptr, x, y, contact, pressure int32) int64
	MaaControllerPostSwipe        func(ctrl uintptr, x1, y1, x2, y2, duration int32) int64
	MaaControllerPostSwipeV2      func(ctrl uintptr, x1, y1, x2, y2, duration, contact, pressure int32) int64
	MaaControllerPostClickKey     func(ctrl uintptr, keycode int32) int64
	MaaControllerPostInputText    func(ctrl uintptr, text string) int64
	MaaControllerPostStartApp     func(ctrl uintptr, intent string) int64
	MaaControllerPostStopApp      func(ctrl uintptr, intent string) int64
	MaaControllerPostTouchDown    func(ctrl uintptr, contact, x, y, pressure int32) int64
	MaaControllerPostTouchMove    func(ctrl uintptr, contact, x, y, pressure int32) int64
	MaaControllerPostTouchUp      func(ctrl uintptr, contact int32) int64
	MaaControllerPostRelativeMove func(ctrl uintptr, dx, dy int32) int64
	MaaControllerPostKeyDown      func(ctrl uintptr, keycode int32) int64
	MaaControllerPostKeyUp        func(ctrl uintptr, keycode int32) int64
	MaaControllerPostScreencap    func(ctrl uintptr) int64
	MaaControllerPostScroll       func(ctrl uintptr, dx, dy int32) int64
	MaaControllerPostInactive     func(ctrl uintptr) int64
	MaaControllerPostShell        func(ctrl uintptr, cmd string, timeout int64) int64
	MaaControllerGetShellOutput   func(ctrl uintptr, buffer uintptr) bool
	MaaControllerStatus           func(ctrl uintptr, id int64) int32
	MaaControllerWait             func(ctrl uintptr, id int64) int32
	MaaControllerConnected        func(ctrl uintptr) bool
	MaaControllerCachedImage      func(ctrl uintptr, buffer uintptr) bool
	MaaControllerGetUuid          func(ctrl uintptr, buffer uintptr) bool
	MaaControllerGetResolution    func(ctrl uintptr, width, height *int32) bool
	MaaControllerGetInfo          func(ctrl uintptr, buffer uintptr) bool
)

var (
	MaaContextRunTask              func(context uintptr, entry, pipelineOverride string) int64
	MaaContextRunRecognition       func(context uintptr, entry, pipelineOverride string, image uintptr) int64
	MaaContextRunAction            func(context uintptr, entry, pipelineOverride string, box uintptr, recoDetail string) int64
	MaaContextRunRecognitionDirect func(context uintptr, recoType, recoParam string, image uintptr) int64
	MaaContextRunActionDirect      func(context uintptr, actionType, actionParam string, box uintptr, recoDetail string) int64
	MaaContextWaitFreezes          func(context uintptr, time uint64, box uintptr, waitFreezesParam string) bool
	MaaContextOverridePipeline     func(context uintptr, pipelineOverride string) bool
	MaaContextOverrideNext         func(context uintptr, nodeName string, nextList uintptr) bool
	MaaContextOverrideImage        func(context uintptr, imageName string, image uintptr) bool
	MaaContextGetNodeData          func(context uintptr, nodeName string, buffer uintptr) bool
	MaaContextGetTaskId            func(context uintptr) int64
	MaaContextGetTasker            func(context uintptr) uintptr
	MaaContextClone                func(context uintptr) uintptr
	MaaContextSetAnchor            func(context uintptr, anchorName, nodeName string) bool
	MaaContextGetAnchor            func(context uintptr, anchorName string, buffer uintptr) bool
	MaaContextGetHitCount          func(context uintptr, nodeName string, count *uint64) bool
	MaaContextClearHitCount        func(context uintptr, nodeName string) bool
)

var (
	MaaStringBufferCreate  func() uintptr
	MaaStringBufferDestroy func(handle uintptr)
	MaaStringBufferIsEmpty func(handle uintptr) bool
	MaaStringBufferClear   func(handle uintptr) bool
	MaaStringBufferGet     func(handle uintptr) string
	MaaStringBufferSize    func(handle uintptr) uint64
	MaaStringBufferSet     func(handle uintptr, str string) bool
	MaaStringBufferSetEx   func(handle uintptr, str string, size uint64) bool

	MaaStringListBufferCreate  func() uintptr
	MaaStringListBufferDestroy func(handle uintptr)
	MaaStringListBufferIsEmpty func(handle uintptr) bool
	MaaStringListBufferSize    func(handle uintptr) uint64
	MaaStringListBufferAt      func(handle uintptr, index uint64) uintptr
	MaaStringListBufferAppend  func(handle uintptr, value uintptr) bool
	MaaStringListBufferRemove  func(handle uintptr, index uint64) bool
	MaaStringListBufferClear   func(handle uintptr) bool

	MaaImageBufferCreate     func() uintptr
	MaaImageBufferDestroy    func(handle uintptr)
	MaaImageBufferIsEmpty    func(handle uintptr) bool
	MaaImageBufferClear      func(handle uintptr) bool
	MaaImageBufferGetRawData func(handle uintptr) unsafe.Pointer
	MaaImageBufferWidth      func(handle uintptr) int32
	MaaImageBufferHeight     func(handle uintptr) int32
	MaaImageBufferChannels   func(handle uintptr) int32
	MaaImageBufferType       func(handle uintptr) int32
	MaaImageBufferSetRawData func(handle uintptr, data unsafe.Pointer, width, height, imageType int32) bool
	MaaImageBufferResize     func(handle uintptr, width, height int32) bool
	// NOTE: MaaImageBufferGetEncoded, MaaImageBufferGetEncodedSize, and MaaImageBufferSetEncoded are intentionally
	// NOT implemented in Go binding. Go handles image encoding/decoding natively through the standard library.
	// Do not add encoded image buffer bindings here.

	MaaImageListBufferCreate  func() uintptr
	MaaImageListBufferDestroy func(handle uintptr)
	MaaImageListBufferIsEmpty func(handle uintptr) bool
	MaaImageListBufferSize    func(handle uintptr) uint64
	MaaImageListBufferAt      func(handle uintptr, index uint64) uintptr
	MaaImageListBufferAppend  func(handle uintptr, value uintptr) bool
	MaaImageListBufferRemove  func(handle uintptr, index uint64) bool
	MaaImageListBufferClear   func(handle uintptr) bool

	MaaRectCreate  func() uintptr
	MaaRectDestroy func(handle uintptr)
	MaaRectGetX    func(handle uintptr) int32
	MaaRectGetY    func(handle uintptr) int32
	MaaRectGetW    func(handle uintptr) int32
	MaaRectGetH    func(handle uintptr) int32
	MaaRectSet     func(handle uintptr, x, y, w, h int32) bool
)

type MaaGlobalOption int32

const (
	MaaGlobalOption_Invalid MaaGlobalOption = 0

	// MaaGlobalOption_LogDir Log dir
	//
	// value: string, eg: "C:\\Users\\Administrator\\Desktop\\log"; val_size: string length
	MaaGlobalOption_LogDir MaaGlobalOption = 1

	// MaaGlobalOption_SaveDraw Whether to save draw
	//
	// value: bool, eg: true; val_size: sizeof(bool)
	MaaGlobalOption_SaveDraw MaaGlobalOption = 2

	// MaaGlobalOption_StdoutLevel The level of log output to stdout
	//
	// value: MaaLoggingLevel, val_size: sizeof(MaaLoggingLevel)
	// default value is MaaLoggingLevel_Error
	MaaGlobalOption_StdoutLevel MaaGlobalOption = 4

	// MaaGlobalOption_DebugMode Whether to debug
	//
	// value: bool, eg: true; val_size: sizeof(bool)
	MaaGlobalOption_DebugMode MaaGlobalOption = 6

	// MaaGlobalOption_SaveOnError Whether to save screenshot on error
	//
	// value: bool, eg: true; val_size: sizeof(bool)
	MaaGlobalOption_SaveOnError MaaGlobalOption = 7

	// MaaGlobalOption_DrawQuality Image quality for draw images
	//
	// value: int, eg: 85; val_size: sizeof(int)
	// default value is 85, range: [0, 100]
	MaaGlobalOption_DrawQuality MaaGlobalOption = 8

	// MaaGlobalOption_RecoImageCacheLimit Recognition image cache limit
	//
	// value: size_t, eg: 4096; val_size: sizeof(size_t)
	// default value is 4096
	MaaGlobalOption_RecoImageCacheLimit MaaGlobalOption = 9
)

var (
	MaaGlobalSetOption  func(key MaaGlobalOption, value unsafe.Pointer, valSize uint64) bool
	MaaGlobalLoadPlugin func(path string) bool
)

var frameworkEntries = []Entry{
	{&MaaVersion, "MaaVersion"},
	{&MaaTaskerCreate, "MaaTaskerCreate"},
	{&MaaTaskerDestroy, "MaaTaskerDestroy"},
	{&MaaTaskerAddSink, "MaaTaskerAddSink"},
	{&MaaTaskerRemoveSink, "MaaTaskerRemoveSink"},
	{&MaaTaskerClearSinks, "MaaTaskerClearSinks"},
	{&MaaTaskerAddContextSink, "MaaTaskerAddContextSink"},
	{&MaaTaskerRemoveContextSink, "MaaTaskerRemoveContextSink"},
	{&MaaTaskerClearContextSinks, "MaaTaskerClearContextSinks"},
	{&MaaTaskerSetOption, "MaaTaskerSetOption"},
	{&MaaTaskerBindResource, "MaaTaskerBindResource"},
	{&MaaTaskerBindController, "MaaTaskerBindController"},
	{&MaaTaskerInited, "MaaTaskerInited"},
	{&MaaTaskerPostTask, "MaaTaskerPostTask"},
	{&MaaTaskerPostRecognition, "MaaTaskerPostRecognition"},
	{&MaaTaskerPostAction, "MaaTaskerPostAction"},
	{&MaaTaskerStopping, "MaaTaskerStopping"},
	{&MaaTaskerStatus, "MaaTaskerStatus"},
	{&MaaTaskerWait, "MaaTaskerWait"},
	{&MaaTaskerRunning, "MaaTaskerRunning"},
	{&MaaTaskerPostStop, "MaaTaskerPostStop"},
	{&MaaTaskerGetResource, "MaaTaskerGetResource"},
	{&MaaTaskerGetController, "MaaTaskerGetController"},
	{&MaaTaskerClearCache, "MaaTaskerClearCache"},
	{&MaaTaskerGetRecognitionDetail, "MaaTaskerGetRecognitionDetail"},
	{&MaaTaskerGetActionDetail, "MaaTaskerGetActionDetail"},
	{&MaaTaskerGetWaitFreezesDetail, "MaaTaskerGetWaitFreezesDetail"},
	{&MaaTaskerGetNodeDetail, "MaaTaskerGetNodeDetail"},
	{&MaaTaskerGetTaskDetail, "MaaTaskerGetTaskDetail"},
	{&MaaTaskerGetLatestNode, "MaaTaskerGetLatestNode"},
	{&MaaTaskerOverridePipeline, "MaaTaskerOverridePipeline"},
	{&MaaResourceCreate, "MaaResourceCreate"},
	{&MaaResourceDestroy, "MaaResourceDestroy"},
	{&MaaResourceAddSink, "MaaResourceAddSink"},
	{&MaaResourceRemoveSink, "MaaResourceRemoveSink"},
	{&MaaResourceClearSinks, "MaaResourceClearSinks"},
	{&MaaResourceRegisterCustomRecognition, "MaaResourceRegisterCustomRecognition"},
	{&MaaResourceUnregisterCustomRecognition, "MaaResourceUnregisterCustomRecognition"},
	{&MaaResourceClearCustomRecognition, "MaaResourceClearCustomRecognition"},
	{&MaaResourceRegisterCustomAction, "MaaResourceRegisterCustomAction"},
	{&MaaResourceUnregisterCustomAction, "MaaResourceUnregisterCustomAction"},
	{&MaaResourceClearCustomAction, "MaaResourceClearCustomAction"},
	{&MaaResourcePostBundle, "MaaResourcePostBundle"},
	{&MaaResourcePostOcrModel, "MaaResourcePostOcrModel"},
	{&MaaResourcePostPipeline, "MaaResourcePostPipeline"},
	{&MaaResourcePostImage, "MaaResourcePostImage"},
	{&MaaResourceOverridePipeline, "MaaResourceOverridePipeline"},
	{&MaaResourceOverrideNext, "MaaResourceOverrideNext"},
	{&MaaResourceOverrideImage, "MaaResourceOverrideImage"},
	{&MaaResourceGetNodeData, "MaaResourceGetNodeData"},
	{&MaaResourceClear, "MaaResourceClear"},
	{&MaaResourceStatus, "MaaResourceStatus"},
	{&MaaResourceWait, "MaaResourceWait"},
	{&MaaResourceLoaded, "MaaResourceLoaded"},
	{&MaaResourceSetOption, "MaaResourceSetOption"},
	{&MaaResourceGetHash, "MaaResourceGetHash"},
	{&MaaResourceGetNodeList, "MaaResourceGetNodeList"},
	{&MaaResourceGetCustomRecognitionList, "MaaResourceGetCustomRecognitionList"},
	{&MaaResourceGetCustomActionList, "MaaResourceGetCustomActionList"},
	{&MaaResourceGetDefaultRecognitionParam, "MaaResourceGetDefaultRecognitionParam"},
	{&MaaResourceGetDefaultActionParam, "MaaResourceGetDefaultActionParam"},
	{&MaaAdbControllerCreate, "MaaAdbControllerCreate"},
	{&MaaPlayCoverControllerCreate, "MaaPlayCoverControllerCreate"},
	{&MaaWin32ControllerCreate, "MaaWin32ControllerCreate"},
	{&MaaWlRootsControllerCreate, "MaaWlRootsControllerCreate"},
	{&MaaLinuxControllerCreate, "MaaLinuxControllerCreate"},
	{&MaaCustomControllerCreate, "MaaCustomControllerCreate"},
	{&MaaGamepadControllerCreate, "MaaGamepadControllerCreate"},
	{&MaaMacOSControllerCreate, "MaaMacOSControllerCreate"},
	{&MaaAndroidNativeControllerCreate, "MaaAndroidNativeControllerCreate"},
	{&MaaReplayControllerCreate, "MaaReplayControllerCreate"},
	{&MaaRecordControllerCreate, "MaaRecordControllerCreate"},
	{&MaaControllerDestroy, "MaaControllerDestroy"},
	{&MaaControllerAddSink, "MaaControllerAddSink"},
	{&MaaControllerRemoveSink, "MaaControllerRemoveSink"},
	{&MaaControllerClearSinks, "MaaControllerClearSinks"},
	{&MaaControllerSetOption, "MaaControllerSetOption"},
	{&MaaControllerPostConnection, "MaaControllerPostConnection"},
	{&MaaControllerPostClick, "MaaControllerPostClick"},
	{&MaaControllerPostClickV2, "MaaControllerPostClickV2"},
	{&MaaControllerPostSwipe, "MaaControllerPostSwipe"},
	{&MaaControllerPostSwipeV2, "MaaControllerPostSwipeV2"},
	{&MaaControllerPostClickKey, "MaaControllerPostClickKey"},
	{&MaaControllerPostInputText, "MaaControllerPostInputText"},
	{&MaaControllerPostStartApp, "MaaControllerPostStartApp"},
	{&MaaControllerPostStopApp, "MaaControllerPostStopApp"},
	{&MaaControllerPostTouchDown, "MaaControllerPostTouchDown"},
	{&MaaControllerPostTouchMove, "MaaControllerPostTouchMove"},
	{&MaaControllerPostTouchUp, "MaaControllerPostTouchUp"},
	{&MaaControllerPostRelativeMove, "MaaControllerPostRelativeMove"},
	{&MaaControllerPostKeyDown, "MaaControllerPostKeyDown"},
	{&MaaControllerPostKeyUp, "MaaControllerPostKeyUp"},
	{&MaaControllerPostScreencap, "MaaControllerPostScreencap"},
	{&MaaControllerPostScroll, "MaaControllerPostScroll"},
	{&MaaControllerPostInactive, "MaaControllerPostInactive"},
	{&MaaControllerPostShell, "MaaControllerPostShell"},
	{&MaaControllerGetShellOutput, "MaaControllerGetShellOutput"},
	{&MaaControllerStatus, "MaaControllerStatus"},
	{&MaaControllerWait, "MaaControllerWait"},
	{&MaaControllerConnected, "MaaControllerConnected"},
	{&MaaControllerCachedImage, "MaaControllerCachedImage"},
	{&MaaControllerGetUuid, "MaaControllerGetUuid"},
	{&MaaControllerGetResolution, "MaaControllerGetResolution"},
	{&MaaControllerGetInfo, "MaaControllerGetInfo"},
	{&MaaContextRunTask, "MaaContextRunTask"},
	{&MaaContextRunRecognition, "MaaContextRunRecognition"},
	{&MaaContextRunAction, "MaaContextRunAction"},
	{&MaaContextRunRecognitionDirect, "MaaContextRunRecognitionDirect"},
	{&MaaContextRunActionDirect, "MaaContextRunActionDirect"},
	{&MaaContextWaitFreezes, "MaaContextWaitFreezes"},
	{&MaaContextOverridePipeline, "MaaContextOverridePipeline"},
	{&MaaContextOverrideNext, "MaaContextOverrideNext"},
	{&MaaContextOverrideImage, "MaaContextOverrideImage"},
	{&MaaContextGetNodeData, "MaaContextGetNodeData"},
	{&MaaContextGetTaskId, "MaaContextGetTaskId"},
	{&MaaContextGetTasker, "MaaContextGetTasker"},
	{&MaaContextClone, "MaaContextClone"},
	{&MaaContextSetAnchor, "MaaContextSetAnchor"},
	{&MaaContextGetAnchor, "MaaContextGetAnchor"},
	{&MaaContextGetHitCount, "MaaContextGetHitCount"},
	{&MaaContextClearHitCount, "MaaContextClearHitCount"},
	{&MaaStringBufferCreate, "MaaStringBufferCreate"},
	{&MaaStringBufferDestroy, "MaaStringBufferDestroy"},
	{&MaaStringBufferIsEmpty, "MaaStringBufferIsEmpty"},
	{&MaaStringBufferClear, "MaaStringBufferClear"},
	{&MaaStringBufferGet, "MaaStringBufferGet"},
	{&MaaStringBufferSize, "MaaStringBufferSize"},
	{&MaaStringBufferSet, "MaaStringBufferSet"},
	{&MaaStringBufferSetEx, "MaaStringBufferSetEx"},
	{&MaaStringListBufferCreate, "MaaStringListBufferCreate"},
	{&MaaStringListBufferDestroy, "MaaStringListBufferDestroy"},
	{&MaaStringListBufferIsEmpty, "MaaStringListBufferIsEmpty"},
	{&MaaStringListBufferSize, "MaaStringListBufferSize"},
	{&MaaStringListBufferAt, "MaaStringListBufferAt"},
	{&MaaStringListBufferAppend, "MaaStringListBufferAppend"},
	{&MaaStringListBufferRemove, "MaaStringListBufferRemove"},
	{&MaaStringListBufferClear, "MaaStringListBufferClear"},
	{&MaaImageBufferCreate, "MaaImageBufferCreate"},
	{&MaaImageBufferDestroy, "MaaImageBufferDestroy"},
	{&MaaImageBufferIsEmpty, "MaaImageBufferIsEmpty"},
	{&MaaImageBufferClear, "MaaImageBufferClear"},
	{&MaaImageBufferGetRawData, "MaaImageBufferGetRawData"},
	{&MaaImageBufferWidth, "MaaImageBufferWidth"},
	{&MaaImageBufferHeight, "MaaImageBufferHeight"},
	{&MaaImageBufferChannels, "MaaImageBufferChannels"},
	{&MaaImageBufferType, "MaaImageBufferType"},
	{&MaaImageBufferSetRawData, "MaaImageBufferSetRawData"},
	{&MaaImageBufferResize, "MaaImageBufferResize"},
	{&MaaImageListBufferCreate, "MaaImageListBufferCreate"},
	{&MaaImageListBufferDestroy, "MaaImageListBufferDestroy"},
	{&MaaImageListBufferIsEmpty, "MaaImageListBufferIsEmpty"},
	{&MaaImageListBufferSize, "MaaImageListBufferSize"},
	{&MaaImageListBufferAt, "MaaImageListBufferAt"},
	{&MaaImageListBufferAppend, "MaaImageListBufferAppend"},
	{&MaaImageListBufferRemove, "MaaImageListBufferRemove"},
	{&MaaImageListBufferClear, "MaaImageListBufferClear"},
	{&MaaRectCreate, "MaaRectCreate"},
	{&MaaRectDestroy, "MaaRectDestroy"},
	{&MaaRectGetX, "MaaRectGetX"},
	{&MaaRectGetY, "MaaRectGetY"},
	{&MaaRectGetW, "MaaRectGetW"},
	{&MaaRectGetH, "MaaRectGetH"},
	{&MaaRectSet, "MaaRectSet"},
	{&MaaGlobalSetOption, "MaaGlobalSetOption"},
	{&MaaGlobalLoadPlugin, "MaaGlobalLoadPlugin"},
}

func initFramework(libDir string) error {
	libName := getMaaFrameworkLibrary()
	libPath := filepath.Join(libDir, libName)

	handle, err := openLibrary(libPath)
	if err != nil {
		return &LibraryLoadError{
			LibraryName: maaFrameworkName,
			LibraryPath: libPath,
			Err:         err,
		}
	}

	maaFramework = handle

	registerFramework()

	return nil
}

func getMaaFrameworkLibrary() string {
	switch runtime.GOOS {
	case "darwin":
		return "libMaaFramework.dylib"
	case "linux":
		return "libMaaFramework.so"
	case "windows":
		return "MaaFramework.dll"
	default:
		panic(fmt.Errorf("GOOS=%s is not supported", runtime.GOOS))
	}
}

func registerFramework() {
	for _, entry := range frameworkEntries {
		purego.RegisterLibFunc(entry.ptrToFunc, maaFramework, entry.name)
	}
}

func releaseFramework() error {
	err := unloadLibrary(maaFramework)
	if err != nil {
		return err
	}

	unregisterFramework()

	return nil
}

func unregisterFramework() {
	for _, entry := range frameworkEntries {
		clearFuncVar(entry.ptrToFunc)
	}
}
