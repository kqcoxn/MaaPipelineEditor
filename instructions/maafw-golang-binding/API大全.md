Constants
View Source
const (
EventResourceLoading = Event("Resource.Loading")
EventControllerAction = Event("Controller.Action")
EventTaskerTask = Event("Tasker.Task")
EventNodePipelineNode = Event("Node.PipelineNode")
EventNodeRecognitionNode = Event("Node.RecognitionNode")
EventNodeActionNode = Event("Node.ActionNode")
EventNodeNextList = Event("Node.NextList")
EventNodeRecognition = Event("Node.Recognition")
EventNodeAction = Event("Node.Action")
)
View Source
const (
TemplateMatchOrderByHorizontal = TemplateMatchOrderBy(OrderByHorizontal)
TemplateMatchOrderByVertical = TemplateMatchOrderBy(OrderByVertical)
TemplateMatchOrderByScore = TemplateMatchOrderBy(OrderByScore)
TemplateMatchOrderByRandom = TemplateMatchOrderBy(OrderByRandom)
)
View Source
const (
FeatureMatchOrderByHorizontal = FeatureMatchOrderBy(OrderByHorizontal)
FeatureMatchOrderByVertical = FeatureMatchOrderBy(OrderByVertical)
FeatureMatchOrderByScore = FeatureMatchOrderBy(OrderByScore)
FeatureMatchOrderByArea = FeatureMatchOrderBy(OrderByArea)
FeatureMatchOrderByRandom = FeatureMatchOrderBy(OrderByRandom)
)
View Source
const (
ColorMatchOrderByHorizontal = ColorMatchOrderBy(OrderByHorizontal)
ColorMatchOrderByVertical = ColorMatchOrderBy(OrderByVertical)
ColorMatchOrderByScore = ColorMatchOrderBy(OrderByScore)
ColorMatchOrderByArea = ColorMatchOrderBy(OrderByArea)
ColorMatchOrderByRandom = ColorMatchOrderBy(OrderByRandom)
)
View Source
const (
OCROrderByHorizontal = OCROrderBy(OrderByHorizontal)
OCROrderByVertical = OCROrderBy(OrderByVertical)
OCROrderByArea = OCROrderBy(OrderByArea)
OCROrderByLength = OCROrderBy(OrderByLength)
OCROrderByRandom = OCROrderBy(OrderByRandom)
OCROrderByExpected = OCROrderBy(OrderByExpected)
)
View Source
const (
NeuralNetworkClassifyOrderByHorizontal = NeuralNetworkClassifyOrderBy(OrderByHorizontal)
NeuralNetworkClassifyOrderByVertical = NeuralNetworkClassifyOrderBy(OrderByVertical)
NeuralNetworkClassifyOrderByScore = NeuralNetworkClassifyOrderBy(OrderByScore)
NeuralNetworkClassifyOrderByRandom = NeuralNetworkClassifyOrderBy(OrderByRandom)
NeuralNetworkClassifyOrderByExpected = NeuralNetworkClassifyOrderBy(OrderByExpected)
)
View Source
const (
NeuralNetworkDetectOrderByHorizontal = NeuralNetworkDetectOrderBy(OrderByHorizontal)
NeuralNetworkDetectOrderByVertical = NeuralNetworkDetectOrderBy(OrderByVertical)
NeuralNetworkDetectOrderByScore = NeuralNetworkDetectOrderBy(OrderByScore)
NeuralNetworkDetectOrderByArea = NeuralNetworkDetectOrderBy(OrderByArea)
NeuralNetworkDetectOrderByRandom = NeuralNetworkDetectOrderBy(OrderByRandom)
NeuralNetworkDetectOrderByExpected = NeuralNetworkDetectOrderBy(OrderByExpected)
)
Variables
View Source
var (
ErrInvalidAgentClient = errors.New("invalid agent client")
ErrInvalidResource = errors.New("invalid resource")
ErrInvalidController = errors.New("invalid controller")
ErrInvalidTasker = errors.New("invalid tasker")
ErrInvalidTimeout = errors.New("timeout must be non-negative")
)
View Source
var (
ErrAlreadyInitialized = errors.New("maa framework already initialized")
ErrNotInitialized = errors.New("maa framework not initialized")
ErrSetLogDir = errors.New("failed to set log directory")
ErrSetSaveDraw = errors.New("failed to set save draw option")
ErrSetStdoutLevel = errors.New("failed to set stdout level")
ErrSetDebugMode = errors.New("failed to set debug mode")
ErrSetSaveOnError = errors.New("failed to set save on error option")
ErrSetDrawQuality = errors.New("failed to set draw quality")
ErrSetRecoImageCacheLimit = errors.New("failed to set recognition image cache limit")
ErrLoadPlugin = errors.New("failed to load plugin")
ErrEmptyLogDir = errors.New("log directory path is empty")
)
Functions
func AgentServerAddContextSink
func AgentServerAddContextSink(sink ContextEventSink) int64
AgentServerAddContextSink adds a context event callback sink and returns the sink ID.

func AgentServerAddControllerSink
func AgentServerAddControllerSink(sink ControllerEventSink) int64
AgentServerAddControllerSink adds a controller event callback sink and returns the sink ID.

func AgentServerAddResourceSink
func AgentServerAddResourceSink(sink ResourceEventSink) int64
AgentServerAddResourceSink adds a resource event callback sink and returns the sink ID.

func AgentServerAddTaskerSink
func AgentServerAddTaskerSink(sink TaskerEventSink) int64
AgentServerAddTaskerSink adds a tasker event callback sink and returns the sink ID.

func AgentServerDetach
func AgentServerDetach()
AgentServerDetach detaches the service thread to run independently. It allows the service to run in the background without blocking.

func AgentServerJoin
func AgentServerJoin()
AgentServerJoin waits for the agent service to end. It blocks the current goroutine until the service ends.

func AgentServerRegisterCustomAction
func AgentServerRegisterCustomAction(name string, action CustomActionRunner) error
AgentServerRegisterCustomAction registers a custom action runner. The name should match the custom_action field in Pipeline.

func AgentServerRegisterCustomRecognition
func AgentServerRegisterCustomRecognition(name string, recognition CustomRecognitionRunner) error
AgentServerRegisterCustomRecognition registers a custom recognition runner. The name should match the custom_recognition field in Pipeline.

func AgentServerShutDown
func AgentServerShutDown()
AgentServerShutDown shuts down the MAA Agent Server.

func AgentServerStartUp
func AgentServerStartUp(identifier string) error
AgentServerStartUp starts the MAA Agent Server with the given identifier. The identifier is used to match with AgentClient.

func ConfigInitOption
func ConfigInitOption(userPath, defaultJson string) error
ConfigInitOption inits the toolkit config option.

func Init
func Init(opts ...InitOption) error
Init loads the dynamic library related to the MAA framework and registers its related functions. It must be called before invoking any other MAA-related functions. Note: If this function is not called before other MAA functions, it will trigger a null pointer panic.

func IsInited
func IsInited() bool
IsInited checks if the MAA framework has been initialized.

func LoadPlugin
func LoadPlugin(path string) error
LoadPlugin loads a plugin specified by path. The path may be a full filesystem path or just a plugin name. When only a name is provided, the function searches system directories and the current working directory for a matching plugin. If the path refers to a directory, plugins inside that directory are searched recursively.

func Release
func Release() error
Release releases the dynamic library resources of the MAA framework and unregisters its related functions. It must be called only after the framework has been initialized via Init.

func SetDebugMode
func SetDebugMode(enabled bool) error
SetDebugMode sets whether to enable debug mode.

func SetDrawQuality
func SetDrawQuality(quality int32) error
SetDrawQuality sets image quality for draw images. Default value is 85, range: [0, 100].

func SetLogDir
func SetLogDir(path string) error
SetLogDir sets the log directory.

func SetRecoImageCacheLimit
func SetRecoImageCacheLimit(limit uint64) error
SetRecoImageCacheLimit sets recognition image cache limit. Default value is 4096.

func SetSaveDraw
func SetSaveDraw(enabled bool) error
SetSaveDraw sets whether to save draw.

func SetSaveOnError
func SetSaveOnError(enabled bool) error
SetSaveOnError sets whether to save screenshot on error.

func SetStdoutLevel
func SetStdoutLevel(level LoggingLevel) error
SetStdoutLevel sets the level of log output to stdout.

func Version
func Version() string
Version returns the version of the maa framework.

Types
type Action
type Action struct {
// Type specifies the action type.
Type ActionType `json:"type,omitempty"`
// Param specifies the action parameters.
Param ActionParam `json:"param,omitempty"`
}
Action defines the action configuration for a node.

func ActClick
func ActClick(p ClickParam) \*Action
ActClick creates a Click action. Pass a zero value for defaults.

func ActClickKey
func ActClickKey(keys []int) \*Action
ActClickKey creates a ClickKey action with the given virtual key codes.

func ActCommand
func ActCommand(p CommandParam) \*Action
ActCommand creates a Command action with the given parameters.

func ActCustom
func ActCustom(p CustomActionParam) \*Action
ActCustom creates a Custom action with the given parameters.

func ActDoNothing
func ActDoNothing() \*Action
ActDoNothing creates a DoNothing action that performs no operation.

func ActInputText
func ActInputText(input string) \*Action
ActInputText creates an InputText action with the given text.

func ActKeyDown
func ActKeyDown(key int) \*Action
ActKeyDown creates a KeyDown action that presses the key without releasing.

func ActKeyUp
func ActKeyUp(key int) \*Action
ActKeyUp creates a KeyUp action that releases a previously pressed key.

func ActLongPress
func ActLongPress(p LongPressParam) \*Action
ActLongPress creates a LongPress action. Pass a zero value for defaults.

func ActLongPressKey
func ActLongPressKey(p LongPressKeyParam) \*Action
ActLongPressKey creates a LongPressKey action with the given parameters.

func ActMultiSwipe
func ActMultiSwipe(swipes ...MultiSwipeItem) \*Action
ActMultiSwipe creates a MultiSwipe action for multi-finger swipe gestures.

func ActScroll
func ActScroll(p ScrollParam) \*Action
ActScroll creates a Scroll action. Pass a zero value for defaults.

func ActShell
func ActShell(cmd string) \*Action
ActShell creates a Shell action with the given command. This is only valid for ADB controllers. If the controller is not an ADB controller, the action will fail. The output of the command can be obtained in the action detail by MaaTaskerGetActionDetail.

func ActStartApp
func ActStartApp(pkg string) \*Action
ActStartApp creates a StartApp action with the given package name or activity.

func ActStopApp
func ActStopApp(pkg string) \*Action
ActStopApp creates a StopApp action with the given package name.

func ActStopTask
func ActStopTask() \*Action
ActStopTask creates a StopTask action that stops the current task chain.

func ActSwipe
func ActSwipe(p SwipeParam) \*Action
ActSwipe creates a Swipe action. Pass a zero value for defaults.

func ActTouchDown
func ActTouchDown(p TouchDownParam) \*Action
ActTouchDown creates a TouchDown action. Pass a zero value for defaults.

func ActTouchMove
func ActTouchMove(p TouchMoveParam) \*Action
ActTouchMove creates a TouchMove action. Pass a zero value for defaults.

func ActTouchUp
func ActTouchUp(contact int) \*Action
ActTouchUp creates a TouchUp action. contact is the touch point identifier (0 for default).

func (*Action) UnmarshalJSON
func (na *Action) UnmarshalJSON(data []byte) error
type ActionDetail
type ActionDetail struct {
ID int64
Name string
Action string
Box Rect
Success bool
DetailJson string
Result \*ActionResult
}
ActionDetail contains action information.

type ActionParam
type ActionParam interface {
// contains filtered or unexported methods
}
ActionParam is the interface for action parameters.

type ActionResult
type ActionResult struct {
// contains filtered or unexported fields
}
ActionResult wraps parsed action detail.

func (*ActionResult) AsApp
func (r *ActionResult) AsApp() (*AppActionResult, bool)
func (*ActionResult) AsClick
func (r *ActionResult) AsClick() (*ClickActionResult, bool)
func (*ActionResult) AsClickKey
func (r *ActionResult) AsClickKey() (*ClickKeyActionResult, bool)
func (*ActionResult) AsInputText
func (r *ActionResult) AsInputText() (*InputTextActionResult, bool)
func (*ActionResult) AsLongPress
func (r *ActionResult) AsLongPress() (*LongPressActionResult, bool)
func (*ActionResult) AsLongPressKey
func (r *ActionResult) AsLongPressKey() (*LongPressKeyActionResult, bool)
func (*ActionResult) AsMultiSwipe
func (r *ActionResult) AsMultiSwipe() (*MultiSwipeActionResult, bool)
func (*ActionResult) AsScroll
func (r *ActionResult) AsScroll() (*ScrollActionResult, bool)
func (*ActionResult) AsShell
func (r *ActionResult) AsShell() (*ShellActionResult, bool)
func (*ActionResult) AsSwipe
func (r *ActionResult) AsSwipe() (*SwipeActionResult, bool)
func (*ActionResult) AsTouch
func (r *ActionResult) AsTouch() (*TouchActionResult, bool)
func (*ActionResult) Type
func (r \*ActionResult) Type() ActionType
Type returns the action type of the result.

func (*ActionResult) Value
func (r *ActionResult) Value() any
Value returns the underlying value of the result.

type ActionType
type ActionType string
ActionType defines the available action types.

const (
ActionTypeDoNothing ActionType = "DoNothing"
ActionTypeClick ActionType = "Click"
ActionTypeLongPress ActionType = "LongPress"
ActionTypeSwipe ActionType = "Swipe"
ActionTypeMultiSwipe ActionType = "MultiSwipe"
ActionTypeTouchDown ActionType = "TouchDown"
ActionTypeTouchMove ActionType = "TouchMove"
ActionTypeTouchUp ActionType = "TouchUp"
ActionTypeClickKey ActionType = "ClickKey"
ActionTypeLongPressKey ActionType = "LongPressKey"
ActionTypeKeyDown ActionType = "KeyDown"
ActionTypeKeyUp ActionType = "KeyUp"
ActionTypeInputText ActionType = "InputText"
ActionTypeStartApp ActionType = "StartApp"
ActionTypeStopApp ActionType = "StopApp"
ActionTypeStopTask ActionType = "StopTask"
ActionTypeScroll ActionType = "Scroll"
ActionTypeCommand ActionType = "Command"
ActionTypeShell ActionType = "Shell"
ActionTypeCustom ActionType = "Custom"
)
type AdbDevice
type AdbDevice struct {
Name string
AdbPath string
Address string
ScreencapMethod adb.ScreencapMethod
InputMethod adb.InputMethod
Config string
}
AdbDevice represents a single ADB device with various properties about its information.

func FindAdbDevices
func FindAdbDevices(specifiedAdb ...string) ([]\*AdbDevice, error)
FindAdbDevices finds adb devices.

type AgentClient
type AgentClient struct {
// contains filtered or unexported fields
}
AgentClient is used to connect to AgentServer, delegating custom recognition and action execution to a separate process. This allows separating MaaFW core from custom logic into independent processes.

func NewAgentClient
func NewAgentClient(opts ...AgentClientOption) (\*AgentClient, error)
NewAgentClient creates an Agent client instance with specified options. At least one creation option (WithIdentifier or WithTcpPort) should be provided. If none is provided, it defaults to identifier mode with an empty identifier.

See WithIdentifier and WithTcpPort for priority rules when both are specified.

func (*AgentClient) Alive
func (ac *AgentClient) Alive() bool
Alive checks if the Agent server is still responsive.

func (*AgentClient) BindResource
func (ac *AgentClient) BindResource(res \*Resource) error
BindResource links the Agent client to the specified resource.

func (*AgentClient) Connect
func (ac *AgentClient) Connect() error
Connect connects to the Agent server.

func (*AgentClient) Connected
func (ac *AgentClient) Connected() bool
Connected checks if the client is connected to the Agent server.

func (*AgentClient) Destroy
func (ac *AgentClient) Destroy()
Destroy releases underlying resources.

func (*AgentClient) Disconnect
func (ac *AgentClient) Disconnect() error
Disconnect disconnects from the Agent server.

func (*AgentClient) GetCustomActionList
func (ac *AgentClient) GetCustomActionList() ([]string, error)
GetCustomActionList returns the custom action name list of the agent client.

func (*AgentClient) GetCustomRecognitionList
func (ac *AgentClient) GetCustomRecognitionList() ([]string, error)
GetCustomRecognitionList returns the custom recognition name list of the agent client.

func (*AgentClient) Identifier
func (ac *AgentClient) Identifier() (string, error)
Identifier returns the identifier of the current agent client.

func (*AgentClient) RegisterControllerSink
func (ac *AgentClient) RegisterControllerSink(ctrl Controller) error
RegisterControllerSink registers controller events for the controller.

func (*AgentClient) RegisterResourceSink
func (ac *AgentClient) RegisterResourceSink(res \*Resource) error
RegisterResourceSink registers resource events for the resource.

func (*AgentClient) RegisterTaskerSink
func (ac *AgentClient) RegisterTaskerSink(tasker Tasker) error
RegisterTaskerSink registers tasker events for the tasker.

func (*AgentClient) SetTimeout
func (ac *AgentClient) SetTimeout(duration time.Duration) error
SetTimeout sets the timeout duration for the Agent server.

type AgentClientOption
type AgentClientOption func(\*agentClientConfig)
AgentClientOption configures how an Agent client is created.

func WithIdentifier
func WithIdentifier(identifier string) AgentClientOption
WithIdentifier sets the client identifier for creating an agent client. The identifier is used to identify this specific client instance. The identifier creation mode uses IPC, and will fall back to TCP on older Windows versions that do not support AF_UNIX (builds prior to 17063). If empty, an identifier will be automatically generated.

Priority: This option takes precedence for creation mode if specified after WithTcpPort. If specified before WithTcpPort, WithTcpPort will override it.

func WithTcpPort
func WithTcpPort(port uint16) AgentClientOption
WithTcpPort sets the TCP port for creating a TCP-based agent client. The client will connect to the agent server at the specified port.

Priority: This option takes precedence for creation mode if specified after WithIdentifier. If specified before WithIdentifier, WithIdentifier will override it.

type AndRecognitionParam
type AndRecognitionParam struct {
AllOf []SubRecognitionItem `json:"all_of,omitempty"`
BoxIndex int `json:"box_index,omitempty"`
}
AndRecognitionParam defines parameters for AND recognition. AllOf elements are either node name strings or inline recognitions.

type AppActionResult
type AppActionResult struct {
Package string `json:"package"`
}
type BlankController
type BlankController struct{}
func (*BlankController) Click
func (c *BlankController) Click(x int32, y int32) bool
Click implements CustomController.

func (*BlankController) ClickKey
func (c *BlankController) ClickKey(keycode int32) bool
ClickKey implements CustomController.

func (*BlankController) Connect
func (c *BlankController) Connect() bool
Connect implements CustomController.

func (*BlankController) Connected
func (c *BlankController) Connected() bool
Connected implements CustomController.

func (*BlankController) GetFeature
func (c *BlankController) GetFeature() ControllerFeature
GetFeature implements CustomController.

func (*BlankController) Inactive
func (c *BlankController) Inactive() bool
Inactive implements CustomController.

func (*BlankController) InputText
func (c *BlankController) InputText(text string) bool
InputText implements CustomController.

func (*BlankController) KeyDown
func (c *BlankController) KeyDown(keycode int32) bool
KeyDown implements CustomController.

func (*BlankController) KeyUp
func (c *BlankController) KeyUp(keycode int32) bool
KeyUp implements CustomController.

func (*BlankController) RequestUUID
func (c *BlankController) RequestUUID() (string, bool)
RequestUUID implements CustomController.

func (*BlankController) Screencap
func (c *BlankController) Screencap() (image.Image, bool)
Screencap implements CustomController.

func (*BlankController) Scroll
func (c *BlankController) Scroll(dx int32, dy int32) bool
Scroll implements CustomController.

func (*BlankController) StartApp
func (c *BlankController) StartApp(intent string) bool
StartApp implements CustomController.

func (*BlankController) StopApp
func (c *BlankController) StopApp(intent string) bool
StopApp implements CustomController.

func (*BlankController) Swipe
func (c *BlankController) Swipe(x1 int32, y1 int32, x2 int32, y2 int32, duration int32) bool
Swipe implements CustomController.

func (*BlankController) TouchDown
func (c *BlankController) TouchDown(contact int32, x int32, y int32, pressure int32) bool
TouchDown implements CustomController.

func (*BlankController) TouchMove
func (c *BlankController) TouchMove(contact int32, x int32, y int32, pressure int32) bool
TouchMove implements CustomController.

func (*BlankController) TouchUp
func (c *BlankController) TouchUp(contact int32) bool
TouchUp implements CustomController.

type CarouselImageController
type CarouselImageController struct {
// contains filtered or unexported fields
}
func (*CarouselImageController) Click
func (c *CarouselImageController) Click(x int32, y int32) bool
Click implements CustomController.

func (*CarouselImageController) ClickKey
func (c *CarouselImageController) ClickKey(keycode int32) bool
ClickKey implements CustomController.

func (*CarouselImageController) Connect
func (c *CarouselImageController) Connect() bool
Connect implements CustomController.

func (*CarouselImageController) Connected
func (c *CarouselImageController) Connected() bool
Connected implements CustomController.

func (*CarouselImageController) GetFeature
func (c *CarouselImageController) GetFeature() ControllerFeature
GetFeature implements CustomController.

func (*CarouselImageController) Inactive
func (c *CarouselImageController) Inactive() bool
Inactive implements CustomController.

func (*CarouselImageController) InputText
func (c *CarouselImageController) InputText(text string) bool
InputText implements CustomController.

func (*CarouselImageController) KeyDown
func (c *CarouselImageController) KeyDown(keycode int32) bool
KeyDown implements CustomController.

func (*CarouselImageController) KeyUp
func (c *CarouselImageController) KeyUp(keycode int32) bool
KeyUp implements CustomController.

func (*CarouselImageController) RequestUUID
func (c *CarouselImageController) RequestUUID() (string, bool)
RequestUUID implements CustomController.

func (*CarouselImageController) Screencap
func (c *CarouselImageController) Screencap() (image.Image, bool)
Screencap implements CustomController.

func (*CarouselImageController) Scroll
func (c *CarouselImageController) Scroll(dx int32, dy int32) bool
Scroll implements CustomController.

func (*CarouselImageController) StartApp
func (c *CarouselImageController) StartApp(intent string) bool
StartApp implements CustomController.

func (*CarouselImageController) StopApp
func (c *CarouselImageController) StopApp(intent string) bool
StopApp implements CustomController.

func (*CarouselImageController) Swipe
func (c *CarouselImageController) Swipe(x1 int32, y1 int32, x2 int32, y2 int32, duration int32) bool
Swipe implements CustomController.

func (*CarouselImageController) TouchDown
func (c *CarouselImageController) TouchDown(contact int32, x int32, y int32, pressure int32) bool
TouchDown implements CustomController.

func (*CarouselImageController) TouchMove
func (c *CarouselImageController) TouchMove(contact int32, x int32, y int32, pressure int32) bool
TouchMove implements CustomController.

func (*CarouselImageController) TouchUp
func (c *CarouselImageController) TouchUp(contact int32) bool
TouchUp implements CustomController.

type ClickActionResult
type ClickActionResult struct {
Point Point `json:"point"`
Contact int `json:"contact"`
// Pressure is kept to match MaaFramework raw detail JSON.
Pressure int `json:"pressure"`
}
type ClickKeyActionResult
type ClickKeyActionResult struct {
Keycode []int `json:"keycode"`
}
type ClickKeyParam
type ClickKeyParam struct {
// Key specifies the virtual key codes to click. Required.
Key []int `json:"key,omitempty"`
}
ClickKeyParam defines parameters for key click action.

type ClickParam
type ClickParam struct {
// Target specifies the click target position.
Target Target `json:"target,omitzero"`
// TargetOffset specifies additional offset applied to target.
TargetOffset Rect `json:"target_offset,omitempty"`
// Contact specifies the touch point identifier. Adb: finger index (0=first finger). Win32: mouse button (0=left, 1=right, 2=middle).
Contact int `json:"contact,omitempty"`
}
ClickParam defines parameters for click action.

type ColorMatchMethod
type ColorMatchMethod int
ColorMatchMethod defines the color space for color matching (cv::ColorConversionCodes).

const (
ColorMatchMethodRGB ColorMatchMethod = 4 // RGB color space, 3 channels (default)
ColorMatchMethodHSV ColorMatchMethod = 40 // HSV color space, 3 channels
ColorMatchMethodGRAY ColorMatchMethod = 6 // Grayscale, 1 channel
)
type ColorMatchOrderBy
type ColorMatchOrderBy OrderBy
ColorMatchOrderBy defines the ordering options for color matching results.

type ColorMatchParam
type ColorMatchParam struct {
// ROI specifies the region of interest for recognition.
ROI Target `json:"roi,omitzero"`
// ROIOffset specifies the offset applied to ROI.
ROIOffset Rect `json:"roi_offset,omitempty"`
// Method specifies the color space. 4: RGB (default), 40: HSV, 6: GRAY.
Method ColorMatchMethod `json:"method,omitempty"`
// Lower specifies the color lower bounds. Required. Inner array length must match method channels.
Lower [][]int `json:"lower,omitempty"`
// Upper specifies the color upper bounds. Required. Inner array length must match method channels.
Upper [][]int `json:"upper,omitempty"`
// Count specifies the minimum pixel count required (threshold). Default: 1.
Count int `json:"count,omitempty"`
// OrderBy specifies how results are sorted. Default: Horizontal. Options: Horizontal | Vertical | Score | Area | Random.
OrderBy ColorMatchOrderBy `json:"order_by,omitempty"`
// Index specifies which match to select from results.
Index int `json:"index,omitempty"`
// Connected enables connected component analysis. Default: false.
Connected bool `json:"connected,omitempty"`
}
ColorMatchParam defines parameters for color matching recognition.

type ColorMatchResult
type ColorMatchResult struct {
Box Rect `json:"box"`
Count int `json:"count"`
}
type CommandParam
type CommandParam struct {
// Exec specifies the program path to execute. Required.
Exec string `json:"exec,omitempty"`
// Args specifies the command arguments. Supports runtime placeholders:
// {ENTRY}: task entry name, {NODE}: current node name,
// {IMAGE}: screenshot file path, {BOX}: recognition target [x,y,w,h],
// {RESOURCE_DIR}: last loaded resource directory, {LIBRARY_DIR}: MaaFW library directory.
Args []string `json:"args,omitempty"`
// Detach enables detached mode to run without waiting for completion. Default: false.
Detach bool `json:"detach,omitempty"`
}
CommandParam defines parameters for command execution action.

type Context
type Context struct {
// contains filtered or unexported fields
}
Context provides the runtime context for custom actions/recognitions and exposes task, recognition, action, and pipeline operations.

func (*Context) ClearHitCount
func (ctx *Context) ClearHitCount(nodeName string) error
ClearHitCount clears the hit count of a node by name.

func (*Context) Clone
func (ctx *Context) Clone() \*Context
Clone clones current Context.

func (*Context) GetAnchor
func (ctx *Context) GetAnchor(anchorName string) (string, error)
GetAnchor gets an anchor by name.

func (*Context) GetHitCount
func (ctx *Context) GetHitCount(nodeName string) (uint64, error)
GetHitCount gets the hit count of a node by name.

func (*Context) GetNode
func (ctx *Context) GetNode(name string) (\*Node, error)
GetNode returns the node definition by name. It fetches the node JSON via GetNodeJSON and unmarshals it into a Node struct.

func (*Context) GetNodeJSON
func (ctx *Context) GetNodeJSON(name string) (string, error)
GetNodeJSON gets the node JSON by name.

func (*Context) GetTaskJob
func (ctx *Context) GetTaskJob() \*TaskJob
GetTaskJob returns current task job.

func (*Context) GetTasker
func (ctx *Context) GetTasker() \*Tasker
GetTasker returns the current Tasker.

func (*Context) OverrideImage
func (ctx *Context) OverrideImage(imageName string, image image.Image) error
OverrideImage overrides an image by name.

func (*Context) OverrideNext
func (ctx *Context) OverrideNext(name string, nextList []NextItem) error
OverrideNext overrides the next list of a node by name. If the underlying call fails (e.g., node not found or list invalid), it returns an error.

func (*Context) OverridePipeline
func (ctx *Context) OverridePipeline(override any) error
OverridePipeline overrides the current pipeline definition. The override parameter can be a JSON string, raw JSON bytes, a Pipeline, or any data type that can be marshaled to JSON. The resulting JSON must be an object or an array of objects. If override is nil, an empty JSON object will be used.

Example 1:

pipeline := NewPipeline()
node := NewNode("Task").SetAction(ActDoNothing())
pipeline.AddNode(node)
ctx.OverridePipeline(pipeline)
Example 2:

ctx.OverridePipeline(map[string]any{
"Task": map[string]any{
"action": "Click",
"target": []int{100, 200, 100, 100},
},
})
Example 3:

ctx.OverridePipeline(`{"Task":{"action":"Click","target":[100,200,100,100]}}`)
func (*Context) RunAction
func (ctx *Context) RunAction(
entry string,
box Rect,
recognitionDetail string,
override ...any,
) (\*ActionDetail, error)
RunAction runs an action by entry name and returns its detail. It accepts an entry string and an optional override parameter which can be a JSON string or any data type that can be marshaled to JSON. The override must be a JSON object (map). If the override value is nil, an empty JSON object will be used. If multiple overrides are provided, only the first one will be used. recognitionDetail should be a JSON string for the previous recognition detail (e.g., RecognitionDetail.DetailJson). Pass "" if not available.

Example 1:

pipeline := NewPipeline()
node := NewNode("Task").
SetAction(ActClick(ClickParam{Target: NewTargetRect(Rect{100, 200, 100, 100})}))
pipeline.AddNode(node)
ctx.RunAction(node.Name, box, recognitionDetail, pipeline)
Example 2:

ctx.RunAction("Task", box, recognitionDetail, map[string]any{
"Task": map[string]any{
"action": "Click",
"target": []int{100, 200, 100, 100},
}
})
Example 3:

ctx.RunAction("Task", box, recognitionDetail, `{"Task":{"action":"Click","target":[100, 200, 100, 100]}}`)
func (*Context) RunActionDirect
func (ctx *Context) RunActionDirect(
actionType ActionType,
actionParam ActionParam,
box Rect,
recoDetail *RecognitionDetail,
) (*ActionDetail, error)
RunActionDirect runs action directly by type and parameters, without a pipeline entry. It accepts an action type string (e.g., "Click", "Swipe"), an action parameter that will be marshaled to JSON, a box for the action position, and recognition details. If action parameters or recognition details are nil, they will be marshaled to JSON null.

Example:

actParam := &ClickParam{Target: NewTargetRect(Rect{100, 200, 100, 100})}
box := Rect{100, 200, 100, 100}
ctx.RunActionDirect(ActionTypeClick, actParam, box, nil)
func (*Context) RunRecognition
func (ctx *Context) RunRecognition(
entry string,
img image.Image,
override ...any,
) (\*RecognitionDetail, error)
RunRecognition runs a recognition by entry name and returns its detail. It accepts an entry string and an optional override parameter which can be a JSON string or any data type that can be marshaled to JSON. The override must be a JSON object (map). If the override value is nil, an empty JSON object will be used. If multiple overrides are provided, only the first one will be used.

Example 1:

pipeline := NewPipeline()
node := NewNode("Task").
SetRecognition(RecOCR(OCRParam{Expected: []string{"Hello"}}))
pipeline.AddNode(node)
ctx.RunRecognition(node.Name, img, pipeline)
Example 2:

ctx.RunRecognition("Task", img, map[string]any{
"Task": map[string]any{
"recognition": "OCR",
"expected": "Hello",
}
})
Example 3:

ctx.RunRecognition("Task", img, `{"Task":{"recognition":"OCR","expected":"Hello"}}`)
func (*Context) RunRecognitionDirect
func (ctx *Context) RunRecognitionDirect(
recoType RecognitionType,
recoParam RecognitionParam,
img image.Image,
) (\*RecognitionDetail, error)
RunRecognitionDirect runs recognition directly by type and parameters, without a pipeline entry. It accepts a recognition type (e.g., RecognitionTypeOCR, RecognitionTypeTemplateMatch), a recognition parameter implementing RecognitionParam (marshaled to JSON), and an image. recoParam may be nil; it is then marshaled as JSON null.

Example:

recParam := &OCRParam{Expected: []string{"Hello"}}
detail, err := ctx.RunRecognitionDirect(RecognitionTypeOCR, recParam, img)
func (*Context) RunTask
func (ctx *Context) RunTask(entry string, override ...any) (\*TaskDetail, error)
RunTask runs a pipeline task by entry name and returns its detail. It accepts an entry string and an optional override parameter which can be a JSON string or any data type that can be marshaled to JSON. The override must be a JSON object (map). If the override value is nil, an empty JSON object will be used. If multiple overrides are provided, only the first one will be used.

Example 1:

pipeline := NewPipeline()
node := NewNode("Task").
SetAction(ActClick(ClickParam{Target: NewTargetRect(Rect{100, 200, 100, 100})}))
pipeline.AddNode(node)
ctx.RunTask(node.Name, pipeline)
Example 2:

ctx.RunTask("Task", map[string]any{
"Task": map[string]any{
"action": "Click",
"target": []int{100, 200, 100, 100},
}
})
Example 3:

ctx.RunTask("Task", `{"Task":{"action":"Click","target":[100, 200, 100, 100]}}`)
func (*Context) SetAnchor
func (ctx *Context) SetAnchor(anchorName, nodeName string) error
SetAnchor sets an anchor by name.

func (*Context) WaitFreezes
func (ctx *Context) WaitFreezes(
duration time.Duration,
box *Rect,
waitFreezesParam *WaitFreezesParam,
) error
WaitFreezes waits until the screen stabilizes (no significant changes). duration is the duration that the screen must remain stable. box is the recognition hit box, used when target is "Self" to calculate the ROI; if nil, uses entire screen. waitFreezesParam is optional; nil uses default params. duration and waitFreezesParam.Time are mutually exclusive; one of them must be non-zero. Returns nil if the screen stabilized within the timeout; returns an error on timeout or failure.

type ContextEventSink
type ContextEventSink interface {
OnNodePipelineNode(ctx *Context, event EventStatus, detail NodePipelineNodeDetail)
OnNodeRecognitionNode(ctx *Context, event EventStatus, detail NodeRecognitionNodeDetail)
OnNodeActionNode(ctx *Context, event EventStatus, detail NodeActionNodeDetail)
OnNodeNextList(ctx *Context, event EventStatus, detail NodeNextListDetail)
OnNodeRecognition(ctx *Context, event EventStatus, detail NodeRecognitionDetail)
OnNodeAction(ctx *Context, event EventStatus, detail NodeActionDetail)
}
ContextEventSink is the interface for receiving context-level events.

type Controller
type Controller struct {
// contains filtered or unexported fields
}
func NewAdbController
func NewAdbController(
adbPath, address string,
screencapMethod adb.ScreencapMethod,
inputMethod adb.InputMethod,
config, agentPath string,
) (\*Controller, error)
NewAdbController creates a new ADB controller.

func NewBlankController
func NewBlankController() (*Controller, error)
func NewCarouselImageController
func NewCarouselImageController(path string) (*Controller, error)
func NewCustomController
func NewCustomController(
ctrl CustomController,
) (\*Controller, error)
NewCustomController creates a custom controller instance.

func NewGamepadController
func NewGamepadController(
hWnd unsafe.Pointer,
gamepadType GamepadType,
screencapMethod win32.ScreencapMethod,
) (\*Controller, error)
NewGamepadController creates a virtual gamepad controller for Windows.

hWnd: Window handle for screencap (optional, can be nil if screencap not needed). gamepadType: Type of virtual gamepad (Xbox360 or DualShock4). screencapMethod: Win32 screencap method to use. Ignored if hWnd is nil.

Note: Requires ViGEm Bus Driver to be installed on the system. For gamepad button and touch constants, import "github.com/MaaXYZ/maa-framework-go/v3/controller/gamepad".

func NewPlayCoverController
func NewPlayCoverController(
address, uuid string,
) (\*Controller, error)
NewPlayCoverController creates a new PlayCover controller.

func NewWin32Controller
func NewWin32Controller(
hWnd unsafe.Pointer,
screencapMethod win32.ScreencapMethod,
mouseMethod win32.InputMethod,
keyboardMethod win32.InputMethod,
) (\*Controller, error)
NewWin32Controller creates a win32 controller instance.

func (*Controller) AddSink
func (c *Controller) AddSink(sink ControllerEventSink) int64
AddSink adds a event callback sink and returns the sink ID. The sink ID can be used to remove the sink later.

func (*Controller) CacheImage
func (c *Controller) CacheImage() (image.Image, error)
CacheImage gets the image buffer of the last screencap request.

func (*Controller) ClearSinks
func (c *Controller) ClearSinks()
ClearSinks clears all event callback sinks.

func (*Controller) Connected
func (c *Controller) Connected() bool
Connected checks if the controller is connected.

func (*Controller) Destroy
func (c *Controller) Destroy()
Destroy frees the controller instance.

func (*Controller) GetResolution
func (c *Controller) GetResolution() (width, height int32, err error)
GetResolution gets the raw (unscaled) device resolution. Returns the width and height. Returns an error if the resolution is not available. Note: This returns the actual device screen resolution before any scaling. The screenshot obtained via CacheImage is scaled according to the screenshot target size settings.

func (*Controller) GetShellOutput
func (c *Controller) GetShellOutput() (string, error)
GetShellOutput gets the output of the last shell command.

func (*Controller) GetUUID
func (c *Controller) GetUUID() (string, error)
GetUUID gets the UUID of the controller.

func (*Controller) OnControllerAction
func (c *Controller) OnControllerAction(
fn func(EventStatus, ControllerActionDetail),
) int64
OnControllerAction registers a callback sink that only handles Controller.Action events and returns the sink ID. The sink ID can be used to remove the sink later.

func (*Controller) PostClick
func (c *Controller) PostClick(x, y int32) \*Job
PostClick posts a click.

func (*Controller) PostClickKey
func (c *Controller) PostClickKey(keycode int32) \*Job
PostClickKey posts a click key.

func (*Controller) PostClickV2
func (c *Controller) PostClickV2(x, y, contact, pressure int32) \*Job
PostClickV2 posts a click with contact and pressure. For adb controller, contact means finger id (0 for first finger, 1 for second finger, etc). For win32 controller, contact means mouse button id (0 for left, 1 for right, 2 for middle).

func (*Controller) PostConnect
func (c *Controller) PostConnect() \*Job
PostConnect posts a connection.

func (*Controller) PostInactive
func (c *Controller) PostInactive() \*Job
PostInactive posts an inactive request to restore controller/window state. For Win32 controllers this restores window position (removes topmost) and unblocks user input. For other controllers this is a no-op that typically succeeds.

func (*Controller) PostInputText
func (c *Controller) PostInputText(text string) \*Job
PostInputText posts an input text.

func (*Controller) PostKeyDown
func (c *Controller) PostKeyDown(keycode int32) *Job
func (*Controller) PostKeyUp
func (c *Controller) PostKeyUp(keycode int32) *Job
func (*Controller) PostScreencap
func (c *Controller) PostScreencap() \*Job
PostScreencap posts a screencap.

func (*Controller) PostScroll
func (c *Controller) PostScroll(dx, dy int32) \*Job
PostScroll posts a scroll.

func (*Controller) PostShell
func (c *Controller) PostShell(cmd string, timeout time.Duration) \*Job
PostShell posts a adb shell command. This is only valid for ADB controllers. If the controller is not an ADB controller, the action will fail.

func (*Controller) PostStartApp
func (c *Controller) PostStartApp(intent string) \*Job
PostStartApp posts a start app.

func (*Controller) PostStopApp
func (c *Controller) PostStopApp(intent string) \*Job
PostStopApp posts a stop app.

func (*Controller) PostSwipe
func (c *Controller) PostSwipe(x1, y1, x2, y2 int32, duration time.Duration) \*Job
PostSwipe posts a swipe.

func (*Controller) PostSwipeV2
func (c *Controller) PostSwipeV2(x1, y1, x2, y2 int32, duration time.Duration, contact, pressure int32) \*Job
PostSwipeV2 posts a swipe with contact and pressure. For adb controller, contact means finger id (0 for first finger, 1 for second finger, etc). For win32 controller, contact means mouse button id (0 for left, 1 for right, 2 for middle).

func (*Controller) PostTouchDown
func (c *Controller) PostTouchDown(contact, x, y, pressure int32) \*Job
PostTouchDown posts a touch-down.

func (*Controller) PostTouchMove
func (c *Controller) PostTouchMove(contact, x, y, pressure int32) \*Job
PostTouchMove posts a touch-move.

func (*Controller) PostTouchUp
func (c *Controller) PostTouchUp(contact int32) \*Job
PostTouchUp posts a touch-up.

func (*Controller) RemoveSink
func (c *Controller) RemoveSink(sinkId int64)
RemoveSink removes a event callback sink by sink ID.

func (*Controller) SetScreenshot
func (c *Controller) SetScreenshot(opts ...ScreenshotOption) error
SetScreenshot applies screenshot options to controller instance. Only the last option is applied when multiple options are provided.

type ControllerActionDetail
type ControllerActionDetail struct {
CtrlID uint64 `json:"ctrl_id"`
UUID string `json:"uuid"`
Action string `json:"action"`
Param map[string]any `json:"param"`
}
ControllerActionDetail contains information about controller action events

type ControllerEventSink
type ControllerEventSink interface {
OnControllerAction(ctrl *Controller, event EventStatus, detail ControllerActionDetail)
}
type ControllerFeature
type ControllerFeature uint64
const (
ControllerFeatureNone ControllerFeature = 0
ControllerFeatureUseMouseDownAndUpInsteadOfClick ControllerFeature = 1
ControllerFeatureUseKeyboardDownAndUpInsteadOfClick ControllerFeature = 1 << 1
)
type CustomActionArg
type CustomActionArg struct {
TaskID int64 // Task ID. Task details can be retrieved via Tasker.GetTaskDetail.
CurrentTaskName string
CustomActionName string
CustomActionParam string
RecognitionDetail *RecognitionDetail
Box Rect
}
type CustomActionParam
type CustomActionParam struct {
// Target specifies the action target position.
Target Target `json:"target,omitzero"`
// TargetOffset specifies additional offset applied to target.
TargetOffset Rect `json:"target_offset,omitempty"`
// CustomAction specifies the action name registered via MaaResourceRegisterCustomAction. Required.
CustomAction string `json:"custom_action,omitempty"`
// CustomActionParam specifies custom parameters passed to the action callback.
CustomActionParam any `json:"custom_action_param,omitempty"`
}
CustomActionParam defines parameters for custom action handlers.

type CustomActionRunner
type CustomActionRunner interface {
Run(ctx *Context, arg *CustomActionArg) bool
}
type CustomController
type CustomController interface {
Connect() bool
Connected() bool
RequestUUID() (string, bool)
GetFeature() ControllerFeature
StartApp(intent string) bool
StopApp(intent string) bool
Screencap() (image.Image, bool)
Click(x, y int32) bool
Swipe(x1, y1, x2, y2, duration int32) bool
TouchDown(contact, x, y, pressure int32) bool
TouchMove(contact, x, y, pressure int32) bool
TouchUp(contact int32) bool
ClickKey(keycode int32) bool
InputText(text string) bool
KeyDown(keycode int32) bool
KeyUp(keycode int32) bool
Scroll(dx, dy int32) bool
// Inactive is called when the framework requests restoring controller/window state (e.g. after tasks finish).
// Return true for success or when no action is needed.
Inactive() bool
}
CustomController defines an interface for custom controller. Implementers of this interface must embed a CustomControllerHandler struct and provide implementations for the following methods: Connect, RequestUUID, StartApp, StopApp, Screencap, Click, Swipe, TouchDown, TouchMove, TouchUp, ClickKey, InputText, KeyDown, KeyUp, Scroll and Inactive.

type CustomRecognitionArg
type CustomRecognitionArg struct {
TaskID int64 // Task ID. Task details can be retrieved via Tasker.GetTaskDetail.
CurrentTaskName string
CustomRecognitionName string
CustomRecognitionParam string
Img image.Image
Roi Rect
}
type CustomRecognitionParam
type CustomRecognitionParam struct {
// ROI specifies the region of interest for recognition.
ROI Target `json:"roi,omitzero"`
// ROIOffset specifies the offset applied to ROI.
ROIOffset Rect `json:"roi_offset,omitempty"`
// CustomRecognition specifies the recognizer name registered via MaaResourceRegisterCustomRecognition. Required.
CustomRecognition string `json:"custom_recognition,omitempty"`
// CustomRecognitionParam specifies custom parameters passed to the recognition callback.
CustomRecognitionParam any `json:"custom_recognition_param,omitempty"`
}
CustomRecognitionParam defines parameters for custom recognition handlers.

type CustomRecognitionResult
type CustomRecognitionResult struct {
Box Rect `json:"box"`
Detail string `json:"detail"`
}
type CustomRecognitionRunner
type CustomRecognitionRunner interface {
Run(ctx *Context, arg *CustomRecognitionArg) (\*CustomRecognitionResult, bool)
}
type DesktopWindow
type DesktopWindow struct {
Handle unsafe.Pointer
ClassName string
WindowName string
}
DesktopWindow represents a single desktop window with various properties about its information.

func FindDesktopWindows
func FindDesktopWindows() ([]\*DesktopWindow, error)
FindDesktopWindows finds desktop windows.

type DirectHitParam
type DirectHitParam struct{}
DirectHitParam defines parameters for direct hit recognition. DirectHit performs no actual recognition and always succeeds.

type DoNothingParam
type DoNothingParam struct{}
DoNothingParam defines parameters for do-nothing action.

type Event
type Event string
func (Event) Failed
func (e Event) Failed() string
func (Event) Starting
func (e Event) Starting() string
func (Event) String
func (e Event) String() string
func (Event) Succeeded
func (e Event) Succeeded() string
type EventStatus
type EventStatus int
EventStatus represents the current state of an event

const (
EventStatusUnknown EventStatus = iota
EventStatusStarting
EventStatusSucceeded
EventStatusFailed
)
Event status constants

type FeatureMatchDetector
type FeatureMatchDetector string
FeatureMatchDetector defines the feature detection algorithms.

const (
FeatureMatchMethodSIFT FeatureMatchDetector = "SIFT" // Scale-Invariant Feature Transform (default, most accurate)
FeatureMatchMethodKAZE FeatureMatchDetector = "KAZE" // KAZE features for 2D/3D images
FeatureMatchMethodAKAZE FeatureMatchDetector = "AKAZE" // Accelerated KAZE
FeatureMatchMethodBRISK FeatureMatchDetector = "BRISK" // Binary Robust Invariant Scalable Keypoints (fast)
FeatureMatchMethodORB FeatureMatchDetector = "ORB" // Oriented FAST and Rotated BRIEF (fast, no scale invariance)
)
type FeatureMatchOrderBy
type FeatureMatchOrderBy OrderBy
FeatureMatchOrderBy defines the ordering options for feature matching results.

type FeatureMatchParam
type FeatureMatchParam struct {
// ROI specifies the region of interest for recognition.
ROI Target `json:"roi,omitzero"`
// ROIOffset specifies the offset applied to ROI.
ROIOffset Rect `json:"roi_offset,omitempty"`
// Template specifies the template image paths. Required.
Template []string `json:"template,omitempty"`
// Count specifies the minimum number of feature points required (threshold). Default: 4.
Count int `json:"count,omitempty"`
// OrderBy specifies how results are sorted. Default: Horizontal. Options: Horizontal | Vertical | Score | Area | Random.
OrderBy FeatureMatchOrderBy `json:"order_by,omitempty"`
// Index specifies which match to select from results.
Index int `json:"index,omitempty"`
// GreenMask enables green color masking for transparent areas.
GreenMask bool `json:"green_mask,omitempty"`
// Detector specifies the feature detector algorithm. Options: SIFT, KAZE, AKAZE, BRISK, ORB. Default: SIFT.
Detector FeatureMatchDetector `json:"detector,omitempty"`
// Ratio specifies the matching ratio threshold [0-1.0]. Default: 0.6.
Ratio float64 `json:"ratio,omitempty"`
}
FeatureMatchParam defines parameters for feature matching recognition.

type FeatureMatchResult
type FeatureMatchResult struct {
Box Rect `json:"box"`
Count int `json:"count"`
}
type GamepadType
type GamepadType = native.MaaGamepadType
GamepadType defines the type of virtual gamepad.

const (
GamepadTypeXbox360 GamepadType = native.MaaGamepadType_Xbox360
GamepadTypeDualShock4 GamepadType = native.MaaGamepadType_DualShock4
)
Gamepad type constants.

type InferenceDevice
type InferenceDevice = native.MaaInferenceDevice
const (
InferenceDeviceAuto InferenceDevice = -1
InferenceDevice0 InferenceDevice = 0
InferenceDevice1 InferenceDevice = 1
)
type InitOption
type InitOption func(\*initConfig)
InitOption defines a function type for configuring initialization through functional options. Use package-provided WithXxx helpers to construct options.

func WithDebugMode
func WithDebugMode(enabled bool) InitOption
WithDebugMode returns an InitOption that enables or disables debug mode. When enabled is true, additional debug information will be collected and logged.

func WithLibDir
func WithLibDir(libDir string) InitOption
WithLibDir returns an InitOption that sets the library directory path for the MAA framework. The libDir parameter specifies the directory where the MAA dynamic library is located.

func WithLogDir
func WithLogDir(logDir string) InitOption
WithLogDir returns an InitOption that sets the directory path for log files. The logDir parameter specifies where the MAA framework should write its log files.

func WithPluginPaths
func WithPluginPaths(path ...string) InitOption
func WithSaveDraw
func WithSaveDraw(enabled bool) InitOption
WithSaveDraw returns an InitOption that configures whether to save drawing information. When enabled is true, recognition results will be saved to LogDir/vision directory and RecoDetail will be able to retrieve draws for debugging.

func WithStdoutLevel
func WithStdoutLevel(level LoggingLevel) InitOption
WithStdoutLevel returns an InitOption that sets the logging level for standard output. The level parameter determines the verbosity of logs written to stdout.

type InlineSubRecognition
type InlineSubRecognition struct {
SubName string `json:"sub_name,omitempty"`
Recognition
}
InlineSubRecognition is an inline sub-recognition element (object form in all_of/any_of). It has sub_name plus type and param; used for both And and Or.

func (*InlineSubRecognition) UnmarshalJSON
func (n *InlineSubRecognition) UnmarshalJSON(data []byte) error
type InputTextActionResult
type InputTextActionResult struct {
Text string `json:"text"`
}
type InputTextParam
type InputTextParam struct {
// InputText specifies the text to input. Some controllers only support ASCII. Required.
InputText string `json:"input_text,omitempty"`
}
InputTextParam defines parameters for text input action.

type Job
type Job struct {
// contains filtered or unexported fields
}
Job represents an asynchronous job with status tracking capabilities. It provides methods to check the job status and wait for completion.

func (*Job) Done
func (j *Job) Done() bool
Done reports whether the job is done (either success or failure).

func (*Job) Failure
func (j *Job) Failure() bool
Failure reports whether the status is a failure.

func (*Job) Invalid
func (j *Job) Invalid() bool
Invalid reports whether the status is invalid.

func (*Job) Pending
func (j *Job) Pending() bool
Pending reports whether the status is pending.

func (*Job) Running
func (j *Job) Running() bool
Running reports whether the status is running.

func (*Job) Status
func (j *Job) Status() Status
Status returns the current status of the job.

func (*Job) Success
func (j *Job) Success() bool
Success reports whether the status is success.

func (*Job) Wait
func (j *Job) Wait() \*Job
Wait blocks until the job completes and returns the job instance.

type KeyDownParam
type KeyDownParam struct {
// Key specifies the virtual key code to press down. Required.
Key int `json:"key,omitempty"`
}
KeyDownParam defines parameters for key down action.

type KeyUpParam
type KeyUpParam struct {
// Key specifies the virtual key code to release. Required.
Key int `json:"key,omitempty"`
}
KeyUpParam defines parameters for key up action.

type LibraryLoadError
type LibraryLoadError = native.LibraryLoadError
LibraryLoadError represents an error that occurs when loading a MAA dynamic library. This error type provides detailed information about which library failed to load, including the library name, the full path attempted, and the underlying system error.

type LoggingLevel
type LoggingLevel int32
const (
LoggingLevelOff LoggingLevel = iota
LoggingLevelFatal
LoggingLevelError
LoggingLevelWarn
LoggingLevelInfo
LoggingLevelDebug
LoggingLevelTrace
LoggingLevelAll
)
LoggingLevel

type LongPressActionResult
type LongPressActionResult struct {
Point Point `json:"point"`
Duration int64 `json:"duration"`
Contact int `json:"contact"`
// Pressure is kept to match MaaFramework raw detail JSON.
Pressure int `json:"pressure"`
}
type LongPressKeyActionResult
type LongPressKeyActionResult struct {
Keycode []int `json:"keycode"`
Duration int64 `json:"duration"`
}
type LongPressKeyParam
type LongPressKeyParam struct {
// Key specifies the virtual key code to press. Required.
Key []int `json:"key,omitempty"`
// Duration specifies the long press duration. Default: 1000ms.
// JSON: serialized as integer milliseconds.
Duration time.Duration `json:"-"`
}
LongPressKeyParam defines parameters for long press key action.

func (LongPressKeyParam) MarshalJSON
func (p LongPressKeyParam) MarshalJSON() ([]byte, error)
func (*LongPressKeyParam) UnmarshalJSON
func (p *LongPressKeyParam) UnmarshalJSON(data []byte) error
type LongPressParam
type LongPressParam struct {
// Target specifies the long press target position.
Target Target `json:"target,omitzero"`
// TargetOffset specifies additional offset applied to target.
TargetOffset Rect `json:"target_offset,omitempty"`
// Duration specifies the long press duration. Default: 1000ms.
// JSON: serialized as integer milliseconds.
Duration time.Duration `json:"-"`
// Contact specifies the touch point identifier. Adb: finger index (0=first finger). Win32: mouse button (0=left, 1=right, 2=middle).
Contact int `json:"contact,omitempty"`
}
LongPressParam defines parameters for long press action.

func (LongPressParam) MarshalJSON
func (p LongPressParam) MarshalJSON() ([]byte, error)
func (*LongPressParam) UnmarshalJSON
func (p *LongPressParam) UnmarshalJSON(data []byte) error
type MaaCustomControllerCallbacks
type MaaCustomControllerCallbacks struct {
Connect uintptr
Connected uintptr
RequestUUID uintptr
GetFeature uintptr
StartApp uintptr
StopApp uintptr
Screencap uintptr
Click uintptr
Swipe uintptr
TouchDown uintptr
TouchMove uintptr
TouchUp uintptr
ClickKey uintptr
InputText uintptr
KeyDown uintptr
KeyUp uintptr
Scroll uintptr
Inactive uintptr
}
type MultiSwipeActionResult
type MultiSwipeActionResult struct {
Swipes []SwipeActionResult `json:"swipes"`
}
type MultiSwipeItem
type MultiSwipeItem struct {
// Starting specifies when this swipe starts within the action. Default: 0.
// JSON: serialized as integer milliseconds.
Starting time.Duration `json:"-"`
// Begin specifies the swipe start position.
Begin Target `json:"begin,omitzero"`
// BeginOffset specifies additional offset applied to begin position.
BeginOffset Rect `json:"begin_offset,omitempty"`
// End specifies the swipe end position.
End []Target `json:"end,omitzero"`
// EndOffset specifies additional offset applied to end position.
EndOffset []Rect `json:"end_offset,omitempty"`
// Duration specifies the swipe duration. Default: 200ms.
// JSON: serialized as array of integer milliseconds.
Duration []time.Duration `json:"-"`
// EndHold specifies extra wait time at end position before releasing. Default: 0.
// JSON: serialized as array of integer milliseconds.
EndHold []time.Duration `json:"-"`
// OnlyHover enables hover-only mode without press/release actions. Default: false.
OnlyHover bool `json:"only_hover,omitempty"`
// Contact specifies the touch point identifier. Adb: finger index. Win32: mouse button. Default uses array index if 0.
Contact int `json:"contact,omitempty"`
}
MultiSwipeItem defines a single swipe within a multi-swipe action.

func (MultiSwipeItem) MarshalJSON
func (p MultiSwipeItem) MarshalJSON() ([]byte, error)
func (*MultiSwipeItem) UnmarshalJSON
func (p *MultiSwipeItem) UnmarshalJSON(data []byte) error
type MultiSwipeParam
type MultiSwipeParam struct {
// Swipes specifies the list of swipe items. Required.
Swipes []MultiSwipeItem `json:"swipes,omitempty"`
}
MultiSwipeParam defines parameters for multi-finger swipe action.

type NeuralNetworkClassifyOrderBy
type NeuralNetworkClassifyOrderBy OrderBy
NeuralNetworkClassifyOrderBy defines the ordering options for neural network classification results.

type NeuralNetworkClassifyParam
type NeuralNetworkClassifyParam struct {
// ROI specifies the region of interest for recognition.
ROI Target `json:"roi,omitzero"`
// ROIOffset specifies the offset applied to ROI.
ROIOffset Rect `json:"roi_offset,omitempty"`
// Labels specifies the class names for debugging and logging. Fills "Unknown" if not provided.
Labels []string `json:"labels,omitempty"`
// Model specifies the model folder path relative to model/classify directory. Required. Only ONNX models supported.
Model string `json:"model,omitempty"`
// Expected specifies the expected class indices. Required.
Expected []int `json:"expected,omitempty"`
// OrderBy specifies how results are sorted. Default: Horizontal. Options: Horizontal | Vertical | Score | Random | Expected.
OrderBy NeuralNetworkClassifyOrderBy `json:"order_by,omitempty"`
// Index specifies which match to select from results.
Index int `json:"index,omitempty"`
}
NeuralNetworkClassifyParam defines parameters for neural network classification.

type NeuralNetworkClassifyResult
type NeuralNetworkClassifyResult struct {
Box Rect `json:"box"`
ClsIndex uint64 `json:"cls_index"`
Label string `json:"label"`
Score float64 `json:"score"`
}
type NeuralNetworkDetectOrderBy
type NeuralNetworkDetectOrderBy OrderBy
NeuralNetworkDetectOrderBy defines the ordering options for neural network detection results.

type NeuralNetworkDetectParam
type NeuralNetworkDetectParam struct {
// ROI specifies the region of interest for recognition.
ROI Target `json:"roi,omitzero"`
// ROIOffset specifies the offset applied to ROI.
ROIOffset Rect `json:"roi_offset,omitempty"`
// Labels specifies the class names for debugging and logging. Auto-reads from model metadata if not provided.
Labels []string `json:"labels,omitempty"`
// Model specifies the model folder path relative to model/detect directory. Required. Supports YOLOv8/YOLOv11 ONNX models.
Model string `json:"model,omitempty"`
// Expected specifies the expected class indices. Required.
Expected []int `json:"expected,omitempty"`
// OrderBy specifies how results are sorted. Default: Horizontal. Options: Horizontal | Vertical | Score | Area | Random | Expected
OrderBy NeuralNetworkDetectOrderBy `json:"order_by,omitempty"`
// Index specifies which match to select from results.
Index int `json:"index,omitempty"`
}
NeuralNetworkDetectParam defines parameters for neural network object detection.

type NeuralNetworkDetectResult
type NeuralNetworkDetectResult struct {
Box Rect `json:"box"`
ClsIndex uint64 `json:"cls_index"`
Label string `json:"label"`
Score float64 `json:"score"`
}
type NextItem
type NextItem struct {
// Name is the name of the target node.
Name string `json:"name"`
// JumpBack indicates whether to jump back to the parent node after this node's chain completes.
JumpBack bool `json:"jump_back"`
// Anchor indicates whether this node should be set as the anchor.
Anchor bool `json:"anchor"`
}
NextItem is one item in the list of nodes to run next. It is used in Node.Next (on success) and Node.OnError (on failure).

func (NextItem) FormatName
func (i NextItem) FormatName() string
FormatName returns the name with attribute prefixes, e.g. [JumpBack]NodeA.

type Node
type Node struct {
Name string `json:"-"`

    // Anchor maps anchor name to target node name. This matches GetNodeData output format.
    Anchor map[string]string `json:"anchor,omitempty"`

    // Recognition defines how this node recognizes targets on screen.
    Recognition *Recognition `json:"recognition,omitempty"`
    // Action defines what action to perform when recognition succeeds.
    Action *Action `json:"action,omitempty"`
    // Next specifies the list of possible next nodes to execute.
    Next []NextItem `json:"next,omitempty"`
    // RateLimit sets the minimum interval between recognition attempts in milliseconds. Default: 1000.
    RateLimit *int64 `json:"rate_limit,omitempty"`
    // Timeout sets the maximum time to wait for recognition in milliseconds. Default: 20000.
    Timeout *int64 `json:"timeout,omitempty"`
    // OnError specifies nodes to execute when recognition times out or action execution fails.
    OnError []NextItem `json:"on_error,omitempty"`
    // Inverse inverts the recognition result. Default: false.
    Inverse bool `json:"inverse,omitempty"`
    // Enabled determines whether this node is active. Default: true.
    Enabled *bool `json:"enabled,omitempty"`
    // MaxHit sets the maximum hit count of the node. Default: unlimited.
    MaxHit *uint64 `json:"max_hit,omitempty"`
    // PreDelay sets the delay before action execution in milliseconds. Default: 200.
    PreDelay *int64 `json:"pre_delay,omitempty"`
    // PostDelay sets the delay after action execution in milliseconds. Default: 200.
    PostDelay *int64 `json:"post_delay,omitempty"`
    // PreWaitFreezes waits for screen to stabilize before action execution.
    PreWaitFreezes *WaitFreezesParam `json:"pre_wait_freezes,omitempty"`
    // PostWaitFreezes waits for screen to stabilize after action.
    PostWaitFreezes *WaitFreezesParam `json:"post_wait_freezes,omitempty"`
    // Repeat specifies the number of times to repeat the node. Default: 1.
    Repeat *uint64 `json:"repeat,omitempty"`
    // RepeatDelay sets the delay between repetitions in milliseconds. Default: 0.
    RepeatDelay *int64 `json:"repeat_delay,omitempty"`
    // RepeatWaitFreezes waits for screen to stabilize between repetitions.
    RepeatWaitFreezes *WaitFreezesParam `json:"repeat_wait_freezes,omitempty"`
    // Focus specifies custom focus data.
    Focus any `json:"focus,omitempty"`
    // Attach provides additional custom data for the node.
    Attach map[string]any `json:"attach,omitempty"`

}
Node represents a single task node in the pipeline.

func NewNode
func NewNode(name string) \*Node
NewNode creates a new Node with the given name.

func (*Node) AddAnchor
func (n *Node) AddAnchor(anchor string) \*Node
AddAnchor sets an anchor to the current node and returns the node for chaining.

func (*Node) AddNext
func (n *Node) AddNext(name string, opts ...NodeAttributeOption) \*Node
AddNext appends a node to the next list and returns the node for chaining.

func (*Node) AddOnError
func (n *Node) AddOnError(name string, opts ...NodeAttributeOption) \*Node
AddOnError appends a node to the on_error list and returns the node for chaining.

func (*Node) ClearAnchor
func (n *Node) ClearAnchor(anchor string) \*Node
ClearAnchor marks an anchor as cleared and returns the node for chaining.

func (*Node) RemoveAnchor
func (n *Node) RemoveAnchor(anchor string) \*Node
RemoveAnchor removes an anchor from the node and returns the node for chaining.

func (*Node) RemoveNext
func (n *Node) RemoveNext(name string) \*Node
RemoveNext removes a node from the next list and returns the node for chaining.

func (*Node) RemoveOnError
func (n *Node) RemoveOnError(name string) \*Node
RemoveOnError removes a node from the on_error list and returns the node for chaining.

func (*Node) SetAction
func (n *Node) SetAction(act *Action) *Node
SetAction sets the action for the node and returns the node for chaining.

func (*Node) SetAnchor
func (n *Node) SetAnchor(anchor map[string]string) \*Node
SetAnchor sets the anchor for the node and returns the node for chaining.

func (*Node) SetAnchorTarget
func (n *Node) SetAnchorTarget(anchor, nodeName string) \*Node
SetAnchorTarget sets an anchor to a specific target node and returns the node for chaining.

func (*Node) SetAttach
func (n *Node) SetAttach(attach map[string]any) \*Node
SetAttach sets the attached custom data for the node and returns the node for chaining. The map is copied so the node does not share state with the caller. A nil attach is stored as an empty map so that Attach is never nil.

func (*Node) SetEnabled
func (n *Node) SetEnabled(enabled bool) \*Node
SetEnabled sets whether the node is enabled and returns the node for chaining.

func (*Node) SetFocus
func (n *Node) SetFocus(focus any) \*Node
SetFocus sets the focus data for the node and returns the node for chaining.

func (*Node) SetInverse
func (n *Node) SetInverse(inverse bool) \*Node
SetInverse sets whether to invert the recognition result and returns the node for chaining.

func (*Node) SetMaxHit
func (n *Node) SetMaxHit(maxHit uint64) \*Node
SetMaxHit sets the maximum hit count of the node and returns the node for chaining.

func (*Node) SetNext
func (n *Node) SetNext(next []NextItem) \*Node
SetNext sets the next nodes list for the node and returns the node for chaining.

func (*Node) SetOnError
func (n *Node) SetOnError(onError []NextItem) \*Node
SetOnError sets the error handling nodes for the node and returns the node for chaining.

func (*Node) SetPostDelay
func (n *Node) SetPostDelay(postDelay time.Duration) \*Node
SetPostDelay sets the delay after action execution and returns the node for chaining.

func (*Node) SetPostWaitFreezes
func (n *Node) SetPostWaitFreezes(postWaitFreezes *WaitFreezesParam) *Node
SetPostWaitFreezes sets the post-action wait freezes configuration and returns the node for chaining.

func (*Node) SetPreDelay
func (n *Node) SetPreDelay(preDelay time.Duration) \*Node
SetPreDelay sets the delay before action execution and returns the node for chaining.

func (*Node) SetPreWaitFreezes
func (n *Node) SetPreWaitFreezes(preWaitFreezes *WaitFreezesParam) *Node
SetPreWaitFreezes sets the pre-action wait freezes configuration and returns the node for chaining.

func (*Node) SetRateLimit
func (n *Node) SetRateLimit(rateLimit time.Duration) \*Node
SetRateLimit sets the rate limit for the node and returns the node for chaining.

func (*Node) SetRecognition
func (n *Node) SetRecognition(rec *Recognition) *Node
SetRecognition sets the recognition for the node and returns the node for chaining.

func (*Node) SetRepeat
func (n *Node) SetRepeat(repeat uint64) \*Node
SetRepeat sets the number of times to repeat the node and returns the node for chaining.

func (*Node) SetRepeatDelay
func (n *Node) SetRepeatDelay(repeatDelay time.Duration) \*Node
SetRepeatDelay sets the delay between repetitions and returns the node for chaining.

func (*Node) SetRepeatWaitFreezes
func (n *Node) SetRepeatWaitFreezes(repeatWaitFreezes *WaitFreezesParam) *Node
SetRepeatWaitFreezes sets the wait freezes configuration between repetitions and returns the node for chaining.

func (*Node) SetTimeout
func (n *Node) SetTimeout(timeout time.Duration) \*Node
SetTimeout sets the timeout for the node and returns the node for chaining.

type NodeActionDetail
type NodeActionDetail struct {
TaskID uint64 `json:"task_id"`
ActionID uint64 `json:"action_id"`
Name string `json:"name"`
Focus any `json:"focus"`
}
NodeActionDetail contains information about node action events

type NodeActionNodeDetail
type NodeActionNodeDetail struct {
TaskID uint64 `json:"task_id"`
NodeID uint64 `json:"node_id"`
Name string `json:"name"`
Focus any `json:"focus"`
}
NodeActionNodeDetail contains information about action node events

type NodeAttributeOption
type NodeAttributeOption func(\*NextItem)
NodeAttributeOption is a functional option for configuring NextItem attributes.

func WithAnchor
func WithAnchor() NodeAttributeOption
WithAnchor enables anchor reference. The name field will be treated as an anchor name and resolved to the last node that set this anchor at runtime.

func WithJumpBack
func WithJumpBack() NodeAttributeOption
WithJumpBack enables the jump-back mechanism. When this node matches, the system returns to the parent node after completing this node's chain, and continues recognizing from the start of next list.

type NodeDetail
type NodeDetail struct {
ID int64
Name string
Recognition *RecognitionDetail
Action *ActionDetail
RunCompleted bool
}
NodeDetail contains node information.

type NodeNextListDetail
type NodeNextListDetail struct {
TaskID uint64 `json:"task_id"`
Name string `json:"name"`
List []NextItem `json:"list"`
Focus any `json:"focus"`
}
NodeNextListDetail contains information about node next list events

type NodePipelineNodeDetail
type NodePipelineNodeDetail struct {
TaskID uint64 `json:"task_id"`
NodeID uint64 `json:"node_id"`
Name string `json:"name"`
Focus any `json:"focus"`
}
NodePipelineNodeDetail contains information about pipeline node events

type NodeRecognitionDetail
type NodeRecognitionDetail struct {
TaskID uint64 `json:"task_id"`
RecognitionID uint64 `json:"reco_id"`
Name string `json:"name"`
Focus any `json:"focus"`
}
NodeRecognitionDetail contains information about node recognition events

type NodeRecognitionNodeDetail
type NodeRecognitionNodeDetail struct {
TaskID uint64 `json:"task_id"`
NodeID uint64 `json:"node_id"`
Name string `json:"name"`
Focus any `json:"focus"`
}
NodeRecognitionNodeDetail contains information about recognition node events

type OCROrderBy
type OCROrderBy OrderBy
OCROrderBy defines the ordering options for OCR results.

type OCRParam
type OCRParam struct {
// ROI specifies the region of interest for recognition.
ROI Target `json:"roi,omitzero"`
// ROIOffset specifies the offset applied to ROI.
ROIOffset Rect `json:"roi_offset,omitempty"`
// Expected specifies the expected text results, supports regex.
Expected []string `json:"expected,omitempty"`
// Threshold specifies the model confidence threshold [0-1.0]. Default: 0.3.
Threshold float64 `json:"threshold,omitempty"`
// Replace specifies text replacement rules for correcting OCR errors.
Replace [][2]string `json:"replace,omitempty"`
// OrderBy specifies how results are sorted. Default: Horizontal. Options: Horizontal | Vertical | Area | Length | Random | Expected.
OrderBy OCROrderBy `json:"order_by,omitempty"`
// Index specifies which match to select from results.
Index int `json:"index,omitempty"`
// OnlyRec enables recognition-only mode without detection (requires precise ROI). Default: false.
OnlyRec bool `json:"only_rec,omitempty"`
// Model specifies the model folder path relative to model/ocr directory.
Model string `json:"model,omitempty"`
// ColorFilter specifies a ColorMatch node name whose color parameters (method, lower, upper)
// are used to binarize the image before OCR. Nodes with this field set will not participate in batch optimization.
ColorFilter string `json:"color_filter,omitempty"`
}
OCRParam defines parameters for OCR text recognition.

type OCRResult
type OCRResult struct {
Box Rect `json:"box"`
Text string `json:"text"`
Score float64 `json:"score"`
}
type OrRecognitionParam
type OrRecognitionParam struct {
AnyOf []SubRecognitionItem `json:"any_of,omitempty"`
}
OrRecognitionParam defines parameters for OR recognition. AnyOf elements are either node name strings or inline recognitions.

type OrderBy
type OrderBy string
OrderBy defines the ordering options for recognition results. Different recognition types support different subsets of these values.

const (
OrderByHorizontal OrderBy = "Horizontal"
OrderByVertical OrderBy = "Vertical"
OrderByScore OrderBy = "Score"
OrderByArea OrderBy = "Area"
OrderByLength OrderBy = "Length"
OrderByRandom OrderBy = "Random"
OrderByExpected OrderBy = "Expected"
)
type Pipeline
type Pipeline struct {
// contains filtered or unexported fields
}
Pipeline represents a collection of nodes that define a task flow.

func NewPipeline
func NewPipeline() \*Pipeline
NewPipeline creates a new empty Pipeline.

func (*Pipeline) AddNode
func (p *Pipeline) AddNode(node *Node) *Pipeline
AddNode adds a node to the pipeline and returns the pipeline for chaining.

func (*Pipeline) Clear
func (p *Pipeline) Clear() \*Pipeline
Clear resets the pipeline nodes; preserves chaining behavior.

func (*Pipeline) GetNode
func (p *Pipeline) GetNode(name string) (\*Node, bool)
GetNode returns a node by name with an existence flag.

func (*Pipeline) HasNode
func (p *Pipeline) HasNode(name string) bool
HasNode reports whether a node with the given name exists.

func (*Pipeline) Len
func (p *Pipeline) Len() int
Len returns the number of nodes in the pipeline.

func (*Pipeline) MarshalJSON
func (p *Pipeline) MarshalJSON() ([]byte, error)
MarshalJSON implements the json.Marshaler interface.

func (*Pipeline) RemoveNode
func (p *Pipeline) RemoveNode(name string) \*Pipeline
RemoveNode removes a node by name and returns the pipeline for chaining.

type Point
type Point [2]int
Point represents a 2D point [x, y].

func (*Point) UnmarshalJSON
func (p *Point) UnmarshalJSON(data []byte) error
func (Point) X
func (p Point) X() int
func (Point) Y
func (p Point) Y() int
type Recognition
type Recognition struct {
// Type specifies the recognition algorithm type.
Type RecognitionType `json:"type,omitempty"`
// Param specifies the recognition parameters.
Param RecognitionParam `json:"param,omitempty"`
}
Recognition defines the recognition configuration for a node.

func RecAnd
func RecAnd(items ...SubRecognitionItem) \*Recognition
RecAnd creates an AND recognition that requires all sub-recognitions to succeed. Use SetBoxIndex to set which result's box to use. Example: RecAnd(Ref("NodeA"), Inline(RecDirectHit(), "sub1")).SetBoxIndex(2)

func RecColorMatch
func RecColorMatch(p ColorMatchParam) \*Recognition
RecColorMatch creates a ColorMatch recognition with the given parameters.

func RecCustom
func RecCustom(p CustomRecognitionParam) \*Recognition
RecCustom creates a Custom recognition with the given parameters.

func RecDirectHit
func RecDirectHit() \*Recognition
RecDirectHit creates a DirectHit recognition that always succeeds without actual recognition.

func RecFeatureMatch
func RecFeatureMatch(p FeatureMatchParam) \*Recognition
RecFeatureMatch creates a FeatureMatch recognition with the given parameters. Feature matching provides better generalization with perspective and scale invariance.

func RecNeuralNetworkClassify
func RecNeuralNetworkClassify(p NeuralNetworkClassifyParam) \*Recognition
RecNeuralNetworkClassify creates a NeuralNetworkClassify recognition with the given parameters. This classifies images at fixed positions into predefined categories.

func RecNeuralNetworkDetect
func RecNeuralNetworkDetect(p NeuralNetworkDetectParam) \*Recognition
RecNeuralNetworkDetect creates a NeuralNetworkDetect recognition with the given parameters. This detects objects at arbitrary positions using deep learning models like YOLO.

func RecOCR
func RecOCR(p OCRParam) \*Recognition
RecOCR creates an OCR recognition with the given parameters. All fields are optional; pass OCRParam{} for defaults.

func RecOr
func RecOr(anyOf ...SubRecognitionItem) \*Recognition
RecOr creates an OR recognition that succeeds if any sub-recognition succeeds.

func RecTemplateMatch
func RecTemplateMatch(p TemplateMatchParam) \*Recognition
RecTemplateMatch creates a TemplateMatch recognition with the given parameters.

func (*Recognition) SetBoxIndex
func (nr *Recognition) SetBoxIndex(idx int) \*Recognition
SetBoxIndex sets which sub-recognition result's box to use as the final box. Only effective when the recognition type is And.

func (*Recognition) UnmarshalJSON
func (nr *Recognition) UnmarshalJSON(data []byte) error
type RecognitionDetail
type RecognitionDetail struct {
ID int64
Name string
Algorithm string
Hit bool
Box Rect
DetailJson string
Results *RecognitionResults // nil if algorithm is DirectHit, And or Or.
CombinedResult []*RecognitionDetail // for And/Or algorithms only.
Raw image.Image // available when debug mode or save_draw is enabled.
Draws []image.Image // available when debug mode or save_draw is enabled.
}
RecognitionDetail contains recognition information.

type RecognitionParam
type RecognitionParam interface {
// contains filtered or unexported methods
}
RecognitionParam is the interface for recognition parameters.

type RecognitionResult
type RecognitionResult struct {
// contains filtered or unexported fields
}
func (*RecognitionResult) AsColorMatch
func (r *RecognitionResult) AsColorMatch() (\*ColorMatchResult, bool)
AsColorMatch returns the result as ColorMatchResult if the type matches.

func (*RecognitionResult) AsCustom
func (r *RecognitionResult) AsCustom() (*CustomRecognitionResult, bool)
func (*RecognitionResult) AsFeatureMatch
func (r *RecognitionResult) AsFeatureMatch() (*FeatureMatchResult, bool)
AsFeatureMatch returns the result as FeatureMatchResult if the type matches.

func (*RecognitionResult) AsNeuralNetworkClassify
func (r *RecognitionResult) AsNeuralNetworkClassify() (\*NeuralNetworkClassifyResult, bool)
AsNeuralNetworkClassify returns the result as NeuralNetworkClassifyResult if the type matches.

func (*RecognitionResult) AsNeuralNetworkDetect
func (r *RecognitionResult) AsNeuralNetworkDetect() (\*NeuralNetworkDetectResult, bool)
AsNeuralNetworkDetect returns the result as NeuralNetworkDetectResult if the type matches.

func (*RecognitionResult) AsOCR
func (r *RecognitionResult) AsOCR() (\*OCRResult, bool)
AsOCR returns the result as OCRResult if the type matches.

func (*RecognitionResult) AsTemplateMatch
func (r *RecognitionResult) AsTemplateMatch() (\*TemplateMatchResult, bool)
AsTemplateMatch returns the result as TemplateMatchResult if the type matches.

func (*RecognitionResult) Type
func (r *RecognitionResult) Type() RecognitionType
Type returns the recognition type of the result.

func (*RecognitionResult) Value
func (r *RecognitionResult) Value() any
Value returns the underlying value of the result.

type RecognitionResults
type RecognitionResults struct {
All []*RecognitionResult `json:"all"`
Best *RecognitionResult `json:"best"`
Filtered []\*RecognitionResult `json:"filtered"`
}
RecognitionResults contains all, best, and filtered recognition results. Detail JSON format: {"all": [Result...], "best": Result | null, "filtered": [Result...]} if algorithm is direct hit, Results is nil

type RecognitionType
type RecognitionType string
RecognitionType defines the available recognition algorithm types.

const (
RecognitionTypeDirectHit RecognitionType = "DirectHit"
RecognitionTypeTemplateMatch RecognitionType = "TemplateMatch"
RecognitionTypeFeatureMatch RecognitionType = "FeatureMatch"
RecognitionTypeColorMatch RecognitionType = "ColorMatch"
RecognitionTypeOCR RecognitionType = "OCR"
RecognitionTypeNeuralNetworkClassify RecognitionType = "NeuralNetworkClassify"
RecognitionTypeNeuralNetworkDetect RecognitionType = "NeuralNetworkDetect"
RecognitionTypeAnd RecognitionType = "And"
RecognitionTypeOr RecognitionType = "Or"
RecognitionTypeCustom RecognitionType = "Custom"
)
type Rect
type Rect = rect.Rect
type Resource
type Resource struct {
// contains filtered or unexported fields
}
Resource manages the loading and configuration of resources required by Tasker. It handles pipeline definitions, OCR models, images, and inference device settings. Resource also provides registration of custom recognitions and actions.

A Resource must be created with NewResource and should be destroyed with Destroy when no longer needed.

func NewResource
func NewResource() (\*Resource, error)
NewResource creates a new resource.

func (*Resource) AddSink
func (r *Resource) AddSink(sink ResourceEventSink) int64
AddSink adds a event callback sink and returns the sink ID. The sink ID can be used to remove the sink later.

func (*Resource) Clear
func (r *Resource) Clear() error
Clear clears loaded content. This method fails if resources are currently loading.

func (*Resource) ClearCustomAction
func (r *Resource) ClearCustomAction() error
ClearCustomAction clears all custom actions runners registered from the resource.

func (*Resource) ClearCustomRecognition
func (r *Resource) ClearCustomRecognition() error
ClearCustomRecognition clears all custom recognitions runner registered from the resource.

func (*Resource) ClearSinks
func (r *Resource) ClearSinks()
ClearSinks clears all event callback sinks.

func (*Resource) Destroy
func (r *Resource) Destroy()
Destroy frees the resource.

func (*Resource) GetCustomActionList
func (r *Resource) GetCustomActionList() ([]string, error)
GetCustomActionList returns the custom action list of the resource.

func (*Resource) GetCustomRecognitionList
func (r *Resource) GetCustomRecognitionList() ([]string, error)
GetCustomRecognitionList returns the custom recognition list of the resource.

func (*Resource) GetDefaultActionParam
func (r *Resource) GetDefaultActionParam(actionType ActionType) (ActionParam, error)
GetDefaultActionParam returns the default action parameters for the specified type from DefaultPipelineMgr. actionType is an action type (e.g., ActionTypeClick, ActionTypeSwipe). Returns the parsed ActionParam interface.

func (*Resource) GetDefaultRecognitionParam
func (r *Resource) GetDefaultRecognitionParam(recoType RecognitionType) (RecognitionParam, error)
GetDefaultRecognitionParam returns the default recognition parameters for the specified type from DefaultPipelineMgr. recoType is a recognition type (e.g., RecognitionTypeOCR, RecognitionTypeTemplateMatch). Returns the parsed RecognitionParam interface.

func (*Resource) GetHash
func (r *Resource) GetHash() (string, error)
GetHash returns the hash of the resource.

func (*Resource) GetNode
func (r *Resource) GetNode(name string) (\*Node, error)
GetNode returns the node definition by name. It fetches the node JSON via GetNodeJSON and unmarshals it into a Node struct.

func (*Resource) GetNodeJSON
func (r *Resource) GetNodeJSON(name string) (string, error)
GetNodeJSON gets the task definition JSON by name.

func (*Resource) GetNodeList
func (r *Resource) GetNodeList() ([]string, error)
GetNodeList returns the node list of the resource.

func (*Resource) Loaded
func (r *Resource) Loaded() bool
Loaded checks if resources are loaded.

func (*Resource) OnResourceLoading
func (r *Resource) OnResourceLoading(fn func(EventStatus, ResourceLoadingDetail)) int64
OnResourceLoading registers a callback sink that only handles Resource.Loading events and returns the sink ID. The sink ID can be used to remove the sink later.

func (*Resource) OverrideImage
func (r *Resource) OverrideImage(imageName string, image image.Image) error
OverrideImage overrides the image data for the specified image name.

func (*Resource) OverrideNext
func (r *Resource) OverrideNext(name string, nextList []NextItem) error
OverrideNext overrides the next list of a task by name. It sets the list directly and will create the node if it doesn't exist.

func (*Resource) OverridePipeline
func (r *Resource) OverridePipeline(override any) error
OverridePipeline overrides the pipeline. override can be a JSON string or any value that can be marshaled to JSON.

func (*Resource) PostBundle
func (r *Resource) PostBundle(path string) \*Job
PostBundle asynchronously loads resource paths and returns a Job. This is an async operation that immediately returns a Job, which can be queried via status/wait.

func (*Resource) PostImage
func (r *Resource) PostImage(path string) \*Job
PostImage asynchronously loads image resources and returns a Job. Supports loading a directory or a single image file. This is an async operation that immediately returns a Job, which can be queried via status/wait.

func (*Resource) PostOcrModel
func (r *Resource) PostOcrModel(path string) \*Job
PostOcrModel asynchronously loads an OCR model directory and returns a Job. This is an async operation that immediately returns a Job, which can be queried via status/wait.

func (*Resource) PostPipeline
func (r *Resource) PostPipeline(path string) \*Job
PostPipeline asynchronously loads a pipeline and returns a Job. Supports loading a directory or a single json/jsonc file. This is an async operation that immediately returns a Job, which can be queried via status/wait.

func (*Resource) RegisterCustomAction
func (r *Resource) RegisterCustomAction(name string, action CustomActionRunner) error
RegisterCustomAction registers a custom action runner to the resource.

func (*Resource) RegisterCustomRecognition
func (r *Resource) RegisterCustomRecognition(name string, recognition CustomRecognitionRunner) error
RegisterCustomRecognition registers a custom recognition runner to the resource.

func (*Resource) RemoveSink
func (r *Resource) RemoveSink(sinkId int64)
RemoveSink removes a event callback sink by sink ID.

func (*Resource) UnregisterCustomAction
func (r *Resource) UnregisterCustomAction(name string) error
UnregisterCustomAction unregisters a custom action runner from the resource.

func (*Resource) UnregisterCustomRecognition
func (r *Resource) UnregisterCustomRecognition(name string) error
UnregisterCustomRecognition unregisters a custom recognition runner from the resource.

func (*Resource) UseAutoExecutionProvider
func (r *Resource) UseAutoExecutionProvider() error
UseAutoExecutionProvider automatically selects the inference execution provider and device.

func (*Resource) UseCPU
func (r *Resource) UseCPU() error
UseCPU uses CPU for inference.

func (*Resource) UseCoreml
func (r *Resource) UseCoreml(coremlFlag InferenceDevice) error
UseCoreml uses CoreML for inference. coremlFlag is the CoreML flag; use InferenceDeviceAuto for auto selection.

func (*Resource) UseDirectml
func (r *Resource) UseDirectml(deviceID InferenceDevice) error
UseDirectml uses DirectML for inference. deviceID is the device id; use InferenceDeviceAuto for auto selection.

type ResourceEventSink
type ResourceEventSink interface {
OnResourceLoading(res \*Resource, event EventStatus, detail ResourceLoadingDetail)
}
type ResourceLoadingDetail
type ResourceLoadingDetail struct {
ResID uint64 `json:"res_id"`
Hash string `json:"hash"`
Path string `json:"path"`
}
ResourceLoadingDetail contains information about resource loading events

type ScreenshotOption
type ScreenshotOption func(\*screenshotOptionConfig)
ScreenshotOption configures how the screenshot is resized. If multiple options are provided, only the last one is applied.

func WithScreenshotTargetLongSide
func WithScreenshotTargetLongSide(targetLongSide int32) ScreenshotOption
WithScreenshotTargetLongSide sets screenshot target long side. Only one of long and short side can be set, and the other is automatically scaled according to the aspect ratio.

eg: 1280

func WithScreenshotTargetShortSide
func WithScreenshotTargetShortSide(targetShortSide int32) ScreenshotOption
WithScreenshotTargetShortSide sets screenshot target short side. Only one of long and short side can be set, and the other is automatically scaled according to the aspect ratio.

eg: 720

func WithScreenshotUseRawSize
func WithScreenshotUseRawSize(enabled bool) ScreenshotOption
WithScreenshotUseRawSize sets whether the screenshot uses the raw size without scaling.

type ScrollActionResult
type ScrollActionResult struct {
// Point is kept to match MaaFramework raw detail JSON.
Point Point `json:"point"`
Dx int `json:"dx"`
Dy int `json:"dy"`
}
type ScrollParam
type ScrollParam struct {
// Target specifies the scroll target position.
Target Target `json:"target,omitzero"`
// TargetOffset specifies additional offset applied to target.
TargetOffset Rect `json:"target_offset,omitempty"`
// Dx specifies the horizontal scroll amount.
Dx int `json:"dx,omitempty"`
// Dy specifies the vertical scroll amount.
Dy int `json:"dy,omitempty"`
}
ScrollParam defines parameters for scroll action.

type ShellActionResult
type ShellActionResult struct {
Cmd string `json:"cmd"`
ShellTimeout int `json:"shell_timeout"`
Success bool `json:"success"`
Output string `json:"output"`
}
type ShellParam
type ShellParam struct {
Cmd string `json:"cmd,omitempty"`
}
ShellParam defines parameters for shell command execution action.

type StartAppParam
type StartAppParam struct {
// Package specifies the package name or activity to start. Required.
Package string `json:"package,omitempty"`
}
StartAppParam defines parameters for start app action.

type Status
type Status int32
Status represents the lifecycle state of a task or item.

const (
StatusInvalid Status = 0 // Unknown or uninitialized state
StatusPending Status = 1000 // Queued but not yet started
StatusRunning Status = 2000 // Work is in progress
StatusSuccess Status = 3000 // Completed successfully
StatusFailure Status = 4000 // Completed with failure
)
func (Status) Done
func (s Status) Done() bool
Done reports whether the status is terminal (success or failure).

func (Status) Failure
func (s Status) Failure() bool
Failure reports whether the status is StatusFailure.

func (Status) Invalid
func (s Status) Invalid() bool
Invalid reports whether the status is StatusInvalid.

func (Status) Pending
func (s Status) Pending() bool
Pending reports whether the status is StatusPending.

func (Status) Running
func (s Status) Running() bool
Running reports whether the status is StatusRunning.

func (Status) String
func (s Status) String() string
String returns the human-readable representation of the Status.

func (Status) Success
func (s Status) Success() bool
Success reports whether the status is StatusSuccess.

type StopAppParam
type StopAppParam struct {
// Package specifies the package name to stop. Required.
Package string `json:"package,omitempty"`
}
StopAppParam defines parameters for stop app action.

type StopTaskParam
type StopTaskParam struct{}
StopTaskParam defines parameters for stop task action. This action stops the current task chain.

type SubRecognitionItem
type SubRecognitionItem struct {
// NodeName is set when the JSON value is a string (reference to another node by name).
NodeName string
// Inline is set when the JSON value is an object (inline recognition with type, param, sub_name).
Inline \*InlineSubRecognition
}
SubRecognitionItem is one element of And all_of / Or any_of. It is either a node name (string reference) or an inline recognition (object with type, param, sub_name). GetNodeData from C++ outputs: all_of/any_of as array of string | object; this type supports both.

func Inline
func Inline(rec \*Recognition, name ...string) SubRecognitionItem
Inline builds a SubRecognitionItem from a recognition; optional name is the sub_name. Example: RecOr(Inline(RecTemplateMatch(...)), Inline(RecColorMatch(...))) Example: RecAnd(Ref("A"), Inline(RecDirectHit(), "sub1")).SetBoxIndex(2)

func Ref
func Ref(nodeName string) SubRecognitionItem
Ref returns a SubRecognitionItem that references another node by name.

func (SubRecognitionItem) MarshalJSON
func (s SubRecognitionItem) MarshalJSON() ([]byte, error)
MarshalJSON outputs a string when NodeName is set, otherwise the inline object.

func (*SubRecognitionItem) UnmarshalJSON
func (s *SubRecognitionItem) UnmarshalJSON(data []byte) error
UnmarshalJSON supports both string (node name) and object (inline recognition).

type SwipeActionResult
type SwipeActionResult struct {
Begin Point `json:"begin"`
End []Point `json:"end"`
EndHold []int `json:"end_hold"`
Duration []int `json:"duration"`
OnlyHover bool `json:"only_hover"`
Starting int `json:"starting"`
Contact int `json:"contact"`
// Pressure is kept to match MaaFramework raw detail JSON.
Pressure int `json:"pressure"`
// contains filtered or unexported fields
}
func (SwipeActionResult) MarshalJSON
func (s SwipeActionResult) MarshalJSON() ([]byte, error)
func (*SwipeActionResult) UnmarshalJSON
func (s *SwipeActionResult) UnmarshalJSON(data []byte) error
type SwipeParam
type SwipeParam struct {
// Begin specifies the swipe start position.
Begin Target `json:"begin,omitzero"`
// BeginOffset specifies additional offset applied to begin position.
BeginOffset Rect `json:"begin_offset,omitempty"`
// End specifies the swipe end position.
End []Target `json:"end,omitzero"`
// EndOffset specifies additional offset applied to end position.
EndOffset []Rect `json:"end_offset,omitempty"`
// Duration specifies the swipe duration. Default: 200ms.
// JSON: serialized as array of integer milliseconds.
Duration []time.Duration `json:"-"`
// EndHold specifies extra wait time at end position before releasing. Default: 0.
// JSON: serialized as array of integer milliseconds.
EndHold []time.Duration `json:"-"`
// OnlyHover enables hover-only mode without press/release actions. Default: false.
OnlyHover bool `json:"only_hover,omitempty"`
// Contact specifies the touch point identifier. Adb: finger index (0=first finger). Win32: mouse button (0=left, 1=right, 2=middle).
Contact int `json:"contact,omitempty"`
}
SwipeParam defines parameters for swipe action.

func (SwipeParam) MarshalJSON
func (p SwipeParam) MarshalJSON() ([]byte, error)
func (*SwipeParam) UnmarshalJSON
func (p *SwipeParam) UnmarshalJSON(data []byte) error
type Target
type Target = target.Target
func NewTargetBool
func NewTargetBool(val bool) Target
func NewTargetRect
func NewTargetRect(val Rect) Target
func NewTargetString
func NewTargetString(val string) Target
type TaskDetail
type TaskDetail struct {
ID int64
Entry string
NodeDetails []\*NodeDetail
Status Status
}
TaskDetail contains task information.

type TaskJob
type TaskJob struct {
// contains filtered or unexported fields
}
TaskJob extends Job with task-specific functionality. It provides additional methods to retrieve task details.

func (*TaskJob) Done
func (j *TaskJob) Done() bool
Done reports whether the job is done (either success or failure).

func (*TaskJob) Error
func (j *TaskJob) Error() error
Error returns the error of the task job.

func (*TaskJob) Failure
func (j *TaskJob) Failure() bool
Failure reports whether the status is a failure.

func (*TaskJob) GetDetail
func (j *TaskJob) GetDetail() (\*TaskDetail, error)
GetDetail retrieves the detailed information of the task.

func (*TaskJob) Invalid
func (j *TaskJob) Invalid() bool
Invalid reports whether the status is invalid.

func (*TaskJob) OverridePipeline
func (j *TaskJob) OverridePipeline(override any) error
OverridePipeline overrides the pipeline for a running task. The `override` parameter can be a JSON string or any data type that can be marshaled to JSON.

func (*TaskJob) Pending
func (j *TaskJob) Pending() bool
Pending reports whether the status is pending.

func (*TaskJob) Running
func (j *TaskJob) Running() bool
Running reports whether the status is running.

func (*TaskJob) Status
func (j *TaskJob) Status() Status
Status returns the current status of the task job. If the task job has an error, it returns StatusFailure.

func (*TaskJob) Success
func (j *TaskJob) Success() bool
Success reports whether the status is success.

func (*TaskJob) Wait
func (j *TaskJob) Wait() \*TaskJob
Wait blocks until the task job completes and returns the TaskJob instance.

type Tasker
type Tasker struct {
// contains filtered or unexported fields
}
Tasker is the main task executor that coordinates resources and controllers to perform automated tasks.

func NewTasker
func NewTasker() (\*Tasker, error)
NewTasker creates a new tasker instance.

func (*Tasker) AddContextSink
func (t *Tasker) AddContextSink(sink ContextEventSink) int64
AddContextSink adds a context event listener and returns the sink ID for later removal.

func (*Tasker) AddSink
func (t *Tasker) AddSink(sink TaskerEventSink) int64
AddSink adds an event listener and returns the sink ID for later removal.

func (*Tasker) BindController
func (t *Tasker) BindController(ctrl \*Controller) error
BindController binds an initialized controller to the tasker.

func (*Tasker) BindResource
func (t *Tasker) BindResource(res \*Resource) error
BindResource binds an initialized resource to the tasker.

func (*Tasker) ClearCache
func (t *Tasker) ClearCache() error
ClearCache clears all queryable runtime cache.

func (*Tasker) ClearContextSinks
func (t *Tasker) ClearContextSinks()
ClearContextSinks clears all context event listeners.

func (*Tasker) ClearSinks
func (t *Tasker) ClearSinks()
ClearSinks clears all instance event listeners.

func (*Tasker) Destroy
func (t *Tasker) Destroy()
Destroy frees the tasker and releases all associated resources. After calling this method, the tasker should not be used anymore.

func (*Tasker) GetActionDetail
func (t *Tasker) GetActionDetail(actionId int64) (*ActionDetail, error)
func (*Tasker) GetController
func (t *Tasker) GetController() *Controller
GetController returns the bound controller of the tasker.

func (*Tasker) GetLatestNode
func (t *Tasker) GetLatestNode(taskName string) (\*NodeDetail, error)
GetLatestNode returns the latest node detail for a given task name.

func (*Tasker) GetRecognitionDetail
func (t *Tasker) GetRecognitionDetail(recId int64) (\*RecognitionDetail, error)
GetRecognitionDetail queries recognition detail.

func (*Tasker) GetResource
func (t *Tasker) GetResource() \*Resource
GetResource returns the bound resource of the tasker.

func (*Tasker) GetTaskDetail
func (t *Tasker) GetTaskDetail(taskId int64) (\*TaskDetail, error)
GetTaskDetail queries task detail by task ID.

func (*Tasker) Initialized
func (t *Tasker) Initialized() bool
Initialized checks if the tasker is correctly initialized. A tasker is considered initialized when both a resource and a controller are bound.

func (*Tasker) OnNodeActionInContext
func (t *Tasker) OnNodeActionInContext(fn func(\*Context, EventStatus, NodeActionDetail)) int64
OnNodeActionInContext registers a callback for Node.Action events and returns the sink ID.

func (*Tasker) OnNodeActionNodeInContext
func (t *Tasker) OnNodeActionNodeInContext(fn func(\*Context, EventStatus, NodeActionNodeDetail)) int64
OnNodeActionNodeInContext registers a callback for Node.ActionNode events and returns the sink ID.

func (*Tasker) OnNodeNextListInContext
func (t *Tasker) OnNodeNextListInContext(fn func(\*Context, EventStatus, NodeNextListDetail)) int64
OnNodeNextListInContext registers a callback for Node.NextList events and returns the sink ID.

func (*Tasker) OnNodePipelineNodeInContext
func (t *Tasker) OnNodePipelineNodeInContext(fn func(\*Context, EventStatus, NodePipelineNodeDetail)) int64
OnNodePipelineNodeInContext registers a callback for Node.PipelineNode events and returns the sink ID.

func (*Tasker) OnNodeRecognitionInContext
func (t *Tasker) OnNodeRecognitionInContext(fn func(\*Context, EventStatus, NodeRecognitionDetail)) int64
OnNodeRecognitionInContext registers a callback for Node.Recognition events and returns the sink ID.

func (*Tasker) OnNodeRecognitionNodeInContext
func (t *Tasker) OnNodeRecognitionNodeInContext(fn func(\*Context, EventStatus, NodeRecognitionNodeDetail)) int64
OnNodeRecognitionNodeInContext registers a callback for Node.RecognitionNode events and returns the sink ID.

func (*Tasker) OnTaskerTask
func (t *Tasker) OnTaskerTask(fn func(EventStatus, TaskerTaskDetail)) int64
OnTaskerTask registers a callback for Tasker.Task events and returns the sink ID.

func (*Tasker) PostAction
func (t *Tasker) PostAction(actionType ActionType, actionParam ActionParam, box Rect, recoDetail *RecognitionDetail) *TaskJob
PostAction posts an action to the tasker asynchronously. The box and recoDetail are from the previous recognition.

func (*Tasker) PostRecognition
func (t *Tasker) PostRecognition(recType RecognitionType, recParam RecognitionParam, img image.Image) \*TaskJob
PostRecognition posts a recognition to the tasker asynchronously.

func (*Tasker) PostStop
func (t *Tasker) PostStop() \*TaskJob
PostStop posts a stop signal to the tasker asynchronously. It interrupts the currently running task and stops resource loading and controller operations.

func (*Tasker) PostTask
func (t *Tasker) PostTask(entry string, override ...any) \*TaskJob
PostTask posts a task to the tasker asynchronously. The optional override can be a JSON string, []byte, or any JSON-marshalable value.

func (*Tasker) RemoveContextSink
func (t *Tasker) RemoveContextSink(sinkId int64)
RemoveContextSink removes a context event listener by sink ID.

func (*Tasker) RemoveSink
func (t *Tasker) RemoveSink(sinkId int64)
RemoveSink removes an event listener by sink ID.

func (*Tasker) Running
func (t *Tasker) Running() bool
Running checks if the tasker is currently running a task.

func (*Tasker) Stopping
func (t *Tasker) Stopping() bool
Stopping checks if the tasker is in the process of stopping (not yet fully stopped).

type TaskerEventSink
type TaskerEventSink interface {
OnTaskerTask(tasker \*Tasker, event EventStatus, detail TaskerTaskDetail)
}
TaskerEventSink is the interface for receiving tasker-level events.

type TaskerTaskDetail
type TaskerTaskDetail struct {
TaskID uint64 `json:"task_id"`
Entry string `json:"entry"`
UUID string `json:"uuid"`
Hash string `json:"hash"`
}
TaskerTaskDetail contains information about tasker task events

type TemplateMatchMethod
type TemplateMatchMethod int
TemplateMatchMethod defines the template matching algorithm (cv::TemplateMatchModes).

const (
TemplateMatchMethodSQDIFF_NORMED_Inverted TemplateMatchMethod = 10001 // Normalized squared difference (Inverted)
TemplateMatchMethodCCORR_NORMED TemplateMatchMethod = 3 // Normalized cross correlation
TemplateMatchMethodCCOEFF_NORMED TemplateMatchMethod = 5 // Normalized correlation coefficient (default, most accurate)
)
type TemplateMatchOrderBy
type TemplateMatchOrderBy OrderBy
TemplateMatchOrderBy defines the ordering options for template matching results.

type TemplateMatchParam
type TemplateMatchParam struct {
// ROI specifies the region of interest for recognition.
ROI Target `json:"roi,omitzero"`
// ROIOffset specifies the offset applied to ROI.
ROIOffset Rect `json:"roi_offset,omitempty"`
// Template specifies the template image paths. Required.
Template []string `json:"template,omitempty"`
// Threshold specifies the matching threshold [0-1.0]. Default: 0.7.
Threshold []float64 `json:"threshold,omitempty"`
// OrderBy specifies how results are sorted. Default: Horizontal. Options: Horizontal | Vertical | Score | Random.
OrderBy TemplateMatchOrderBy `json:"order_by,omitempty"`
// Index specifies which match to select from results.
Index int `json:"index,omitempty"`
// Method specifies the matching algorithm. 1: SQDIFF_NORMED, 3: CCORR_NORMED, 5: CCOEFF_NORMED. Default: 5.
Method TemplateMatchMethod `json:"method,omitempty"`
// GreenMask enables green color masking for transparent areas.
GreenMask bool `json:"green_mask,omitempty"`
}
TemplateMatchParam defines parameters for template matching recognition.

type TemplateMatchResult
type TemplateMatchResult struct {
Box Rect `json:"box"`
Score float64 `json:"score"`
}
type TouchActionResult
type TouchActionResult struct {
Contact int `json:"contact"`
Point Point `json:"point"`
Pressure int `json:"pressure"`
}
type TouchDownParam
type TouchDownParam struct {
// Target specifies the touch target position.
Target Target `json:"target,omitzero"`
// TargetOffset specifies additional offset applied to target.
TargetOffset Rect `json:"target_offset,omitempty"`
// Pressure specifies the touch pressure, range depends on controller implementation. Default: 0.
Pressure int `json:"pressure,omitempty"`
// Contact specifies the touch point identifier. Adb: finger index (0=first finger). Win32: mouse button (0=left, 1=right, 2=middle).
Contact int `json:"contact,omitempty"`
}
TouchDownParam defines parameters for touch down action.

type TouchMoveParam
type TouchMoveParam struct {
// Target specifies the touch target position.
Target Target `json:"target,omitzero"`
// TargetOffset specifies additional offset applied to target.
TargetOffset Rect `json:"target_offset,omitempty"`
// Pressure specifies the touch pressure, range depends on controller implementation. Default: 0.
Pressure int `json:"pressure,omitempty"`
// Contact specifies the touch point identifier. Adb: finger index (0=first finger). Win32: mouse button (0=left, 1=right, 2=middle).
Contact int `json:"contact,omitempty"`
}
TouchMoveParam defines parameters for touch move action.

type TouchUpParam
type TouchUpParam struct {
// Contact specifies the touch point identifier. Adb: finger index (0=first finger). Win32: mouse button (0=left, 1=right, 2=middle).
Contact int `json:"contact,omitempty"`
}
TouchUpParam defines parameters for touch up action.

type WaitFreezesParam
type WaitFreezesParam struct {
// Time specifies the duration that the screen must remain stable. Default: 1ms.
// JSON: serialized as integer milliseconds.
Time time.Duration `json:"-"`
// Target specifies the region to monitor for changes.
Target Target `json:"target,omitzero"`
// TargetOffset specifies additional offset applied to target.
TargetOffset Rect `json:"target_offset,omitempty"`
// Threshold specifies the template matching threshold for detecting changes. Default: 0.95.
Threshold float64 `json:"threshold,omitempty"`
// Method specifies the template matching algorithm (cv::TemplateMatchModes). Default: 5.
Method int `json:"method,omitempty"`
// RateLimit specifies the minimum interval between checks. Default: 1000ms.
// JSON: serialized as integer milliseconds.
RateLimit time.Duration `json:"-"`
// Timeout specifies the maximum wait time. Default: 20000ms.
// JSON: serialized as integer milliseconds.
Timeout time.Duration `json:"-"`
}
WaitFreezesParam defines parameters for waiting until screen stabilizes. The screen is considered stable when there are no significant changes for a continuous period.

func (WaitFreezesParam) MarshalJSON
func (w WaitFreezesParam) MarshalJSON() ([]byte, error)
func (*WaitFreezesParam) UnmarshalJSON
func (w *WaitFreezesParam) UnmarshalJSON(data []byte) error
