Index
Constants
Variables
func AgentServerAddContextSink(sink ContextEventSink) int64
func AgentServerAddControllerSink(sink ControllerEventSink) int64
func AgentServerAddResourceSink(sink ResourceEventSink) int64
func AgentServerAddTaskerSink(sink TaskerEventSink) int64
func AgentServerDetach()
func AgentServerJoin()
func AgentServerRegisterCustomAction(name string, action CustomActionRunner) bool
func AgentServerRegisterCustomRecognition(name string, recognition CustomRecognitionRunner) bool
func AgentServerShutDown()
func AgentServerStartUp(identifier string) bool
func ConfigInitOption(userPath, defaultJson string) bool
func Init(opts ...InitOption) error
func IsInited() bool
func LoadPlugin(path string) bool
func Release() error
func SetDebugMode(enabled bool) bool
func SetDrawQuality(quality int32) bool
func SetLogDir(path string) bool
func SetRecoImageCacheLimit(limit uint64) bool
func SetSaveDraw(enabled bool) bool
func SetSaveOnError(enabled bool) bool
func SetStdoutLevel(level LoggingLevel) bool
func Version() string
type ActionDetail
type AdbDevice
func FindAdbDevices(specifiedAdb ...string) []*AdbDevice
type AgentClient
func NewAgentClient(identifier string) *AgentClient
func (ac *AgentClient) Alive() bool
func (ac *AgentClient) BindResource(res *Resource) bool
func (ac *AgentClient) Connect() bool
func (ac *AgentClient) Connected() bool
func (ac *AgentClient) Destroy()
func (ac *AgentClient) Disconnect() bool
func (ac *AgentClient) GetCustomActionList() ([]string, bool)
func (ac *AgentClient) GetCustomRecognitionList() ([]string, bool)
func (ac *AgentClient) Identifier() (string, bool)
func (ac *AgentClient) RegisterControllerSink(ctrl Controller) bool
func (ac *AgentClient) RegisterResourceSink(res *Resource) bool
func (ac *AgentClient) RegisterTaskerSink(tasker Tasker) bool
func (ac *AgentClient) SetTimeout(duration time.Duration) bool
type AndRecognitionOption
func WithAndRecognitionBoxIndex(boxIndex int) AndRecognitionOption
type BlankController
func (c *BlankController) Click(x int32, y int32) bool
func (c *BlankController) ClickKey(keycode int32) bool
func (c *BlankController) Connect() bool
func (c *BlankController) Connected() bool
func (c *BlankController) GetFeature() ControllerFeature
func (c *BlankController) InputText(text string) bool
func (c *BlankController) KeyDown(keycode int32) bool
func (c *BlankController) KeyUp(keycode int32) bool
func (c *BlankController) RequestUUID() (string, bool)
func (c *BlankController) Screencap() (image.Image, bool)
func (c *BlankController) StartApp(intent string) bool
func (c *BlankController) StopApp(intent string) bool
func (c *BlankController) Swipe(x1 int32, y1 int32, x2 int32, y2 int32, duration int32) bool
func (c *BlankController) TouchDown(contact int32, x int32, y int32, pressure int32) bool
func (c *BlankController) TouchMove(contact int32, x int32, y int32, pressure int32) bool
func (c *BlankController) TouchUp(contact int32) bool
type CarouselImageController
func (c *CarouselImageController) Click(x int32, y int32) bool
func (c *CarouselImageController) ClickKey(keycode int32) bool
func (c *CarouselImageController) Connect() bool
func (c *CarouselImageController) Connected() bool
func (c *CarouselImageController) GetFeature() ControllerFeature
func (c *CarouselImageController) InputText(text string) bool
func (c *CarouselImageController) KeyDown(keycode int32) bool
func (c *CarouselImageController) KeyUp(keycode int32) bool
func (c *CarouselImageController) RequestUUID() (string, bool)
func (c *CarouselImageController) Screencap() (image.Image, bool)
func (c *CarouselImageController) StartApp(intent string) bool
func (c *CarouselImageController) StopApp(intent string) bool
func (c *CarouselImageController) Swipe(x1 int32, y1 int32, x2 int32, y2 int32, duration int32) bool
func (c *CarouselImageController) TouchDown(contact int32, x int32, y int32, pressure int32) bool
func (c *CarouselImageController) TouchMove(contact int32, x int32, y int32, pressure int32) bool
func (c *CarouselImageController) TouchUp(contact int32) bool
type ClickOption
func WithClickContact(contact int) ClickOption
func WithClickTarget(target Target) ClickOption
func WithClickTargetOffset(offset Rect) ClickOption
type ColorMatchOption
func WithColorMatchConnected(connected bool) ColorMatchOption
func WithColorMatchCount(count int) ColorMatchOption
func WithColorMatchIndex(index int) ColorMatchOption
func WithColorMatchMethod(method NodeColorMatchMethod) ColorMatchOption
func WithColorMatchOrderBy(orderBy NodeColorMatchOrderBy) ColorMatchOption
func WithColorMatchROI(roi Target) ColorMatchOption
func WithColorMatchROIOffset(offset Rect) ColorMatchOption
type CommandOption
func WithCommandArgs(args []string) CommandOption
func WithCommandDetach(detach bool) CommandOption
type Context
func (ctx *Context) ClearHitCount(nodeName string) bool
func (ctx *Context) Clone() *Context
func (ctx *Context) GetAnchor(anchorName string) (string, bool)
func (ctx *Context) GetHitCount(nodeName string) (uint64, bool)
func (ctx *Context) GetNodeData(name string) (*Node, error)
func (ctx *Context) GetNodeJSON(name string) (string, bool)
func (ctx *Context) GetTaskJob() *TaskJob
func (ctx *Context) GetTasker() *Tasker
func (ctx *Context) OverrideImage(imageName string, image image.Image) bool
func (ctx *Context) OverrideNext(name string, nextList []string) bool
func (ctx *Context) OverridePipeline(override any) bool
func (ctx *Context) RunAction(entry string, box Rect, recognitionDetail string, override ...any) *ActionDetail
func (ctx *Context) RunRecognition(entry string, img image.Image, override ...any) *RecognitionDetail
func (ctx *Context) RunTask(entry string, override ...any) *TaskDetail
func (ctx *Context) SetAnchor(anchorName, nodeName string) bool
type ContextEventSink
type ContextEventSinkAdapter
func (a *ContextEventSinkAdapter) OnNodeAction(ctx *Context, status EventStatus, detail NodeActionDetail)
func (a *ContextEventSinkAdapter) OnNodeActionNode(ctx *Context, status EventStatus, detail NodeActionNodeDetail)
func (a *ContextEventSinkAdapter) OnNodeNextList(ctx *Context, status EventStatus, detail NodeNextListDetail)
func (a *ContextEventSinkAdapter) OnNodePipelineNode(ctx *Context, status EventStatus, detail NodePipelineNodeDetail)
func (a *ContextEventSinkAdapter) OnNodeRecognition(ctx *Context, status EventStatus, detail NodeRecognitionDetail)
func (a *ContextEventSinkAdapter) OnNodeRecognitionNode(ctx *Context, status EventStatus, detail NodeRecognitionNodeDetail)
type Controller
func NewAdbController(adbPath, address string, screencapMethod adb.ScreencapMethod, ...) *Controller
func NewBlankController() *Controller
func NewCarouselImageController(path string) *Controller
func NewCustomController(ctrl CustomController) *Controller
func NewGamepadController(hWnd unsafe.Pointer, gamepadType GamepadType, ...) *Controller
func NewPlayCoverController(address, uuid string) *Controller
func NewWin32Controller(hWnd unsafe.Pointer, screencapMethod win32.ScreencapMethod, ...) *Controller
func (c *Controller) AddSink(sink ControllerEventSink) int64
func (c *Controller) CacheImage() image.Image
func (c *Controller) ClearSinks()
func (c *Controller) Connected() bool
func (c *Controller) Destroy()
func (c *Controller) GetResolution() (width, height int32, ok bool)
func (c *Controller) GetShellOutput() (string, bool)
func (c *Controller) GetUUID() (string, bool)
func (c *Controller) OnControllerAction(fn func(EventStatus, ControllerActionDetail)) int64
func (c *Controller) PostClick(x, y int32) *Job
func (c *Controller) PostClickKey(keycode int32) *Job
func (c *Controller) PostClickV2(x, y, contact, pressure int32) *Job
func (c *Controller) PostConnect() *Job
func (c *Controller) PostInputText(text string) *Job
func (c *Controller) PostKeyDown(keycode int32) *Job
func (c *Controller) PostKeyUp(keycode int32) *Job
func (c *Controller) PostScreencap() *Job
func (c *Controller) PostScroll(dx, dy int32) *Job
func (c *Controller) PostShell(cmd string, timeout time.Duration) *Job
func (c *Controller) PostStartApp(intent string) *Job
func (c *Controller) PostStopApp(intent string) *Job
func (c *Controller) PostSwipe(x1, y1, x2, y2 int32, duration time.Duration) *Job
func (c *Controller) PostSwipeV2(x1, y1, x2, y2 int32, duration time.Duration, contact, pressure int32) *Job
func (c *Controller) PostTouchDown(contact, x, y, pressure int32) *Job
func (c *Controller) PostTouchMove(contact, x, y, pressure int32) *Job
func (c *Controller) PostTouchUp(contact int32) *Job
func (c *Controller) RemoveSink(sinkId int64)
func (c *Controller) SetScreenshotTargetLongSide(targetLongSide int32) bool
func (c *Controller) SetScreenshotTargetShortSide(targetShortSide int32) bool
func (c *Controller) SetScreenshotUseRawSize(enabled bool) bool
type ControllerActionDetail
type ControllerEventSink
type ControllerEventSinkAdapter
func (a *ControllerEventSinkAdapter) OnControllerAction(ctrl *Controller, status EventStatus, detail ControllerActionDetail)
type ControllerFeature
type CustomActiondeprecated
type CustomActionArg
type CustomActionOption
func WithCustomActionParam(customParam any) CustomActionOption
func WithCustomActionTarget(target Target) CustomActionOption
func WithCustomActionTargetOffset(offset Rect) CustomActionOption
type CustomActionRunner
type CustomController
type CustomRecognitiondeprecated
type CustomRecognitionArg
type CustomRecognitionOption
func WithCustomRecognitionParam(customParam any) CustomRecognitionOption
func WithCustomRecognitionROI(roi Target) CustomRecognitionOption
func WithCustomRecognitionROIOffset(offset Rect) CustomRecognitionOption
type CustomRecognitionResult
type CustomRecognitionRunner
type DesktopWindow
func FindDesktopWindows() []*DesktopWindow
type EventStatus
type FeatureMatchOption
func WithFeatureMatchCount(count int) FeatureMatchOption
func WithFeatureMatchDetector(detector NodeFeatureMatchDetector) FeatureMatchOption
func WithFeatureMatchGreenMask(greenMask bool) FeatureMatchOption
func WithFeatureMatchIndex(index int) FeatureMatchOption
func WithFeatureMatchOrderBy(orderBy NodeFeatureMatchOrderBy) FeatureMatchOption
func WithFeatureMatchROI(roi Target) FeatureMatchOption
func WithFeatureMatchROIOffset(offset Rect) FeatureMatchOption
func WithFeatureMatchRatio(ratio float64) FeatureMatchOption
type GamepadType
type InitConfig
type InitOption
func WithDebugMode(enabled bool) InitOption
func WithLibDir(libDir string) InitOption
func WithLogDir(logDir string) InitOption
func WithPluginPaths(path ...string) InitOption
func WithSaveDraw(enabled bool) InitOption
func WithStdoutLevel(level LoggingLevel) InitOption
type InterenceDevice
type Job
func (j *Job) Done() bool
func (j *Job) Failure() bool
func (j *Job) Invalid() bool
func (j *Job) Pending() bool
func (j *Job) Running() bool
func (j *Job) Status() Status
func (j *Job) Success() bool
func (j *Job) Wait() *Job
type LoggingLevel
type LongPressKeyOption
func WithLongPressKeyDuration(d time.Duration) LongPressKeyOption
type LongPressOption
func WithLongPressContact(contact int) LongPressOption
func WithLongPressDuration(d time.Duration) LongPressOption
func WithLongPressTarget(target Target) LongPressOption
func WithLongPressTargetOffset(offset Rect) LongPressOption
type MaaCustomControllerCallbacks
type MultiSwipeItemOption
func WithMultiSwipeItemBegin(begin Target) MultiSwipeItemOption
func WithMultiSwipeItemBeginOffset(offset Rect) MultiSwipeItemOption
func WithMultiSwipeItemContact(contact int) MultiSwipeItemOption
func WithMultiSwipeItemDuration(d []time.Duration) MultiSwipeItemOption
func WithMultiSwipeItemEnd(end []Target) MultiSwipeItemOption
func WithMultiSwipeItemEndHold(d []time.Duration) MultiSwipeItemOption
func WithMultiSwipeItemEndOffset(offset []Rect) MultiSwipeItemOption
func WithMultiSwipeItemOnlyHover(only bool) MultiSwipeItemOption
func WithMultiSwipeItemStarting(starting time.Duration) MultiSwipeItemOption
type NeuralClassifyOption
func WithNeuralClassifyExpected(expected []int) NeuralClassifyOption
func WithNeuralClassifyIndex(index int) NeuralClassifyOption
func WithNeuralClassifyLabels(labels []string) NeuralClassifyOption
func WithNeuralClassifyOrderBy(orderBy NodeNeuralNetworkClassifyOrderBy) NeuralClassifyOption
func WithNeuralClassifyROI(roi Target) NeuralClassifyOption
func WithNeuralClassifyROIOffset(offset Rect) NeuralClassifyOption
type NeuralDetectOption
func WithNeuralDetectExpected(expected []int) NeuralDetectOption
func WithNeuralDetectIndex(index int) NeuralDetectOption
func WithNeuralDetectLabels(labels []string) NeuralDetectOption
func WithNeuralDetectOrderBy(orderBy NodeNeuralNetworkDetectOrderBy) NeuralDetectOption
func WithNeuralDetectROI(roi Target) NeuralDetectOption
func WithNeuralDetectROIOffset(offset Rect) NeuralDetectOption
type Node
func NewNode(name string, opts ...NodeOption) *Node
func (n *Node) AddAnchor(anchor string) *Node
func (n *Node) AddNext(name string, opts ...NodeAttributeOption) *Node
func (n *Node) AddOnError(name string, opts ...NodeAttributeOption) *Node
func (n *Node) RemoveAnchor(anchor string) *Node
func (n *Node) RemoveNext(name string) *Node
func (n *Node) RemoveOnError(name string) *Node
func (n *Node) SetAction(act *NodeAction) *Node
func (n *Node) SetAnchor(anchor []string) *Node
func (n *Node) SetAttach(attach map[string]any) *Node
func (n *Node) SetEnabled(enabled bool) *Node
func (n *Node) SetFocus(focus any) *Node
func (n *Node) SetInverse(inverse bool) *Node
func (n *Node) SetMaxHit(maxHit uint64) *Node
func (n *Node) SetNext(next []NodeNextItem) *Node
func (n *Node) SetOnError(onError []NodeNextItem) *Node
func (n *Node) SetPostDelay(postDelay time.Duration) *Node
func (n *Node) SetPostWaitFreezes(postWaitFreezes *NodeWaitFreezes) *Node
func (n *Node) SetPreDelay(preDelay time.Duration) *Node
func (n *Node) SetPreWaitFreezes(preWaitFreezes *NodeWaitFreezes) *Node
func (n *Node) SetRateLimit(rateLimit time.Duration) *Node
func (n *Node) SetRecognition(rec *NodeRecognition) *Node
func (n *Node) SetRepeat(repeat uint64) *Node
func (n *Node) SetRepeatDelay(repeatDelay time.Duration) *Node
func (n *Node) SetRepeatWaitFreezes(repeatWaitFreezes *NodeWaitFreezes) *Node
func (n *Node) SetTimeout(timeout time.Duration) *Node
type NodeAction
func ActClick(opts ...ClickOption) *NodeAction
func ActClickKey(keys []int) *NodeAction
func ActCommand(exec string, opts ...CommandOption) *NodeAction
func ActCustom(name string, opts ...CustomActionOption) *NodeAction
func ActDoNothing() *NodeAction
func ActInputText(input string) *NodeAction
func ActKeyDown(key int) *NodeAction
func ActKeyUp(key int) *NodeAction
func ActLongPress(opts ...LongPressOption) *NodeAction
func ActLongPressKey(key []int, opts ...LongPressKeyOption) *NodeAction
func ActMultiSwipe(swipes ...NodeMultiSwipeItem) *NodeAction
func ActScroll(opts ...ScrollOption) *NodeAction
func ActShell(cmd string) *NodeAction
func ActStartApp(pkg string) *NodeAction
func ActStopApp(pkg string) *NodeAction
func ActStopTask() *NodeAction
func ActSwipe(opts ...SwipeOption) *NodeAction
func ActTouchDown(opts ...TouchDownOption) *NodeAction
func ActTouchMove(opts ...TouchMoveOption) *NodeAction
func ActTouchUp(opts ...TouchUpOption) *NodeAction
func (na *NodeAction) UnmarshalJSON(data []byte) error
type NodeActionDetail
type NodeActionNodeDetail
type NodeActionParam
type NodeActionType
type NodeAndRecognitionItem
func AndItem(subName string, recognition *NodeRecognition) NodeAndRecognitionItem
type NodeAndRecognitionParam
type NodeAttributeOption
func WithAnchor() NodeAttributeOption
func WithJumpBack() NodeAttributeOption
type NodeClickKeyParam
type NodeClickParam
type NodeColorMatchMethod
type NodeColorMatchOrderBy
type NodeColorMatchParam
type NodeCommandParam
type NodeCustomActionParam
type NodeCustomRecognitionParam
type NodeDetail
type NodeDirectHitParam
type NodeDoNothingParam
type NodeFeatureMatchDetector
type NodeFeatureMatchOrderBy
type NodeFeatureMatchParam
type NodeInputTextParam
type NodeKeyDownParam
type NodeKeyUpParam
type NodeLongPressKeyParam
type NodeLongPressParam
type NodeMultiSwipeItem
func NewMultiSwipeItem(opts ...MultiSwipeItemOption) NodeMultiSwipeItem
type NodeMultiSwipeParam
type NodeNeuralNetworkClassifyOrderBy
type NodeNeuralNetworkClassifyParam
type NodeNeuralNetworkDetectOrderBy
type NodeNeuralNetworkDetectParam
type NodeNextItem
type NodeNextListDetail
type NodeOCROrderBy
type NodeOCRParam
type NodeOption
func WithAction(act *NodeAction) NodeOption
func WithAttach(attach map[string]any) NodeOption
func WithEnabled(enabled bool) NodeOption
func WithFocus(focus any) NodeOption
func WithInverse(inverse bool) NodeOption
func WithMaxHit(maxHit uint64) NodeOption
func WithNext(next []NodeNextItem) NodeOption
func WithOnError(onError []NodeNextItem) NodeOption
func WithPostDelay(postDelay time.Duration) NodeOption
func WithPostWaitFreezes(waitFreezes *NodeWaitFreezes) NodeOption
func WithPreDelay(preDelay time.Duration) NodeOption
func WithPreWaitFreezes(waitFreezes *NodeWaitFreezes) NodeOption
func WithRateLimit(rateLimit time.Duration) NodeOption
func WithRecognition(rec *NodeRecognition) NodeOption
func WithRepeat(repeat uint64) NodeOption
func WithRepeatDelay(repeatDelay time.Duration) NodeOption
func WithRepeatWaitFreezes(waitFreezes *NodeWaitFreezes) NodeOption
func WithTimeout(timeout time.Duration) NodeOption
type NodeOrRecognitionParam
type NodePipelineNodeDetail
type NodeRecognition
func RecAnd(allOf []NodeAndRecognitionItem, opts ...AndRecognitionOption) *NodeRecognition
func RecColorMatch(lower, upper [][]int, opts ...ColorMatchOption) *NodeRecognition
func RecCustom(name string, opts ...CustomRecognitionOption) *NodeRecognition
func RecDirectHit() *NodeRecognition
func RecFeatureMatch(template []string, opts ...FeatureMatchOption) *NodeRecognition
func RecNeuralNetworkClassify(model string, opts ...NeuralClassifyOption) *NodeRecognition
func RecNeuralNetworkDetect(model string, opts ...NeuralDetectOption) *NodeRecognition
func RecOCR(opts ...OCROption) *NodeRecognition
func RecOr(anyOf []*NodeRecognition) *NodeRecognition
func RecTemplateMatch(template []string, opts ...TemplateMatchOption) *NodeRecognition
func (nr *NodeRecognition) UnmarshalJSON(data []byte) error
type NodeRecognitionDetail
type NodeRecognitionNodeDetail
type NodeRecognitionParam
type NodeRecognitionType
type NodeScrollParam
type NodeShellParam
type NodeStartAppParam
type NodeStopAppParam
type NodeStopTaskParam
type NodeSwipeParam
type NodeTemplateMatchMethod
type NodeTemplateMatchOrderBy
type NodeTemplateMatchParam
type NodeTouchDownParam
type NodeTouchMoveParam
type NodeTouchUpParam
type NodeWaitFreezes
func WaitFreezes(opts ...WaitFreezesOption) *NodeWaitFreezes
type OCROption
func WithOCRExpected(expected []string) OCROption
func WithOCRIndex(index int) OCROption
func WithOCRModel(model string) OCROption
func WithOCROnlyRec(only bool) OCROption
func WithOCROrderBy(orderBy NodeOCROrderBy) OCROption
func WithOCRROI(roi Target) OCROption
func WithOCRROIOffset(offset Rect) OCROption
func WithOCRReplace(replace [][2]string) OCROption
func WithOCRThreshold(th float64) OCROption
type Pipeline
func NewPipeline() *Pipeline
func (p *Pipeline) AddNode(node *Node) *Pipeline
func (p *Pipeline) MarshalJSON() ([]byte, error)
type RecognitionDetail
type Rect
type Resource
func NewResource() *Resource
func (r *Resource) AddSink(sink ResourceEventSink) int64
func (r *Resource) Clear() bool
func (r *Resource) ClearCustomAction() bool
func (r *Resource) ClearCustomRecognition() bool
func (r *Resource) ClearSinks()
func (r *Resource) Destroy()
func (r *Resource) GetCustomActionList() ([]string, bool)
func (r *Resource) GetCustomRecognitionList() ([]string, bool)
func (r *Resource) GetHash() (string, bool)
func (r *Resource) GetNodeJSON(name string) (string, bool)
func (r *Resource) GetNodeList() ([]string, bool)
func (r *Resource) Loaded() bool
func (r *Resource) OnResourceLoading(fn func(EventStatus, ResourceLoadingDetail)) int64
func (r *Resource) OverrideNext(name string, nextList []string) bool
func (r *Resource) OverridePipeline(override any) bool
func (r *Resource) OverriderImage(imageName string, image image.Image) bool
func (r *Resource) PostBundle(path string) *Job
func (r *Resource) PostImage(path string) *Job
func (r *Resource) PostOcrModel(path string) *Job
func (r *Resource) PostPipeline(path string) *Job
func (r *Resource) RegisterCustomAction(name string, action CustomActionRunner) bool
func (r *Resource) RegisterCustomRecognition(name string, recognition CustomRecognitionRunner) bool
func (r *Resource) RemoveSink(sinkId int64)
func (r *Resource) UnregisterCustomAction(name string) bool
func (r *Resource) UnregisterCustomRecognition(name string) bool
func (r *Resource) UseAutoExecutionProvider() bool
func (r *Resource) UseCPU() bool
func (r *Resource) UseCoreml(coremlFlag InterenceDevice) bool
func (r *Resource) UseDirectml(deviceID InterenceDevice) bool
type ResourceEventSink
type ResourceEventSinkAdapter
func (a *ResourceEventSinkAdapter) OnResourceLoading(res *Resource, status EventStatus, detail ResourceLoadingDetail)
type ResourceLoadingDetail
type ScrollOption
func WithScrollDx(dx int) ScrollOption
func WithScrollDy(dy int) ScrollOption
type Status
func (s Status) Done() bool
func (s Status) Failure() bool
func (s Status) Invalid() bool
func (s Status) Pending() bool
func (s Status) Running() bool
func (s Status) String() string
func (s Status) Success() bool
type SwipeOption
func WithSwipeBegin(begin Target) SwipeOption
func WithSwipeBeginOffset(offset Rect) SwipeOption
func WithSwipeContact(contact int) SwipeOption
func WithSwipeDuration(d []time.Duration) SwipeOption
func WithSwipeEnd(end []Target) SwipeOption
func WithSwipeEndHold(d []time.Duration) SwipeOption
func WithSwipeEndOffset(offset []Rect) SwipeOption
func WithSwipeOnlyHover(only bool) SwipeOption
type Target
func NewTargetBool(val bool) Target
func NewTargetRect(val Rect) Target
func NewTargetString(val string) Target
type TaskDetail
type TaskJob
func (j *TaskJob) GetDetail() *TaskDetail
func (j *TaskJob) Wait() *TaskJob
type Tasker
func NewTasker() *Tasker
func (t *Tasker) AddContextSink(sink ContextEventSink) int64
func (t *Tasker) AddSink(sink TaskerEventSink) int64
func (t *Tasker) BindController(ctrl *Controller) bool
func (t *Tasker) BindResource(res *Resource) bool
func (t *Tasker) ClearCache() bool
func (t *Tasker) ClearContextSinks()
func (t *Tasker) ClearSinks()
func (t *Tasker) Destroy()
func (t *Tasker) GetController() *Controller
func (t *Tasker) GetLatestNode(taskName string) *NodeDetail
func (t *Tasker) GetResource() *Resource
func (t *Tasker) Initialized() bool
func (t *Tasker) OnNodeActionInContext(fn func(*Context, EventStatus, NodeActionDetail)) int64
func (t *Tasker) OnNodeActionNodeInContext(fn func(*Context, EventStatus, NodeActionNodeDetail)) int64
func (t *Tasker) OnNodeNextListInContext(fn func(*Context, EventStatus, NodeNextListDetail)) int64
func (t *Tasker) OnNodePipelineNodeInContext(fn func(*Context, EventStatus, NodePipelineNodeDetail)) int64
func (t *Tasker) OnNodeRecognitionInContext(fn func(*Context, EventStatus, NodeRecognitionDetail)) int64
func (t *Tasker) OnNodeRecognitionNodeInContext(fn func(*Context, EventStatus, NodeRecognitionNodeDetail)) int64
func (t *Tasker) OnTaskerTask(fn func(EventStatus, TaskerTaskDetail)) int64
func (t *Tasker) PostAction(actionType NodeActionType, actionParam NodeActionParam, box Rect, ...) *TaskJob
func (t *Tasker) PostRecognition(recType NodeRecognitionType, recParam NodeRecognitionParam, img image.Image) *TaskJob
func (t *Tasker) PostStop() *TaskJob
func (t *Tasker) PostTask(entry string, override ...any) *TaskJob
func (t *Tasker) RemoveContextSink(sinkId int64)
func (t *Tasker) RemoveSink(sinkId int64)
func (t *Tasker) Running() bool
func (t *Tasker) Stopping() bool
type TaskerEventSink
type TaskerEventSinkAdapter
func (a *TaskerEventSinkAdapter) OnTaskerTask(tasker \*Tasker, status EventStatus, detail TaskerTaskDetail)
type TaskerTaskDetail
type TemplateMatchOption
func WithTemplateMatchGreenMask(greenMask bool) TemplateMatchOption
func WithTemplateMatchIndex(index int) TemplateMatchOption
func WithTemplateMatchMethod(method NodeTemplateMatchMethod) TemplateMatchOption
func WithTemplateMatchOrderBy(orderBy NodeTemplateMatchOrderBy) TemplateMatchOption
func WithTemplateMatchROI(roi Target) TemplateMatchOption
func WithTemplateMatchROIOffset(offset Rect) TemplateMatchOption
func WithTemplateMatchThreshold(threshold []float64) TemplateMatchOption
type TouchDownOption
func WithTouchDownContact(contact int) TouchDownOption
func WithTouchDownPressure(pressure int) TouchDownOption
func WithTouchDownTarget(target Target) TouchDownOption
func WithTouchDownTargetOffset(offset Rect) TouchDownOption
type TouchMoveOption
func WithTouchMoveContact(contact int) TouchMoveOption
func WithTouchMovePressure(pressure int) TouchMoveOption
func WithTouchMoveTarget(target Target) TouchMoveOption
func WithTouchMoveTargetOffset(offset Rect) TouchMoveOption
type TouchUpOption
func WithTouchUpContact(contact int) TouchUpOption
type WaitFreezesOption
func WithWaitFreezesMethod(m int) WaitFreezesOption
func WithWaitFreezesRateLimit(d time.Duration) WaitFreezesOption
func WithWaitFreezesTarget(target Target) WaitFreezesOption
func WithWaitFreezesTargetOffset(offset Rect) WaitFreezesOption
func WithWaitFreezesThreshold(th float64) WaitFreezesOption
func WithWaitFreezesTime(d time.Duration) WaitFreezesOption
func WithWaitFreezesTimeout(d time.Duration) WaitFreezesOption
Constants
View Source
const (
InterenceDeviceAuto int32 = -1
InferenceDevice0 int32 = 0
InferenceDevice1 int32 = 1
)
Variables
View Source
var (
ErrAlreadyInitialized = errors.New("maa framework already initialized")
ErrNotInitialized = errors.New("maa framework not initialized")
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
AgentServerDetach detaches the service thread to run independently

func AgentServerJoin
func AgentServerJoin()
AgentServerJoin waits synchronously for the service thread to finish

func AgentServerRegisterCustomAction
func AgentServerRegisterCustomAction(name string, action CustomActionRunner) bool
AgentServerRegisterCustomAction registers a custom action runner with the given name.

func AgentServerRegisterCustomRecognition
func AgentServerRegisterCustomRecognition(name string, recognition CustomRecognitionRunner) bool
AgentServerRegisterCustomRecognition registers a custom recognition runner with the given name.

func AgentServerShutDown
func AgentServerShutDown()
AgentServerShutDown shuts down the MAA Agent Server.

func AgentServerStartUp
func AgentServerStartUp(identifier string) bool
AgentServerStartUp starts the MAA Agent Server with the given identifier.

func ConfigInitOption
func ConfigInitOption(userPath, defaultJson string) bool
ConfigInitOption inits the toolkit config option.

func Init
func Init(opts ...InitOption) error
Init loads the dynamic library related to the MAA framework and registers its related functions. It must be called before invoking any other MAA-related functions. Note: If this function is not called before other MAA functions, it will trigger a null pointer panic.

func IsInited
func IsInited() bool
IsInited checks if the MAA framework has been initialized.

func LoadPlugin
func LoadPlugin(path string) bool
LoadPlugin loads a plugin specified by path. The path may be a full filesystem path or just a plugin name. When only a name is provided, the function searches system directories and the current working directory for a matching plugin. If the path refers to a directory, plugins inside that directory are searched recursively.

func Release
func Release() error
Release releases the dynamic library resources of the MAA framework and unregisters its related functions. It must be called only after the framework has been initialized via Init.

func SetDebugMode
func SetDebugMode(enabled bool) bool
SetDebugMode sets whether to enable debug mode.

func SetDrawQuality
added in v3.5.0
func SetDrawQuality(quality int32) bool
SetDrawQuality sets image quality for draw images. Default value is 85, range: [0, 100].

func SetLogDir
func SetLogDir(path string) bool
SetLogDir sets the log directory.

func SetRecoImageCacheLimit
added in v3.5.0
func SetRecoImageCacheLimit(limit uint64) bool
SetRecoImageCacheLimit sets recognition image cache limit. Default value is 4096.

func SetSaveDraw
func SetSaveDraw(enabled bool) bool
SetSaveDraw sets whether to save draw.

func SetSaveOnError
added in v3.5.0
func SetSaveOnError(enabled bool) bool
SetSaveOnError sets whether to save screenshot on error.

func SetStdoutLevel
func SetStdoutLevel(level LoggingLevel) bool
SetStdoutLevel sets the level of log output to stdout.

func Version
func Version() string
Version returns the version of the maa framework.

Types
type ActionDetail
type ActionDetail struct {
ID int64
Name string
Action string
Box Rect
Success bool
DetailJson string
}
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
func FindAdbDevices(specifiedAdb ...string) []\*AdbDevice
FindAdbDevices finds adb devices.

type AgentClient
type AgentClient struct {
// contains filtered or unexported fields
}
func NewAgentClient
func NewAgentClient(identifier string) \*AgentClient
NewAgentClient creates an Agent client instance If identifier is empty, it will be automatically generated

func (*AgentClient) Alive
func (ac *AgentClient) Alive() bool
Alive checks if the Agent server is still responsive

func (*AgentClient) BindResource
func (ac *AgentClient) BindResource(res \*Resource) bool
BindResource links the Agent client to the specified resource

func (*AgentClient) Connect
func (ac *AgentClient) Connect() bool
Connect connects to the Agent server

func (*AgentClient) Connected
func (ac *AgentClient) Connected() bool
Connected checks if the client is connected to the Agent server

func (*AgentClient) Destroy
func (ac *AgentClient) Destroy()
Destroy releases underlying resources

func (*AgentClient) Disconnect
func (ac *AgentClient) Disconnect() bool
Disconnect disconnects from the Agent server

func (*AgentClient) GetCustomActionList
func (ac *AgentClient) GetCustomActionList() ([]string, bool)
GetCustomActionList returns the custom action name list of the agent client

func (*AgentClient) GetCustomRecognitionList
func (ac *AgentClient) GetCustomRecognitionList() ([]string, bool)
GetCustomRecognitionList returns the custom recognition name list of the agent client

func (*AgentClient) Identifier
func (ac *AgentClient) Identifier() (string, bool)
Identifier returns the identifier of the current agent client

func (*AgentClient) RegisterControllerSink
func (ac *AgentClient) RegisterControllerSink(ctrl Controller) bool
RegisterControllerSink registers controller events to controller

func (*AgentClient) RegisterResourceSink
func (ac *AgentClient) RegisterResourceSink(res \*Resource) bool
RegisterResourceSink registers resource events to resource

func (*AgentClient) RegisterTaskerSink
func (ac *AgentClient) RegisterTaskerSink(tasker Tasker) bool
RegisterTaskerSink registers tasker events to tasker

func (*AgentClient) SetTimeout
func (ac *AgentClient) SetTimeout(duration time.Duration) bool
SetTimeout sets the timeout duration for the Agent server

type AndRecognitionOption
added in v3.4.0
type AndRecognitionOption func(\*NodeAndRecognitionParam)
AndRecognitionOption is a functional option for configuring NodeAndRecognitionParam.

func WithAndRecognitionBoxIndex
added in v3.4.0
func WithAndRecognitionBoxIndex(boxIndex int) AndRecognitionOption
WithAndRecognitionBoxIndex sets which recognition result's box to use as the final box.

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
added in v3.5.0
func (c *BlankController) Connected() bool
Connected implements CustomController.

func (*BlankController) GetFeature
func (c *BlankController) GetFeature() ControllerFeature
GetFeature implements CustomController.

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
added in v3.5.0
func (c *CarouselImageController) Connected() bool
Connected implements CustomController.

func (*CarouselImageController) GetFeature
func (c *CarouselImageController) GetFeature() ControllerFeature
GetFeature implements CustomController.

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

type ClickOption
type ClickOption func(\*NodeClickParam)
ClickOption is a functional option for configuring NodeClickParam.

func WithClickContact
func WithClickContact(contact int) ClickOption
WithClickContact sets the touch point identifier.

func WithClickTarget
func WithClickTarget(target Target) ClickOption
WithClickTarget sets the click target position.

func WithClickTargetOffset
func WithClickTargetOffset(offset Rect) ClickOption
WithClickTargetOffset sets additional offset applied to target.

type ColorMatchOption
type ColorMatchOption func(\*NodeColorMatchParam)
ColorMatchOption is a functional option for configuring NodeColorMatchParam.

func WithColorMatchConnected
func WithColorMatchConnected(connected bool) ColorMatchOption
WithColorMatchConnected enables connected component analysis.

func WithColorMatchCount
func WithColorMatchCount(count int) ColorMatchOption
WithColorMatchCount sets the minimum pixel count required (threshold).

func WithColorMatchIndex
func WithColorMatchIndex(index int) ColorMatchOption
WithColorMatchIndex sets which match to select from results.

func WithColorMatchMethod
func WithColorMatchMethod(method NodeColorMatchMethod) ColorMatchOption
WithColorMatchMethod sets the color space for matching.

func WithColorMatchOrderBy
func WithColorMatchOrderBy(orderBy NodeColorMatchOrderBy) ColorMatchOption
WithColorMatchOrderBy sets the result ordering method.

func WithColorMatchROI
func WithColorMatchROI(roi Target) ColorMatchOption
WithColorMatchROI sets the region of interest for color matching.

func WithColorMatchROIOffset
func WithColorMatchROIOffset(offset Rect) ColorMatchOption
WithColorMatchROIOffset sets the offset applied to ROI.

type CommandOption
type CommandOption func(\*NodeCommandParam)
CommandOption is a functional option for configuring NodeCommandParam.

func WithCommandArgs
func WithCommandArgs(args []string) CommandOption
WithCommandArgs sets the command arguments.

func WithCommandDetach
func WithCommandDetach(detach bool) CommandOption
WithCommandDetach enables detached mode to run without waiting for completion.

type Context
type Context struct {
// contains filtered or unexported fields
}
func (*Context) ClearHitCount
func (ctx *Context) ClearHitCount(nodeName string) bool
ClearHitCount clears the hit count of a node by name.

func (*Context) Clone
func (ctx *Context) Clone() \*Context
Clone clones current Context.

func (*Context) GetAnchor
func (ctx *Context) GetAnchor(anchorName string) (string, bool)
GetAnchor gets an anchor by name.

func (*Context) GetHitCount
func (ctx *Context) GetHitCount(nodeName string) (uint64, bool)
GetHitCount gets the hit count of a node by name.

func (*Context) GetNodeData
func (ctx *Context) GetNodeData(name string) (*Node, error)
func (*Context) GetNodeJSON
func (ctx \*Context) GetNodeJSON(name string) (string, bool)
GetNodeJSON gets the node JSON by name.

func (*Context) GetTaskJob
func (ctx *Context) GetTaskJob() \*TaskJob
GetTaskJob returns current task job.

func (*Context) GetTasker
func (ctx *Context) GetTasker() \*Tasker
GetTasker return current Tasker.

func (*Context) OverrideImage
func (ctx *Context) OverrideImage(imageName string, image image.Image) bool
func (*Context) OverrideNext
func (ctx *Context) OverrideNext(name string, nextList []string) bool
OverrideNext overrides the next list of task by name.

func (*Context) OverridePipeline
func (ctx *Context) OverridePipeline(override any) bool
OverridePipeline overrides pipeline. The `override` parameter can be a JSON string or any data type that can be marshaled to JSON.

func (*Context) RunAction
func (ctx *Context) RunAction(entry string, box Rect, recognitionDetail string, override ...any) \*ActionDetail
RunAction run an action and return its detail. It accepts an entry string and an optional override parameter which can be a JSON string or any data type that can be marshaled to JSON. If multiple overrides are provided, only the first one will be used.

Example 1:

ctx.RunAction("Task", `{"Task":{"action":"Click","target":[100, 200, 100, 100]}}`)
Example 2:

ctx.RunAction("Task", map[string]interface{}{
"Task": map[string]interface{}{
"action": "Click",
"target": []int{100, 200, 100, 100},
}
})
func (*Context) RunRecognition
func (ctx *Context) RunRecognition(entry string, img image.Image, override ...any) \*RecognitionDetail
RunRecognition run a recognition and return its detail. It accepts an entry string and an optional override parameter which can be a JSON string or any data type that can be marshaled to JSON. If multiple overrides are provided, only the first one will be used.

Example 1:

ctx.RunRecognition("Task", `{"Task":{"recognition":"OCR","expected":"Hello"}}`)
Example 2:

ctx.RunRecognition("Task", map[string]interface{}{
"Task": map[string]interface{}{
"recognition": "OCR",
"expected": "Hello",
}
})
func (*Context) RunTask
func (ctx *Context) RunTask(entry string, override ...any) \*TaskDetail
RunTask runs a task and returns its detail. It accepts an entry string and an optional override parameter which can be a JSON string or any data type that can be marshaled to JSON. If multiple overrides are provided, only the first one will be used.

Example 1:

ctx.RunTask("Task", `{"Task":{"action":"Click","target":[100, 200, 100, 100]}}`)
Example 2:

ctx.RunTask("Task", map[string]interface{}{
"Task": map[string]interface{}{
"action": "Click",
"target": []int{100, 200, 100, 100},
}
})
func (*Context) SetAnchor
func (ctx *Context) SetAnchor(anchorName, nodeName string) bool
SetAnchor sets an anchor by name.

type ContextEventSink
type ContextEventSink interface {
OnNodePipelineNode(ctx *Context, event EventStatus, detail NodePipelineNodeDetail)
OnNodeRecognitionNode(ctx *Context, event EventStatus, detail NodeRecognitionNodeDetail)
OnNodeActionNode(ctx *Context, event EventStatus, detail NodeActionNodeDetail)
OnNodeNextList(ctx *Context, event EventStatus, detail NodeNextListDetail)
OnNodeRecognition(ctx *Context, event EventStatus, detail NodeRecognitionDetail)
OnNodeAction(ctx *Context, event EventStatus, detail NodeActionDetail)
}
type ContextEventSinkAdapter
type ContextEventSinkAdapter struct {
// contains filtered or unexported fields
}
ContextEventSinkAdapter is a lightweight adapter that makes it easy to register a single-event handler via a callback function.

func (*ContextEventSinkAdapter) OnNodeAction
added in v3.3.0
func (a *ContextEventSinkAdapter) OnNodeAction(ctx *Context, status EventStatus, detail NodeActionDetail)
func (*ContextEventSinkAdapter) OnNodeActionNode
func (a *ContextEventSinkAdapter) OnNodeActionNode(ctx *Context, status EventStatus, detail NodeActionNodeDetail)
func (*ContextEventSinkAdapter) OnNodeNextList
added in v3.3.0
func (a *ContextEventSinkAdapter) OnNodeNextList(ctx *Context, status EventStatus, detail NodeNextListDetail)
func (*ContextEventSinkAdapter) OnNodePipelineNode
func (a *ContextEventSinkAdapter) OnNodePipelineNode(ctx *Context, status EventStatus, detail NodePipelineNodeDetail)
func (*ContextEventSinkAdapter) OnNodeRecognition
added in v3.3.0
func (a *ContextEventSinkAdapter) OnNodeRecognition(ctx *Context, status EventStatus, detail NodeRecognitionDetail)
func (*ContextEventSinkAdapter) OnNodeRecognitionNode
func (a *ContextEventSinkAdapter) OnNodeRecognitionNode(ctx *Context, status EventStatus, detail NodeRecognitionNodeDetail)
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
) \*Controller
NewAdbController creates a new ADB controller.

func NewBlankController
func NewBlankController() *Controller
func NewCarouselImageController
func NewCarouselImageController(path string) *Controller
func NewCustomController
func NewCustomController(
ctrl CustomController,
) \*Controller
NewCustomController creates a custom controller instance.

func NewGamepadController
added in v3.5.0
func NewGamepadController(
hWnd unsafe.Pointer,
gamepadType GamepadType,
screencapMethod win32.ScreencapMethod,
) \*Controller
NewGamepadController creates a virtual gamepad controller for Windows.

hWnd: Window handle for screencap (optional, can be nil if screencap not needed). gamepadType: Type of virtual gamepad (Xbox360 or DualShock4). screencapMethod: Win32 screencap method to use. Ignored if hWnd is nil.

Note: Requires ViGEm Bus Driver to be installed on the system. For gamepad button and touch constants, import "github.com/MaaXYZ/maa-framework-go/v3/controller/gamepad".

func NewPlayCoverController
added in v3.4.0
func NewPlayCoverController(
address, uuid string,
) \*Controller
NewPlayCoverController creates a new PlayCover controller.

func NewWin32Controller
func NewWin32Controller(
hWnd unsafe.Pointer,
screencapMethod win32.ScreencapMethod,
mouseMethod win32.InputMethod,
keyboardMethod win32.InputMethod,
) \*Controller
NewWin32Controller creates a win32 controller instance.

func (*Controller) AddSink
func (c *Controller) AddSink(sink ControllerEventSink) int64
AddSink adds a event callback sink and returns the sink ID. The sink ID can be used to remove the sink later.

func (*Controller) CacheImage
func (c *Controller) CacheImage() image.Image
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
added in v3.5.0
func (c *Controller) GetResolution() (width, height int32, ok bool)
GetResolution gets the raw (unscaled) device resolution. Returns the width and height, and whether the resolution is available. Note: This returns the actual device screen resolution before any scaling. The screenshot obtained via CacheImage is scaled according to the screenshot target size settings.

func (*Controller) GetShellOutput
added in v3.2.0
func (c *Controller) GetShellOutput() (string, bool)
GetShellOutput gets the output of the last shell command.

func (*Controller) GetUUID
func (c *Controller) GetUUID() (string, bool)
GetUUID gets the UUID of the controller.

func (*Controller) OnControllerAction
func (c *Controller) OnControllerAction(fn func(EventStatus, ControllerActionDetail)) int64
OnControllerAction registers a callback sink that only handles Controller.Action events and returns the sink ID. The sink ID can be used to remove the sink later.

func (*Controller) PostClick
func (c *Controller) PostClick(x, y int32) \*Job
PostClick posts a click.

func (*Controller) PostClickKey
func (c *Controller) PostClickKey(keycode int32) \*Job
PostPressKey posts a click key.

func (*Controller) PostClickV2
added in v3.5.0
func (c *Controller) PostClickV2(x, y, contact, pressure int32) \*Job
PostClickV2 posts a click with contact and pressure. For adb controller, contact means finger id (0 for first finger, 1 for second finger, etc). For win32 controller, contact means mouse button id (0 for left, 1 for right, 2 for middle).

func (*Controller) PostConnect
func (c *Controller) PostConnect() \*Job
PostConnect posts a connection.

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
added in v3.2.0
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
added in v3.5.0
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

func (*Controller) SetScreenshotTargetLongSide
func (c *Controller) SetScreenshotTargetLongSide(targetLongSide int32) bool
SetScreenshotTargetLongSide sets screenshot target long side. Only one of long and short side can be set, and the other is automatically scaled according to the aspect ratio.

eg: 1280

func (*Controller) SetScreenshotTargetShortSide
func (c *Controller) SetScreenshotTargetShortSide(targetShortSide int32) bool
SetScreenshotTargetShortSide sets screenshot target short side. Only one of long and short side can be set, and the other is automatically scaled according to the aspect ratio.

eg: 720

func (*Controller) SetScreenshotUseRawSize
func (c *Controller) SetScreenshotUseRawSize(enabled bool) bool
SetScreenshotUseRawSize sets whether the screenshot uses the raw size without scaling.

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
OnControllerAction(ctrl \*Controller, event EventStatus, detail ControllerActionDetail)
}
type ControllerEventSinkAdapter
type ControllerEventSinkAdapter struct {
// contains filtered or unexported fields
}
ControllerEventSinkAdapter is a lightweight adapter that makes it easy to register a single-event handler via a callback function.

func (*ControllerEventSinkAdapter) OnControllerAction
func (a *ControllerEventSinkAdapter) OnControllerAction(ctrl *Controller, status EventStatus, detail ControllerActionDetail)
type ControllerFeature
type ControllerFeature uint64
const (
ControllerFeatureNone ControllerFeature = 0
ControllerFeatureUseMouseDownAndUpInsteadOfClick ControllerFeature = 1
ControllerFeatureUseKeyboardDownAndUpInsteadOfClick ControllerFeature = 1 << 1
)
type
CustomAction
deprecated
type CustomActionArg
type CustomActionArg struct {
TaskDetail *TaskDetail
CurrentTaskName string
CustomActionName string
CustomActionParam string
RecognitionDetail *RecognitionDetail
Box Rect
}
type CustomActionOption
type CustomActionOption func(*NodeCustomActionParam)
CustomActionOption is a functional option for configuring NodeCustomActionParam.

func WithCustomActionParam
func WithCustomActionParam(customParam any) CustomActionOption
WithCustomActionParam sets custom parameters passed to the action callback.

func WithCustomActionTarget
func WithCustomActionTarget(target Target) CustomActionOption
WithCustomActionTarget sets the action target position.

func WithCustomActionTargetOffset
func WithCustomActionTargetOffset(offset Rect) CustomActionOption
WithCustomActionTargetOffset sets additional offset applied to target.

type CustomActionRunner
added in v3.4.0
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
}
CustomController defines an interface for custom controller. Implementers of this interface must embed a CustomControllerHandler struct and provide implementations for the following methods: Connect, RequestUUID, StartApp, StopApp, Screencap, Click, Swipe, TouchDown, TouchMove, TouchUp, ClickKey, InputText, KeyDown and KeyUp.

type
CustomRecognition
deprecated
type CustomRecognitionArg
type CustomRecognitionArg struct {
TaskDetail *TaskDetail
CurrentTaskName string
CustomRecognitionName string
CustomRecognitionParam string
Img image.Image
Roi Rect
}
type CustomRecognitionOption
type CustomRecognitionOption func(*NodeCustomRecognitionParam)
CustomRecognitionOption is a functional option for configuring NodeCustomRecognitionParam.

func WithCustomRecognitionParam
func WithCustomRecognitionParam(customParam any) CustomRecognitionOption
WithCustomRecognitionParam sets custom parameters passed to the recognition callback.

func WithCustomRecognitionROI
func WithCustomRecognitionROI(roi Target) CustomRecognitionOption
WithCustomRecognitionROI sets the region of interest for custom recognition.

func WithCustomRecognitionROIOffset
func WithCustomRecognitionROIOffset(offset Rect) CustomRecognitionOption
WithCustomRecognitionROIOffset sets the offset applied to ROI.

type CustomRecognitionResult
type CustomRecognitionResult struct {
Box Rect
Detail string
}
type CustomRecognitionRunner
added in v3.4.0
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
func FindDesktopWindows() []\*DesktopWindow
FindDesktopWindows finds desktop windows.

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

type FeatureMatchOption
type FeatureMatchOption func(\*NodeFeatureMatchParam)
FeatureMatchOption is a functional option for configuring NodeFeatureMatchParam.

func WithFeatureMatchCount
func WithFeatureMatchCount(count int) FeatureMatchOption
WithFeatureMatchCount sets the minimum number of feature points required (threshold).

func WithFeatureMatchDetector
func WithFeatureMatchDetector(detector NodeFeatureMatchDetector) FeatureMatchOption
WithFeatureMatchDetector sets the feature detection algorithm.

func WithFeatureMatchGreenMask
func WithFeatureMatchGreenMask(greenMask bool) FeatureMatchOption
WithFeatureMatchGreenMask enables green color masking for transparent areas.

func WithFeatureMatchIndex
func WithFeatureMatchIndex(index int) FeatureMatchOption
WithFeatureMatchIndex sets which match to select from results.

func WithFeatureMatchOrderBy
func WithFeatureMatchOrderBy(orderBy NodeFeatureMatchOrderBy) FeatureMatchOption
WithFeatureMatchOrderBy sets the result ordering method.

func WithFeatureMatchROI
func WithFeatureMatchROI(roi Target) FeatureMatchOption
WithFeatureMatchROI sets the region of interest for feature matching.

func WithFeatureMatchROIOffset
func WithFeatureMatchROIOffset(offset Rect) FeatureMatchOption
WithFeatureMatchROIOffset sets the offset applied to ROI.

func WithFeatureMatchRatio
func WithFeatureMatchRatio(ratio float64) FeatureMatchOption
WithFeatureMatchRatio sets the KNN matching distance ratio threshold.

type GamepadType
added in v3.5.0
type GamepadType = native.MaaGamepadType
GamepadType defines the type of virtual gamepad.

const (
GamepadTypeXbox360 GamepadType = native.MaaGamepadType_Xbox360
GamepadTypeDualShock4 GamepadType = native.MaaGamepadType_DualShock4
)
Gamepad type constants.

type InitConfig
type InitConfig struct {
// LibDir specifies the directory path where MAA dynamic libraries are located.
// If empty, the framework will attempt to locate libraries in default paths.
LibDir string

    // LogDir specifies the directory where log files will be written.
    // Defaults to "./debug" if not specified.
    LogDir string

    // SaveDraw controls whether to save recognition results to LogDir/vision.
    // When enabled, RecoDetail will be able to retrieve draws for debugging purposes.
    SaveDraw bool

    // StdoutLevel sets the logging verbosity level for standard output.
    // Controls which log messages are displayed on the console.
    StdoutLevel LoggingLevel

    // DebugMode enables or disables comprehensive debug mode.
    // When enabled, additional debug information is collected and logged.
    DebugMode bool

    // PluginPaths specifies the paths to the plugins to load.
    // If empty, the framework will not load any plugins.
    PluginPaths []string

}
InitConfig contains configuration options for initializing the MAA framework. It specifies various settings that control the framework's behavior, logging, debugging, and resource locations.

type InitOption
type InitOption func(\*InitConfig)
InitOption defines a function type for configuring InitConfig through functional options. Each InitOption function modifies the InitConfig to set specific initialization parameters.

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

type InterenceDevice
type InterenceDevice = native.MaaInferenceDevice
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

type LongPressKeyOption
type LongPressKeyOption func(\*NodeLongPressKeyParam)
LongPressKeyOption is a functional option for configuring NodeLongPressKeyParam.

func WithLongPressKeyDuration
func WithLongPressKeyDuration(d time.Duration) LongPressKeyOption
WithLongPressKeyDuration sets the long press duration.

type LongPressOption
type LongPressOption func(\*NodeLongPressParam)
LongPressOption is a functional option for configuring NodeLongPressParam.

func WithLongPressContact
func WithLongPressContact(contact int) LongPressOption
WithLongPressContact sets the touch point identifier.

func WithLongPressDuration
func WithLongPressDuration(d time.Duration) LongPressOption
WithLongPressDuration sets the long press duration.

func WithLongPressTarget
func WithLongPressTarget(target Target) LongPressOption
WithLongPressTarget sets the long press target position.

func WithLongPressTargetOffset
func WithLongPressTargetOffset(offset Rect) LongPressOption
WithLongPressTargetOffset sets additional offset applied to target.

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
}
type MultiSwipeItemOption
type MultiSwipeItemOption func(\*NodeMultiSwipeItem)
MultiSwipeItemOption is a functional option for configuring NodeMultiSwipeItem.

func WithMultiSwipeItemBegin
func WithMultiSwipeItemBegin(begin Target) MultiSwipeItemOption
WithMultiSwipeItemBegin sets the swipe start position.

func WithMultiSwipeItemBeginOffset
func WithMultiSwipeItemBeginOffset(offset Rect) MultiSwipeItemOption
WithMultiSwipeItemBeginOffset sets additional offset applied to begin position.

func WithMultiSwipeItemContact
func WithMultiSwipeItemContact(contact int) MultiSwipeItemOption
WithMultiSwipeItemContact sets the touch point identifier.

func WithMultiSwipeItemDuration
func WithMultiSwipeItemDuration(d []time.Duration) MultiSwipeItemOption
WithMultiSwipeItemDuration sets the swipe duration.

func WithMultiSwipeItemEnd
func WithMultiSwipeItemEnd(end []Target) MultiSwipeItemOption
WithMultiSwipeItemEnd sets the swipe end position.

func WithMultiSwipeItemEndHold
func WithMultiSwipeItemEndHold(d []time.Duration) MultiSwipeItemOption
WithMultiSwipeItemEndHold sets extra wait time at end position before releasing.

func WithMultiSwipeItemEndOffset
func WithMultiSwipeItemEndOffset(offset []Rect) MultiSwipeItemOption
WithMultiSwipeItemEndOffset sets additional offset applied to end position.

func WithMultiSwipeItemOnlyHover
func WithMultiSwipeItemOnlyHover(only bool) MultiSwipeItemOption
WithMultiSwipeItemOnlyHover enables hover-only mode without press/release actions.

func WithMultiSwipeItemStarting
func WithMultiSwipeItemStarting(starting time.Duration) MultiSwipeItemOption
WithMultiSwipeItemStarting sets when this swipe starts within the action.

type NeuralClassifyOption
type NeuralClassifyOption func(\*NodeNeuralNetworkClassifyParam)
NeuralClassifyOption is a functional option for configuring NodeNeuralNetworkClassifyParam.

func WithNeuralClassifyExpected
added in v3.1.0
func WithNeuralClassifyExpected(expected []int) NeuralClassifyOption
WithNeuralClassifyExpected sets the expected class indices.

func WithNeuralClassifyIndex
func WithNeuralClassifyIndex(index int) NeuralClassifyOption
WithNeuralClassifyIndex sets which match to select from results.

func WithNeuralClassifyLabels
func WithNeuralClassifyLabels(labels []string) NeuralClassifyOption
WithNeuralClassifyLabels sets the class names for debugging and logging.

func WithNeuralClassifyOrderBy
func WithNeuralClassifyOrderBy(orderBy NodeNeuralNetworkClassifyOrderBy) NeuralClassifyOption
WithNeuralClassifyOrderBy sets the result ordering method.

func WithNeuralClassifyROI
func WithNeuralClassifyROI(roi Target) NeuralClassifyOption
WithNeuralClassifyROI sets the region of interest for classification.

func WithNeuralClassifyROIOffset
func WithNeuralClassifyROIOffset(offset Rect) NeuralClassifyOption
WithNeuralClassifyROIOffset sets the offset applied to ROI.

type NeuralDetectOption
type NeuralDetectOption func(\*NodeNeuralNetworkDetectParam)
NeuralDetectOption is a functional option for configuring NodeNeuralNetworkDetectParam.

func WithNeuralDetectExpected
added in v3.1.0
func WithNeuralDetectExpected(expected []int) NeuralDetectOption
WithNeuralDetectExpected sets the expected class indices.

func WithNeuralDetectIndex
func WithNeuralDetectIndex(index int) NeuralDetectOption
WithNeuralDetectIndex sets which match to select from results.

func WithNeuralDetectLabels
func WithNeuralDetectLabels(labels []string) NeuralDetectOption
WithNeuralDetectLabels sets the class names for debugging and logging.

func WithNeuralDetectOrderBy
func WithNeuralDetectOrderBy(orderBy NodeNeuralNetworkDetectOrderBy) NeuralDetectOption
WithNeuralDetectOrderBy sets the result ordering method.

func WithNeuralDetectROI
func WithNeuralDetectROI(roi Target) NeuralDetectOption
WithNeuralDetectROI sets the region of interest for detection.

func WithNeuralDetectROIOffset
func WithNeuralDetectROIOffset(offset Rect) NeuralDetectOption
WithNeuralDetectROIOffset sets the offset applied to ROI.

type Node
type Node struct {
Name string `json:"-"`

    // Anchor specifies the anchor name that can be referenced in next or on_error lists via [Anchor] attribute.
    Anchor []string `json:"anchor,omitempty"`

    // Recognition defines how this node recognizes targets on screen.
    Recognition *NodeRecognition `json:"recognition,omitempty"`
    // Action defines what action to perform when recognition succeeds.
    Action *NodeAction `json:"action,omitempty"`
    // Next specifies the list of possible next nodes to execute.
    Next []NodeNextItem `json:"next,omitempty"`
    // RateLimit sets the minimum interval between recognition attempts in milliseconds. Default: 1000.
    RateLimit *int64 `json:"rate_limit,omitempty"`
    // Timeout sets the maximum time to wait for recognition in milliseconds. Default: 20000.
    Timeout *int64 `json:"timeout,omitempty"`
    // OnError specifies nodes to execute when recognition times out or action execution fails.
    OnError []NodeNextItem `json:"on_error,omitempty"`
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
    PreWaitFreezes *NodeWaitFreezes `json:"pre_wait_freezes,omitempty"`
    // PostWaitFreezes waits for screen to stabilize after action.
    PostWaitFreezes *NodeWaitFreezes `json:"post_wait_freezes,omitempty"`
    // Repeat specifies the number of times to repeat the node. Default: 1.
    Repeat *uint64 `json:"repeat,omitempty"`
    // RepeatDelay sets the delay between repetitions in milliseconds. Default: 0.
    RepeatDelay *int64 `json:"repeat_delay,omitempty"`
    // RepeatWaitFreezes waits for screen to stabilize between repetitions.
    RepeatWaitFreezes *NodeWaitFreezes `json:"repeat_wait_freezes,omitempty"`
    // Focus specifies custom focus data.
    Focus any `json:"focus,omitempty"`
    // Attach provides additional custom data for the node.
    Attach map[string]any `json:"attach,omitempty"`

}
Node represents a single task node in the pipeline.

func NewNode
func NewNode(name string, opts ...NodeOption) \*Node
NewNode creates a new Node with the given name and options.

func (*Node) AddAnchor
func (n *Node) AddAnchor(anchor string) \*Node
AddAnchor appends an anchor to the node and returns the node for chaining.

func (*Node) AddNext
func (n *Node) AddNext(name string, opts ...NodeAttributeOption) \*Node
AddNext appends a node to the next list and returns the node for chaining.

func (*Node) AddOnError
func (n *Node) AddOnError(name string, opts ...NodeAttributeOption) \*Node
AddOnError appends a node to the on_error list and returns the node for chaining.

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
func (n *Node) SetAction(act *NodeAction) *Node
SetAction sets the action for the node and returns the node for chaining.

func (*Node) SetAnchor
func (n *Node) SetAnchor(anchor []string) \*Node
SetAnchor sets the anchor for the node and returns the node for chaining.

func (*Node) SetAttach
func (n *Node) SetAttach(attach map[string]any) \*Node
SetAttach sets the attached custom data for the node and returns the node for chaining.

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
func (n *Node) SetNext(next []NodeNextItem) \*Node
SetNext sets the next nodes list for the node and returns the node for chaining.

func (*Node) SetOnError
func (n *Node) SetOnError(onError []NodeNextItem) \*Node
SetOnError sets the error handling nodes for the node and returns the node for chaining.

func (*Node) SetPostDelay
func (n *Node) SetPostDelay(postDelay time.Duration) \*Node
SetPostDelay sets the delay after action execution and returns the node for chaining.

func (*Node) SetPostWaitFreezes
func (n *Node) SetPostWaitFreezes(postWaitFreezes *NodeWaitFreezes) *Node
SetPostWaitFreezes sets the post-action wait freezes configuration and returns the node for chaining.

func (*Node) SetPreDelay
func (n *Node) SetPreDelay(preDelay time.Duration) \*Node
SetPreDelay sets the delay before action execution and returns the node for chaining.

func (*Node) SetPreWaitFreezes
func (n *Node) SetPreWaitFreezes(preWaitFreezes *NodeWaitFreezes) *Node
SetPreWaitFreezes sets the pre-action wait freezes configuration and returns the node for chaining.

func (*Node) SetRateLimit
func (n *Node) SetRateLimit(rateLimit time.Duration) \*Node
SetRateLimit sets the rate limit for the node and returns the node for chaining.

func (*Node) SetRecognition
func (n *Node) SetRecognition(rec *NodeRecognition) *Node
SetRecognition sets the recognition for the node and returns the node for chaining.

func (*Node) SetRepeat
added in v3.4.0
func (n *Node) SetRepeat(repeat uint64) \*Node
SetRepeat sets the number of times to repeat the node and returns the node for chaining.

func (*Node) SetRepeatDelay
added in v3.4.0
func (n *Node) SetRepeatDelay(repeatDelay time.Duration) \*Node
SetRepeatDelay sets the delay between repetitions and returns the node for chaining.

func (*Node) SetRepeatWaitFreezes
added in v3.4.0
func (n *Node) SetRepeatWaitFreezes(repeatWaitFreezes *NodeWaitFreezes) *Node
SetRepeatWaitFreezes sets the wait freezes configuration between repetitions and returns the node for chaining.

func (*Node) SetTimeout
func (n *Node) SetTimeout(timeout time.Duration) \*Node
SetTimeout sets the timeout for the node and returns the node for chaining.

type NodeAction
type NodeAction struct {
// Type specifies the action type.
Type NodeActionType `json:"type,omitempty"`
// Param specifies the action parameters.
Param NodeActionParam `json:"param,omitempty"`
}
NodeAction defines the action configuration for a node.

func ActClick
func ActClick(opts ...ClickOption) \*NodeAction
ActClick creates a Click action with the given options.

func ActClickKey
func ActClickKey(keys []int) \*NodeAction
ActClickKey creates a ClickKey action with the given virtual key codes.

func ActCommand
func ActCommand(exec string, opts ...CommandOption) \*NodeAction
ActCommand creates a Command action with the given executable path.

func ActCustom
func ActCustom(name string, opts ...CustomActionOption) \*NodeAction
ActCustom creates a Custom action with the given action name.

func ActDoNothing
func ActDoNothing() \*NodeAction
ActDoNothing creates a DoNothing action that performs no operation.

func ActInputText
func ActInputText(input string) \*NodeAction
ActInputText creates an InputText action with the given text.

func ActKeyDown
func ActKeyDown(key int) \*NodeAction
ActKeyDown creates a KeyDown action that presses the key without releasing.

func ActKeyUp
func ActKeyUp(key int) \*NodeAction
ActKeyUp creates a KeyUp action that releases a previously pressed key.

func ActLongPress
func ActLongPress(opts ...LongPressOption) \*NodeAction
ActLongPress creates a LongPress action with the given options.

func ActLongPressKey
func ActLongPressKey(key []int, opts ...LongPressKeyOption) \*NodeAction
ActLongPressKey creates a LongPressKey action with the given virtual key code.

func ActMultiSwipe
func ActMultiSwipe(swipes ...NodeMultiSwipeItem) \*NodeAction
ActMultiSwipe creates a MultiSwipe action for multi-finger swipe gestures.

func ActScroll
func ActScroll(opts ...ScrollOption) *NodeAction
func ActShell
added in v3.2.0
func ActShell(cmd string) *NodeAction
ActShell creates a Shell action with the given command. This is only valid for ADB controllers. If the controller is not an ADB controller, the action will fail. The output of the command can be obtained in the action detail by MaaTaskerGetActionDetail.

func ActStartApp
func ActStartApp(pkg string) \*NodeAction
ActStartApp creates a StartApp action with the given package name or activity.

func ActStopApp
func ActStopApp(pkg string) \*NodeAction
ActStopApp creates a StopApp action with the given package name.

func ActStopTask
func ActStopTask() \*NodeAction
ActStopTask creates a StopTask action that stops the current task chain.

func ActSwipe
func ActSwipe(opts ...SwipeOption) \*NodeAction
ActSwipe creates a Swipe action with the given options.

func ActTouchDown
func ActTouchDown(opts ...TouchDownOption) \*NodeAction
ActTouchDown creates a TouchDown action with the given options.

func ActTouchMove
func ActTouchMove(opts ...TouchMoveOption) \*NodeAction
ActTouchMove creates a TouchMove action with the given options.

func ActTouchUp
func ActTouchUp(opts ...TouchUpOption) \*NodeAction
ActTouchUp creates a TouchUp action with the given options.

func (*NodeAction) UnmarshalJSON
func (na *NodeAction) UnmarshalJSON(data []byte) error
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

type NodeActionParam
type NodeActionParam interface {
// contains filtered or unexported methods
}
NodeActionParam is the interface for action parameters.

type NodeActionType
type NodeActionType string
NodeActionType defines the available action types.

const (
NodeActionTypeDoNothing NodeActionType = "DoNothing"
NodeActionTypeClick NodeActionType = "Click"
NodeActionTypeLongPress NodeActionType = "LongPress"
NodeActionTypeSwipe NodeActionType = "Swipe"
NodeActionTypeMultiSwipe NodeActionType = "MultiSwipe"
NodeActionTypeTouchDown NodeActionType = "TouchDown"
NodeActionTypeTouchMove NodeActionType = "TouchMove"
NodeActionTypeTouchUp NodeActionType = "TouchUp"
NodeActionTypeClickKey NodeActionType = "ClickKey"
NodeActionTypeLongPressKey NodeActionType = "LongPressKey"
NodeActionTypeKeyDown NodeActionType = "KeyDown"
NodeActionTypeKeyUp NodeActionType = "KeyUp"
NodeActionTypeInputText NodeActionType = "InputText"
NodeActionTypeStartApp NodeActionType = "StartApp"
NodeActionTypeStopApp NodeActionType = "StopApp"
NodeActionTypeStopTask NodeActionType = "StopTask"
NodeActionTypeScroll NodeActionType = "Scroll"
NodeActionTypeCommand NodeActionType = "Command"
NodeActionTypeShell NodeActionType = "Shell"
NodeActionTypeCustom NodeActionType = "Custom"
)
type NodeAndRecognitionItem
added in v3.4.0
type NodeAndRecognitionItem struct {
SubName string `json:"sub_name,omitempty"`
*NodeRecognition `json:"recognition,omitempty"`
}
func AndItem
added in v3.4.0
func AndItem(subName string, recognition *NodeRecognition) NodeAndRecognitionItem
AndItem creates a NodeAndRecognitionItem with the given sub-name and recognition. If subName is empty, only the recognition will be used.

type NodeAndRecognitionParam
added in v3.4.0
type NodeAndRecognitionParam struct {
AllOf []NodeAndRecognitionItem `json:"all_of,omitempty"`
BoxIndex int `json:"box_index,omitempty"`
}
NodeAndRecognitionParam defines parameters for AND recognition.

type NodeAttributeOption
type NodeAttributeOption func(\*NodeNextItem)
NodeAttributeOption is a functional option for configuring NodeNextItem attributes.

func WithAnchor
func WithAnchor() NodeAttributeOption
WithAnchor enables anchor reference. The name field will be treated as an anchor name and resolved to the last node that set this anchor at runtime.

func WithJumpBack
func WithJumpBack() NodeAttributeOption
WithJumpBack enables the jump-back mechanism. When this node matches, the system returns to the parent node after completing this node's chain, and continues recognizing from the start of next list.

type NodeClickKeyParam
type NodeClickKeyParam struct {
// Key specifies the virtual key codes to click. Required.
Key []int `json:"key,omitempty"`
}
NodeClickKeyParam defines parameters for key click action.

type NodeClickParam
type NodeClickParam struct {
// Target specifies the click target position.
Target Target `json:"target,omitzero"`
// TargetOffset specifies additional offset applied to target.
TargetOffset Rect `json:"target_offset,omitempty"`
// Contact specifies the touch point identifier. Adb: finger index (0=first finger). Win32: mouse button (0=left, 1=right, 2=middle).
Contact int `json:"contact,omitempty"`
}
NodeClickParam defines parameters for click action.

type NodeColorMatchMethod
type NodeColorMatchMethod int
NodeColorMatchMethod defines the color space for color matching (cv::ColorConversionCodes).

const (
NodeColorMatchMethodRGB NodeColorMatchMethod = 4 // RGB color space, 3 channels (default)
NodeColorMatchMethodHSV NodeColorMatchMethod = 40 // HSV color space, 3 channels
NodeColorMatchMethodGRAY NodeColorMatchMethod = 6 // Grayscale, 1 channel
)
type NodeColorMatchOrderBy
type NodeColorMatchOrderBy string
NodeColorMatchOrderBy defines the ordering options for color match results.

const (
NodeColorMatchOrderByHorizontal NodeColorMatchOrderBy = "Horizontal" // Order by x coordinate (default)
NodeColorMatchOrderByVertical NodeColorMatchOrderBy = "Vertical" // Order by y coordinate
NodeColorMatchOrderByScore NodeColorMatchOrderBy = "Score" // Order by matching score
NodeColorMatchOrderByArea NodeColorMatchOrderBy = "Area" // Order by region area
NodeColorMatchOrderByRandom NodeColorMatchOrderBy = "Random" // Random order
)
type NodeColorMatchParam
type NodeColorMatchParam struct {
// ROI specifies the region of interest for recognition.
ROI Target `json:"roi,omitzero"`
// ROIOffset specifies the offset applied to ROI.
ROIOffset Rect `json:"roi_offset,omitempty"`
// Method specifies the color space. 4: RGB (default), 40: HSV, 6: GRAY.
Method NodeColorMatchMethod `json:"method,omitempty"`
// Lower specifies the color lower bounds. Required. Inner array length must match method channels.
Lower [][]int `json:"lower,omitempty"`
// Upper specifies the color upper bounds. Required. Inner array length must match method channels.
Upper [][]int `json:"upper,omitempty"`
// Count specifies the minimum pixel count required (threshold). Default: 1.
Count int `json:"count,omitempty"`
// OrderBy specifies the result ordering. Default: Horizontal.
OrderBy NodeColorMatchOrderBy `json:"order_by,omitempty"`
// Index specifies which match to select from results.
Index int `json:"index,omitempty"`
// Connected enables connected component analysis. Default: false.
Connected bool `json:"connected,omitempty"`
}
NodeColorMatchParam defines parameters for color matching recognition.

type NodeCommandParam
type NodeCommandParam struct {
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
NodeCommandParam defines parameters for command execution action.

type NodeCustomActionParam
type NodeCustomActionParam struct {
// Target specifies the action target position.
Target Target `json:"target,omitzero"`
// TargetOffset specifies additional offset applied to target.
TargetOffset Rect `json:"target_offset,omitempty"`
// CustomAction specifies the action name registered via MaaResourceRegisterCustomAction. Required.
CustomAction string `json:"custom_action,omitempty"`
// CustomActionParam specifies custom parameters passed to the action callback.
CustomActionParam any `json:"custom_action_param,omitempty"`
}
NodeCustomActionParam defines parameters for custom action handlers.

type NodeCustomRecognitionParam
type NodeCustomRecognitionParam struct {
// ROI specifies the region of interest for recognition.
ROI Target `json:"roi,omitzero"`
// ROIOffset specifies the offset applied to ROI.
ROIOffset Rect `json:"roi_offset,omitempty"`
// CustomRecognition specifies the recognizer name registered via MaaResourceRegisterCustomRecognition. Required.
CustomRecognition string `json:"custom_recognition,omitempty"`
// CustomRecognitionParam specifies custom parameters passed to the recognition callback.
CustomRecognitionParam any `json:"custom_recognition_param,omitempty"`
}
NodeCustomRecognitionParam defines parameters for custom recognition handlers.

type NodeDetail
type NodeDetail struct {
ID int64
Name string
Recognition *RecognitionDetail
Action *ActionDetail
RunCompleted bool
}
type NodeDirectHitParam
type NodeDirectHitParam struct{}
NodeDirectHitParam defines parameters for direct hit recognition. DirectHit performs no actual recognition and always succeeds.

type NodeDoNothingParam
type NodeDoNothingParam struct{}
NodeDoNothingParam defines parameters for do-nothing action.

type NodeFeatureMatchDetector
type NodeFeatureMatchDetector string
NodeFeatureMatchDetector defines the feature detection algorithms.

const (
NodeFeatureMatchMethodSIFT NodeFeatureMatchDetector = "SIFT" // Scale-Invariant Feature Transform (default, most accurate)
NodeFeatureMatchMethodKAZE NodeFeatureMatchDetector = "KAZE" // KAZE features for 2D/3D images
NodeFeatureMatchMethodAKAZE NodeFeatureMatchDetector = "AKAZE" // Accelerated KAZE
NodeFeatureMatchMethodBRISK NodeFeatureMatchDetector = "BRISK" // Binary Robust Invariant Scalable Keypoints (fast)
NodeFeatureMatchMethodORB NodeFeatureMatchDetector = "ORB" // Oriented FAST and Rotated BRIEF (fast, no scale invariance)
)
type NodeFeatureMatchOrderBy
type NodeFeatureMatchOrderBy string
NodeFeatureMatchOrderBy defines the ordering options for feature match results.

const (
NodeFeatureMatchOrderByHorizontal NodeFeatureMatchOrderBy = "Horizontal" // Order by x coordinate (default)
NodeFeatureMatchOrderByVertical NodeFeatureMatchOrderBy = "Vertical" // Order by y coordinate
NodeFeatureMatchOrderByScore NodeFeatureMatchOrderBy = "Score" // Order by matching score
NodeFeatureMatchOrderByArea NodeFeatureMatchOrderBy = "Area" // Order by bounding box area
NodeFeatureMatchOrderByRandom NodeFeatureMatchOrderBy = "Random" // Random order
)
type NodeFeatureMatchParam
type NodeFeatureMatchParam struct {
// ROI specifies the region of interest for recognition.
ROI Target `json:"roi,omitzero"`
// ROIOffset specifies the offset applied to ROI.
ROIOffset Rect `json:"roi_offset,omitempty"`
// Template specifies the template image paths. Required.
Template []string `json:"template,omitempty"`
// Count specifies the minimum number of feature points required (threshold). Default: 4.
Count int `json:"count,omitempty"`
// OrderBy specifies the result ordering. Default: Horizontal.
OrderBy NodeFeatureMatchOrderBy `json:"order_by,omitempty"`
// Index specifies which match to select from results.
Index int `json:"index,omitempty"`
// GreenMask enables green color masking for transparent areas.
GreenMask bool `json:"green_mask,omitempty"`
// Detector specifies the feature detector algorithm. Options: SIFT, KAZE, AKAZE, BRISK, ORB. Default: SIFT.
Detector NodeFeatureMatchDetector `json:"detector,omitempty"`
// Ratio specifies the matching ratio threshold [0-1.0]. Default: 0.6.
Ratio float64 `json:"ratio,omitempty"`
}
NodeFeatureMatchParam defines parameters for feature matching recognition.

type NodeInputTextParam
type NodeInputTextParam struct {
// InputText specifies the text to input. Some controllers only support ASCII. Required.
InputText string `json:"input_text,omitempty"`
}
NodeInputTextParam defines parameters for text input action.

type NodeKeyDownParam
type NodeKeyDownParam struct {
// Key specifies the virtual key code to press down. Required.
Key int `json:"key,omitempty"`
}
NodeKeyDownParam defines parameters for key down action.

type NodeKeyUpParam
type NodeKeyUpParam struct {
// Key specifies the virtual key code to release. Required.
Key int `json:"key,omitempty"`
}
NodeKeyUpParam defines parameters for key up action.

type NodeLongPressKeyParam
type NodeLongPressKeyParam struct {
// Key specifies the virtual key code to press. Required.
Key []int `json:"key,omitempty"`
// Duration specifies the long press duration in milliseconds. Default: 1000.
Duration int64 `json:"duration,omitempty"`
}
NodeLongPressKeyParam defines parameters for long press key action.

type NodeLongPressParam
type NodeLongPressParam struct {
// Target specifies the long press target position.
Target Target `json:"target,omitzero"`
// TargetOffset specifies additional offset applied to target.
TargetOffset Rect `json:"target_offset,omitempty"`
// Duration specifies the long press duration in milliseconds. Default: 1000.
Duration int64 `json:"duration,omitempty"`
// Contact specifies the touch point identifier. Adb: finger index (0=first finger). Win32: mouse button (0=left, 1=right, 2=middle).
Contact int `json:"contact,omitempty"`
}
NodeLongPressParam defines parameters for long press action.

type NodeMultiSwipeItem
type NodeMultiSwipeItem struct {
// Starting specifies when this swipe starts within the action in milliseconds. Default: 0.
Starting int64 `json:"starting,omitempty"`
// Begin specifies the swipe start position.
Begin Target `json:"begin,omitzero"`
// BeginOffset specifies additional offset applied to begin position.
BeginOffset Rect `json:"begin_offset,omitempty"`
// End specifies the swipe end position.
End []Target `json:"end,omitzero"`
// EndOffset specifies additional offset applied to end position.
EndOffset []Rect `json:"end_offset,omitempty"`
// Duration specifies the swipe duration in milliseconds. Default: 200.
Duration []int64 `json:"duration,omitempty"`
// EndHold specifies extra wait time at end position before releasing in milliseconds. Default: 0.
EndHold []int64 `json:"end_hold,omitempty"`
// OnlyHover enables hover-only mode without press/release actions. Default: false.
OnlyHover bool `json:"only_hover,omitempty"`
// Contact specifies the touch point identifier. Adb: finger index. Win32: mouse button. Default uses array index if 0.
Contact int `json:"contact,omitempty"`
}
NodeMultiSwipeItem defines a single swipe within a multi-swipe action.

func NewMultiSwipeItem
func NewMultiSwipeItem(opts ...MultiSwipeItemOption) NodeMultiSwipeItem
NewMultiSwipeItem creates a new multi-swipe item with the given options.

type NodeMultiSwipeParam
type NodeMultiSwipeParam struct {
// Swipes specifies the list of swipe items. Required.
Swipes []NodeMultiSwipeItem `json:"swipes,omitempty"`
}
NodeMultiSwipeParam defines parameters for multi-finger swipe action.

type NodeNeuralNetworkClassifyOrderBy
type NodeNeuralNetworkClassifyOrderBy string
NodeNeuralNetworkClassifyOrderBy defines the ordering options for classification results.

const (
NodeNeuralNetworkClassifyOrderByHorizontal NodeNeuralNetworkClassifyOrderBy = "Horizontal" // Order by x coordinate (default)
NodeNeuralNetworkClassifyOrderByVertical NodeNeuralNetworkClassifyOrderBy = "Vertical" // Order by y coordinate
NodeNeuralNetworkClassifyOrderByScore NodeNeuralNetworkClassifyOrderBy = "Score" // Order by confidence score
NodeNeuralNetworkClassifyOrderByRandom NodeNeuralNetworkClassifyOrderBy = "Random" // Random order
)
type NodeNeuralNetworkClassifyParam
type NodeNeuralNetworkClassifyParam struct {
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
// OrderBy specifies the result ordering. Default: Horizontal.
OrderBy NodeNeuralNetworkClassifyOrderBy `json:"order_by,omitempty"`
// Index specifies which match to select from results.
Index int `json:"index,omitempty"`
}
NodeNeuralNetworkClassifyParam defines parameters for neural network classification.

type NodeNeuralNetworkDetectOrderBy
type NodeNeuralNetworkDetectOrderBy string
NodeNeuralNetworkDetectOrderBy defines the ordering options for detection results.

const (
NodeNeuralNetworkDetectOrderByHorizontal NodeNeuralNetworkDetectOrderBy = "Horizontal" // Order by x coordinate (default)
NodeNeuralNetworkDetectOrderByVertical NodeNeuralNetworkDetectOrderBy = "Vertical" // Order by y coordinate
NodeNeuralNetworkDetectOrderByScore NodeNeuralNetworkDetectOrderBy = "Score" // Order by confidence score
NodeNeuralNetworkDetectOrderByArea NodeNeuralNetworkDetectOrderBy = "Area" // Order by bounding box area
NodeNeuralNetworkDetectOrderByRandom NodeNeuralNetworkDetectOrderBy = "Random" // Random order
)
type NodeNeuralNetworkDetectParam
type NodeNeuralNetworkDetectParam struct {
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
// OrderBy specifies the result ordering. Default: Horizontal.
OrderBy NodeNeuralNetworkDetectOrderBy `json:"order_by,omitempty"`
// Index specifies which match to select from results.
Index int `json:"index,omitempty"`
}
NodeNeuralNetworkDetectParam defines parameters for neural network object detection.

type NodeNextItem
type NodeNextItem struct {
// Name is the name of the target node.
Name string `json:"name"`
// JumpBack indicates whether to jump back to the parent node after this node's chain completes.
JumpBack bool `json:"jump_back"`
// Anchor indicates whether this node should be set as the anchor.
Anchor bool `json:"anchor"`
}
NodeNextItem represents an item in the next or on_error list.

type NodeNextListDetail
type NodeNextListDetail struct {
TaskID uint64 `json:"task_id"`
Name string `json:"name"`
NextList []NodeNextItem `json:"next_list"`
Focus any `json:"focus"`
}
NodeNextListDetail contains information about node next list events

type NodeOCROrderBy
type NodeOCROrderBy string
NodeOCROrderBy defines the ordering options for OCR results.

const (
NodeOCROrderByHorizontal NodeOCROrderBy = "Horizontal" // Order by x coordinate (default)
NodeOCROrderByVertical NodeOCROrderBy = "Vertical" // Order by y coordinate
NodeOCROrderByArea NodeOCROrderBy = "Area" // Order by text region area
NodeOCROrderByLength NodeOCROrderBy = "Length" // Order by text length
NodeOCROrderByRandom NodeOCROrderBy = "Random" // Random order
)
type NodeOCRParam
type NodeOCRParam struct {
// ROI specifies the region of interest for recognition.
ROI Target `json:"roi,omitzero"`
// ROIOffset specifies the offset applied to ROI.
ROIOffset Rect `json:"roi_offset,omitempty"`
// Expected specifies the expected text results, supports regex. Required.
Expected []string `json:"expected,omitempty"`
// Threshold specifies the model confidence threshold [0-1.0]. Default: 0.3.
Threshold float64 `json:"threshold,omitempty"`
// Replace specifies text replacement rules for correcting OCR errors.
Replace [][2]string `json:"replace,omitempty"`
// OrderBy specifies the result ordering. Default: Horizontal.
OrderBy NodeOCROrderBy `json:"order_by,omitempty"`
// Index specifies which match to select from results.
Index int `json:"index,omitempty"`
// OnlyRec enables recognition-only mode without detection (requires precise ROI). Default: false.
OnlyRec bool `json:"only_rec,omitempty"`
// Model specifies the model folder path relative to model/ocr directory.
Model string `json:"model,omitempty"`
}
NodeOCRParam defines parameters for OCR text recognition.

type NodeOption
type NodeOption func(\*Node)
NodeOption is a functional option for configuring a Node.

func WithAction
func WithAction(act \*NodeAction) NodeOption
WithAction sets the action for the node.

func WithAttach
func WithAttach(attach map[string]any) NodeOption
WithAttach sets the attached custom data for the node.

func WithEnabled
func WithEnabled(enabled bool) NodeOption
WithEnabled sets whether the node is enabled.

func WithFocus
func WithFocus(focus any) NodeOption
WithFocus sets the focus data for the node.

func WithInverse
func WithInverse(inverse bool) NodeOption
WithInverse sets whether to invert the recognition result.

func WithMaxHit
func WithMaxHit(maxHit uint64) NodeOption
WithMaxHit sets the maximum hit count of the node.

func WithNext
func WithNext(next []NodeNextItem) NodeOption
WithNext sets the next nodes list for the node.

func WithOnError
func WithOnError(onError []NodeNextItem) NodeOption
WithOnError sets the error handling nodes for the node.

func WithPostDelay
func WithPostDelay(postDelay time.Duration) NodeOption
WithPostDelay sets the delay after action execution.

func WithPostWaitFreezes
func WithPostWaitFreezes(waitFreezes \*NodeWaitFreezes) NodeOption
WithPostWaitFreezes sets the post-action wait freezes configuration.

func WithPreDelay
func WithPreDelay(preDelay time.Duration) NodeOption
WithPreDelay sets the delay before action execution.

func WithPreWaitFreezes
func WithPreWaitFreezes(waitFreezes \*NodeWaitFreezes) NodeOption
WithPreWaitFreezes sets the pre-action wait freezes configuration.

func WithRateLimit
func WithRateLimit(rateLimit time.Duration) NodeOption
WithRateLimit sets the rate limit for the node.

func WithRecognition
func WithRecognition(rec \*NodeRecognition) NodeOption
WithRecognition sets the recognition for the node.

func WithRepeat
added in v3.4.0
func WithRepeat(repeat uint64) NodeOption
WithRepeat sets the number of times to repeat the node.

func WithRepeatDelay
added in v3.4.0
func WithRepeatDelay(repeatDelay time.Duration) NodeOption
WithRepeatDelay sets the delay between repetitions.

func WithRepeatWaitFreezes
added in v3.4.0
func WithRepeatWaitFreezes(waitFreezes \*NodeWaitFreezes) NodeOption
WithRepeatWaitFreezes sets the wait freezes configuration between repetitions.

func WithTimeout
func WithTimeout(timeout time.Duration) NodeOption
WithTimeout sets the timeout for the node.

type NodeOrRecognitionParam
added in v3.4.0
type NodeOrRecognitionParam struct {
AnyOf []\*NodeRecognition `json:"any_of,omitempty"`
}
NodeOrRecognitionParam defines parameters for OR recognition.

type NodePipelineNodeDetail
type NodePipelineNodeDetail struct {
TaskID uint64 `json:"task_id"`
NodeID uint64 `json:"node_id"`
Name string `json:"name"`
Focus any `json:"focus"`
}
NodePipelineNodeDetail contains information about pipeline node events

type NodeRecognition
type NodeRecognition struct {
// Type specifies the recognition algorithm type.
Type NodeRecognitionType `json:"type,omitempty"`
// Param specifies the recognition parameters.
Param NodeRecognitionParam `json:"param,omitempty"`
}
NodeRecognition defines the recognition configuration for a node.

func RecAnd
added in v3.4.0
func RecAnd(allOf []NodeAndRecognitionItem, opts ...AndRecognitionOption) \*NodeRecognition
RecAnd creates an AND recognition that requires all sub-recognitions to succeed.

func RecColorMatch
func RecColorMatch(lower, upper [][]int, opts ...ColorMatchOption) \*NodeRecognition
RecColorMatch creates a ColorMatch recognition with the given color bounds.

func RecCustom
func RecCustom(name string, opts ...CustomRecognitionOption) \*NodeRecognition
RecCustom creates a Custom recognition with the given recognizer name.

func RecDirectHit
func RecDirectHit() \*NodeRecognition
RecDirectHit creates a DirectHit recognition that always succeeds without actual recognition.

func RecFeatureMatch
func RecFeatureMatch(template []string, opts ...FeatureMatchOption) \*NodeRecognition
RecFeatureMatch creates a FeatureMatch recognition with the given template images. Feature matching provides better generalization with perspective and scale invariance.

func RecNeuralNetworkClassify
func RecNeuralNetworkClassify(model string, opts ...NeuralClassifyOption) \*NodeRecognition
RecNeuralNetworkClassify creates a NeuralNetworkClassify recognition. This classifies images at fixed positions into predefined categories.

func RecNeuralNetworkDetect
func RecNeuralNetworkDetect(model string, opts ...NeuralDetectOption) \*NodeRecognition
RecNeuralNetworkDetect creates a NeuralNetworkDetect recognition. This detects objects at arbitrary positions using deep learning models like YOLO.

func RecOCR
func RecOCR(opts ...OCROption) \*NodeRecognition
RecOCR creates an OCR recognition with the given expected text patterns.

func RecOr
added in v3.4.0
func RecOr(anyOf []*NodeRecognition) *NodeRecognition
RecOr creates an OR recognition that succeeds if any sub-recognition succeeds.

func RecTemplateMatch
func RecTemplateMatch(template []string, opts ...TemplateMatchOption) \*NodeRecognition
RecTemplateMatch creates a TemplateMatch recognition with the given template images.

func (*NodeRecognition) UnmarshalJSON
func (nr *NodeRecognition) UnmarshalJSON(data []byte) error
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

type NodeRecognitionParam
type NodeRecognitionParam interface {
// contains filtered or unexported methods
}
NodeRecognitionParam is the interface for recognition parameters.

type NodeRecognitionType
type NodeRecognitionType string
NodeRecognitionType defines the available recognition algorithm types.

const (
NodeRecognitionTypeDirectHit NodeRecognitionType = "DirectHit"
NodeRecognitionTypeTemplateMatch NodeRecognitionType = "TemplateMatch"
NodeRecognitionTypeFeatureMatch NodeRecognitionType = "FeatureMatch"
NodeRecognitionTypeColorMatch NodeRecognitionType = "ColorMatch"
NodeRecognitionTypeOCR NodeRecognitionType = "OCR"
NodeRecognitionTypeNeuralNetworkClassify NodeRecognitionType = "NeuralNetworkClassify"
NodeRecognitionTypeNeuralNetworkDetect NodeRecognitionType = "NeuralNetworkDetect"
NodeRecognitionTypeAnd NodeRecognitionType = "And"
NodeRecognitionTypeOr NodeRecognitionType = "Or"
NodeRecognitionTypeCustom NodeRecognitionType = "Custom"
)
type NodeScrollParam
type NodeScrollParam struct {
Dx int `json:"dx,omitempty"`
Dy int `json:"dy,omitempty"`
}
type NodeShellParam
added in v3.2.0
type NodeShellParam struct {
Cmd string `json:"cmd,omitempty"`
}
NodeShellParam defines parameters for shell command execution action.

type NodeStartAppParam
type NodeStartAppParam struct {
// Package specifies the package name or activity to start. Required.
Package string `json:"package,omitempty"`
}
NodeStartAppParam defines parameters for start app action.

type NodeStopAppParam
type NodeStopAppParam struct {
// Package specifies the package name to stop. Required.
Package string `json:"package,omitempty"`
}
NodeStopAppParam defines parameters for stop app action.

type NodeStopTaskParam
type NodeStopTaskParam struct{}
NodeStopTaskParam defines parameters for stop task action. This action stops the current task chain.

type NodeSwipeParam
type NodeSwipeParam struct {
// Begin specifies the swipe start position.
Begin Target `json:"begin,omitzero"`
// BeginOffset specifies additional offset applied to begin position.
BeginOffset Rect `json:"begin_offset,omitempty"`
// End specifies the swipe end position.
End []Target `json:"end,omitzero"`
// EndOffset specifies additional offset applied to end position.
EndOffset []Rect `json:"end_offset,omitempty"`
// Duration specifies the swipe duration in milliseconds. Default: 200.
Duration []int64 `json:"duration,omitempty"`
// EndHold specifies extra wait time at end position before releasing in milliseconds. Default: 0.
EndHold []int64 `json:"end_hold,omitempty"`
// OnlyHover enables hover-only mode without press/release actions. Default: false.
OnlyHover bool `json:"only_hover,omitempty"`
// Contact specifies the touch point identifier. Adb: finger index (0=first finger). Win32: mouse button (0=left, 1=right, 2=middle).
Contact int `json:"contact,omitempty"`
}
NodeSwipeParam defines parameters for swipe action.

type NodeTemplateMatchMethod
type NodeTemplateMatchMethod int
NodeTemplateMatchMethod defines the template matching algorithm (cv::TemplateMatchModes).

const (
NodeTemplateMatchMethodSQDIFF_NORMED_Inverted NodeTemplateMatchMethod = 10001 // Normalized squared difference (Inverted)
NodeTemplateMatchMethodCCORR_NORMED NodeTemplateMatchMethod = 3 // Normalized cross correlation
NodeTemplateMatchMethodCCOEFF_NORMED NodeTemplateMatchMethod = 5 // Normalized correlation coefficient (default, most accurate)
)
type NodeTemplateMatchOrderBy
type NodeTemplateMatchOrderBy string
NodeTemplateMatchOrderBy defines the ordering options for template match results.

const (
NodeTemplateMatchOrderByHorizontal NodeTemplateMatchOrderBy = "Horizontal"
NodeTemplateMatchOrderByVertical NodeTemplateMatchOrderBy = "Vertical"
NodeTemplateMatchOrderByScore NodeTemplateMatchOrderBy = "Score"
NodeTemplateMatchOrderByRandom NodeTemplateMatchOrderBy = "Random"
)
type NodeTemplateMatchParam
type NodeTemplateMatchParam struct {
// ROI specifies the region of interest for recognition.
ROI Target `json:"roi,omitzero"`
// ROIOffset specifies the offset applied to ROI.
ROIOffset Rect `json:"roi_offset,omitempty"`
// Template specifies the template image paths. Required.
Template []string `json:"template,omitempty"`
// Threshold specifies the matching threshold [0-1.0]. Default: 0.7.
Threshold []float64 `json:"threshold,omitempty"`
// OrderBy specifies the result ordering. Default: Horizontal.
OrderBy NodeTemplateMatchOrderBy `json:"order_by,omitempty"`
// Index specifies which match to select from results.
Index int `json:"index,omitempty"`
// Method specifies the matching algorithm. 1: SQDIFF_NORMED, 3: CCORR_NORMED, 5: CCOEFF_NORMED. Default: 5.
Method NodeTemplateMatchMethod `json:"method,omitempty"`
// GreenMask enables green color masking for transparent areas.
GreenMask bool `json:"green_mask,omitempty"`
}
NodeTemplateMatchParam defines parameters for template matching recognition.

type NodeTouchDownParam
type NodeTouchDownParam struct {
// Target specifies the touch target position.
Target Target `json:"target,omitzero"`
// TargetOffset specifies additional offset applied to target.
TargetOffset Rect `json:"target_offset,omitempty"`
// Pressure specifies the touch pressure, range depends on controller implementation. Default: 0.
Pressure int `json:"pressure,omitempty"`
// Contact specifies the touch point identifier. Adb: finger index (0=first finger). Win32: mouse button (0=left, 1=right, 2=middle).
Contact int `json:"contact,omitempty"`
}
NodeTouchDownParam defines parameters for touch down action.

type NodeTouchMoveParam
type NodeTouchMoveParam struct {
// Target specifies the touch target position.
Target Target `json:"target,omitzero"`
// TargetOffset specifies additional offset applied to target.
TargetOffset Rect `json:"target_offset,omitempty"`
// Pressure specifies the touch pressure, range depends on controller implementation. Default: 0.
Pressure int `json:"pressure,omitempty"`
// Contact specifies the touch point identifier. Adb: finger index (0=first finger). Win32: mouse button (0=left, 1=right, 2=middle).
Contact int `json:"contact,omitempty"`
}
NodeTouchMoveParam defines parameters for touch move action.

type NodeTouchUpParam
type NodeTouchUpParam struct {
// Contact specifies the touch point identifier. Adb: finger index (0=first finger). Win32: mouse button (0=left, 1=right, 2=middle).
Contact int `json:"contact,omitempty"`
}
NodeTouchUpParam defines parameters for touch up action.

type NodeWaitFreezes
type NodeWaitFreezes struct {
// Time specifies the duration in milliseconds that the screen must remain stable. Default: 1.
Time int64 `json:"time,omitempty"`
// Target specifies the region to monitor for changes.
Target Target `json:"target,omitzero"`
// TargetOffset specifies additional offset applied to target.
TargetOffset Rect `json:"target_offset,omitempty"`
// Threshold specifies the template matching threshold for detecting changes. Default: 0.95.
Threshold float64 `json:"threshold,omitempty"`
// Method specifies the template matching algorithm (cv::TemplateMatchModes). Default: 5.
Method int `json:"method,omitempty"`
// RateLimit specifies the minimum interval between checks in milliseconds. Default: 1000.
RateLimit int64 `json:"rate_limit,omitempty"`
// Timeout specifies the maximum wait time in milliseconds. Default: 20000.
Timeout int64 `json:"timeout,omitempty"`
}
NodeWaitFreezes defines parameters for waiting until screen stabilizes. The screen is considered stable when there are no significant changes for a continuous period.

func WaitFreezes
func WaitFreezes(opts ...WaitFreezesOption) \*NodeWaitFreezes
WaitFreezes creates a NodeWaitFreezes configuration with the given options.

type OCROption
type OCROption func(\*NodeOCRParam)
OCROption is a functional option for configuring NodeOCRParam.

func WithOCRExpected
added in v3.1.0
func WithOCRExpected(expected []string) OCROption
WithOCRExpected sets the expected text results.

func WithOCRIndex
func WithOCRIndex(index int) OCROption
WithOCRIndex sets which match to select from results.

func WithOCRModel
func WithOCRModel(model string) OCROption
WithOCRModel sets the model folder path.

func WithOCROnlyRec
func WithOCROnlyRec(only bool) OCROption
WithOCROnlyRec enables recognition-only mode without text detection.

func WithOCROrderBy
func WithOCROrderBy(orderBy NodeOCROrderBy) OCROption
WithOCROrderBy sets the result ordering method.

func WithOCRROI
func WithOCRROI(roi Target) OCROption
WithOCRROI sets the region of interest for OCR.

func WithOCRROIOffset
func WithOCRROIOffset(offset Rect) OCROption
WithOCRROIOffset sets the offset applied to ROI.

func WithOCRReplace
func WithOCRReplace(replace [][2]string) OCROption
WithOCRReplace sets text replacement rules for correcting OCR errors.

func WithOCRThreshold
func WithOCRThreshold(th float64) OCROption
WithOCRThreshold sets the model confidence threshold.

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

func (*Pipeline) MarshalJSON
func (p *Pipeline) MarshalJSON() ([]byte, error)
MarshalJSON implements the json.Marshaler interface.

type RecognitionDetail
type RecognitionDetail struct {
ID int64
Name string
Algorithm string
Hit bool
Box Rect
DetailJson string
Raw image.Image
Draws []image.Image
}
type Rect
type Rect = rect.Rect
type Resource
type Resource struct {
// contains filtered or unexported fields
}
func NewResource
func NewResource() \*Resource
NewResource creates a new resource.

func (*Resource) AddSink
func (r *Resource) AddSink(sink ResourceEventSink) int64
AddSink adds a event callback sink and returns the sink ID. The sink ID can be used to remove the sink later.

func (*Resource) Clear
func (r *Resource) Clear() bool
Clear clears the resource loading paths.

func (*Resource) ClearCustomAction
func (r *Resource) ClearCustomAction() bool
ClearCustomAction clears all custom actions runners registered from the resource.

func (*Resource) ClearCustomRecognition
func (r *Resource) ClearCustomRecognition() bool
ClearCustomRecognition clears all custom recognitions runner registered from the resource.

func (*Resource) ClearSinks
func (r *Resource) ClearSinks()
ClearSinks clears all event callback sinks.

func (*Resource) Destroy
func (r *Resource) Destroy()
Destroy frees the resource.

func (*Resource) GetCustomActionList
func (r *Resource) GetCustomActionList() ([]string, bool)
GetCustomActionList returns the custom action list of the resource.

func (*Resource) GetCustomRecognitionList
func (r *Resource) GetCustomRecognitionList() ([]string, bool)
GetCustomRecognitionList returns the custom recognition list of the resource.

func (*Resource) GetHash
func (r *Resource) GetHash() (string, bool)
GetHash returns the hash of the resource.

func (*Resource) GetNodeJSON
func (r *Resource) GetNodeJSON(name string) (string, bool)
GetNodeJSON gets the node JSON by name.

func (*Resource) GetNodeList
func (r *Resource) GetNodeList() ([]string, bool)
GetNodeList returns the node list of the resource.

func (*Resource) Loaded
func (r *Resource) Loaded() bool
Loaded checks if resources are loaded.

func (*Resource) OnResourceLoading
func (r *Resource) OnResourceLoading(fn func(EventStatus, ResourceLoadingDetail)) int64
OnResourceLoading registers a callback sink that only handles Resource.Loading events and returns the sink ID. The sink ID can be used to remove the sink later.

func (*Resource) OverrideNext
func (r *Resource) OverrideNext(name string, nextList []string) bool
OverrideNext overrides the next list of task by name.

func (*Resource) OverridePipeline
func (r *Resource) OverridePipeline(override any) bool
OverridePipeline overrides pipeline. The `override` parameter can be a JSON string or any data type that can be marshaled to JSON.

func (*Resource) OverriderImage
func (r *Resource) OverriderImage(imageName string, image image.Image) bool
func (*Resource) PostBundle
func (r *Resource) PostBundle(path string) \*Job
PostBundle adds a path to the resource loading paths. Return id of the resource.

func (*Resource) PostImage
added in v3.4.0
func (r *Resource) PostImage(path string) \*Job
PostImage adds an image to the resource loading paths.

func (*Resource) PostOcrModel
added in v3.4.0
func (r *Resource) PostOcrModel(path string) \*Job
PostOcrModel adds an OCR model to the resource loading paths.

func (*Resource) PostPipeline
added in v3.4.0
func (r *Resource) PostPipeline(path string) \*Job
PostPipeline adds a pipeline to the resource loading paths.

func (*Resource) RegisterCustomAction
func (r *Resource) RegisterCustomAction(name string, action CustomActionRunner) bool
RegisterCustomAction registers a custom action runner to the resource.

func (*Resource) RegisterCustomRecognition
func (r *Resource) RegisterCustomRecognition(name string, recognition CustomRecognitionRunner) bool
RegisterCustomRecognition registers a custom recognition runner to the resource.

func (*Resource) RemoveSink
func (r *Resource) RemoveSink(sinkId int64)
RemoveSink removes a event callback sink by sink ID.

func (*Resource) UnregisterCustomAction
func (r *Resource) UnregisterCustomAction(name string) bool
UnregisterCustomAction unregisters a custom action runner from the resource.

func (*Resource) UnregisterCustomRecognition
func (r *Resource) UnregisterCustomRecognition(name string) bool
UnregisterCustomRecognition unregisters a custom recognition runner from the resource.

func (*Resource) UseAutoExecutionProvider
func (r *Resource) UseAutoExecutionProvider() bool
UseAutoExecutionProvider

func (*Resource) UseCPU
func (r *Resource) UseCPU() bool
UseCPU

func (*Resource) UseCoreml
func (r *Resource) UseCoreml(coremlFlag InterenceDevice) bool
UseCoreml

func (*Resource) UseDirectml
func (r *Resource) UseDirectml(deviceID InterenceDevice) bool
UseDirectml

type ResourceEventSink
type ResourceEventSink interface {
OnResourceLoading(res \*Resource, event EventStatus, detail ResourceLoadingDetail)
}
type ResourceEventSinkAdapter
type ResourceEventSinkAdapter struct {
// contains filtered or unexported fields
}
ResourceEventSinkAdapter is a lightweight adapter that makes it easy to register a single-event handler via a callback function.

func (*ResourceEventSinkAdapter) OnResourceLoading
func (a *ResourceEventSinkAdapter) OnResourceLoading(res \*Resource, status EventStatus, detail ResourceLoadingDetail)
type ResourceLoadingDetail
type ResourceLoadingDetail struct {
ResID uint64 `json:"res_id"`
Hash string `json:"hash"`
Path string `json:"path"`
}
ResourceLoadingDetail contains information about resource loading events

type ScrollOption
type ScrollOption func(\*NodeScrollParam)
func WithScrollDx
func WithScrollDx(dx int) ScrollOption
func WithScrollDy
func WithScrollDy(dy int) ScrollOption
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

type SwipeOption
type SwipeOption func(\*NodeSwipeParam)
SwipeOption is a functional option for configuring NodeSwipeParam.

func WithSwipeBegin
func WithSwipeBegin(begin Target) SwipeOption
WithSwipeBegin sets the swipe start position.

func WithSwipeBeginOffset
func WithSwipeBeginOffset(offset Rect) SwipeOption
WithSwipeBeginOffset sets additional offset applied to begin position.

func WithSwipeContact
func WithSwipeContact(contact int) SwipeOption
WithSwipeContact sets the touch point identifier.

func WithSwipeDuration
func WithSwipeDuration(d []time.Duration) SwipeOption
WithSwipeDuration sets the swipe duration.

func WithSwipeEnd
func WithSwipeEnd(end []Target) SwipeOption
WithSwipeEnd sets the swipe end position.

func WithSwipeEndHold
func WithSwipeEndHold(d []time.Duration) SwipeOption
WithSwipeEndHold sets extra wait time at end position before releasing.

func WithSwipeEndOffset
func WithSwipeEndOffset(offset []Rect) SwipeOption
WithSwipeEndOffset sets additional offset applied to end position.

func WithSwipeOnlyHover
func WithSwipeOnlyHover(only bool) SwipeOption
WithSwipeOnlyHover enables hover-only mode without press/release actions.

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
NodeDetails []*NodeDetail
Status Status
}
type TaskJob
type TaskJob struct {
*Job
// contains filtered or unexported fields
}
TaskJob extends Job with task-specific functionality. It provides additional methods to retrieve task details.

func (*TaskJob) GetDetail
func (j *TaskJob) GetDetail() \*TaskDetail
GetDetail retrieves the detailed information of the task.

func (*TaskJob) Wait
func (j *TaskJob) Wait() \*TaskJob
Wait blocks until the task job completes and returns the TaskJob instance.

type Tasker
type Tasker struct {
// contains filtered or unexported fields
}
func NewTasker
func NewTasker() \*Tasker
NewTasker creates a new tasker.

func (*Tasker) AddContextSink
func (t *Tasker) AddContextSink(sink ContextEventSink) int64
AddContextSink adds a context event callback sink and returns the sink ID.

func (*Tasker) AddSink
func (t *Tasker) AddSink(sink TaskerEventSink) int64
AddSink adds a event callback sink and returns the sink ID. The sink ID can be used to remove the sink later.

func (*Tasker) BindController
func (t *Tasker) BindController(ctrl \*Controller) bool
BindController binds the tasker to an initialized controller.

func (*Tasker) BindResource
func (t *Tasker) BindResource(res \*Resource) bool
BindResource binds the tasker to an initialized resource.

func (*Tasker) ClearCache
func (t *Tasker) ClearCache() bool
ClearCache clears runtime cache.

func (*Tasker) ClearContextSinks
func (t *Tasker) ClearContextSinks()
ClearContextSinks clears all context event callback sinks.

func (*Tasker) ClearSinks
func (t *Tasker) ClearSinks()
ClearSinks clears all event callback sinks.

func (*Tasker) Destroy
func (t *Tasker) Destroy()
Destroy free the tasker.

func (*Tasker) GetController
func (t *Tasker) GetController() \*Controller
GetController returns the controller handle of the tasker.

func (*Tasker) GetLatestNode
func (t *Tasker) GetLatestNode(taskName string) \*NodeDetail
GetLatestNode returns latest node id.

func (*Tasker) GetResource
func (t *Tasker) GetResource() \*Resource
GetResource returns the resource handle of the tasker.

func (*Tasker) Initialized
func (t *Tasker) Initialized() bool
Initialized checks if the tasker is initialized.

func (*Tasker) OnNodeActionInContext
added in v3.3.0
func (t *Tasker) OnNodeActionInContext(fn func(\*Context, EventStatus, NodeActionDetail)) int64
OnNodeActionInContext registers a callback sink that only handles Node.Action events and returns the sink ID. The sink ID can be used to remove the sink later.

func (*Tasker) OnNodeActionNodeInContext
func (t *Tasker) OnNodeActionNodeInContext(fn func(\*Context, EventStatus, NodeActionNodeDetail)) int64
OnNodeActionNodeInContext registers a callback sink that only handles Node.ActionNode events and returns the sink ID. The sink ID can be used to remove the sink later.

func (*Tasker) OnNodeNextListInContext
added in v3.3.0
func (t *Tasker) OnNodeNextListInContext(fn func(\*Context, EventStatus, NodeNextListDetail)) int64
OnNodeNextListInContext registers a callback sink that only handles Node.NextList events and returns the sink ID. The sink ID can be used to remove the sink later.

func (*Tasker) OnNodePipelineNodeInContext
func (t *Tasker) OnNodePipelineNodeInContext(fn func(\*Context, EventStatus, NodePipelineNodeDetail)) int64
OnNodePipelineNodeInContext registers a callback sink that only handles Node.PipelineNode events and returns the sink ID. The sink ID can be used to remove the sink later.

func (*Tasker) OnNodeRecognitionInContext
added in v3.3.0
func (t *Tasker) OnNodeRecognitionInContext(fn func(\*Context, EventStatus, NodeRecognitionDetail)) int64
OnNodeRecognitionInContext registers a callback sink that only handles Node.Recognition events and returns the sink ID. The sink ID can be used to remove the sink later.

func (*Tasker) OnNodeRecognitionNodeInContext
func (t *Tasker) OnNodeRecognitionNodeInContext(fn func(\*Context, EventStatus, NodeRecognitionNodeDetail)) int64
OnNodeRecognitionNodeInContext registers a callback sink that only handles Node.RecognitionNode events and returns the sink ID. The sink ID can be used to remove the sink later.

func (*Tasker) OnTaskerTask
func (t *Tasker) OnTaskerTask(fn func(EventStatus, TaskerTaskDetail)) int64
OnTaskerTask registers a callback sink that only handles Tasker.Task events and returns the sink ID. The sink ID can be used to remove the sink later.

func (*Tasker) PostAction
added in v3.1.0
func (t *Tasker) PostAction(actionType NodeActionType, actionParam NodeActionParam, box Rect, recoDetail *RecognitionDetail) *TaskJob
PostAction posts an action to the tasker.

func (*Tasker) PostRecognition
added in v3.1.0
func (t *Tasker) PostRecognition(recType NodeRecognitionType, recParam NodeRecognitionParam, img image.Image) \*TaskJob
PostRecognition posts a recognition to the tasker.

func (*Tasker) PostStop
func (t *Tasker) PostStop() \*TaskJob
PostStop posts a stop signal to the tasker.

func (*Tasker) PostTask
func (t *Tasker) PostTask(entry string, override ...any) \*TaskJob
PostTask posts a task to the tasker. `override` is an optional parameter. If provided, it should be a single value that can be a JSON string or any data type that can be marshaled to JSON. If multiple values are provided, only the first one will be used.

func (*Tasker) RemoveContextSink
func (t *Tasker) RemoveContextSink(sinkId int64)
RemoveContextSink removes a context event callback sink by sink ID.

func (*Tasker) RemoveSink
func (t *Tasker) RemoveSink(sinkId int64)
RemoveSink removes a event callback sink by sink ID.

func (*Tasker) Running
func (t *Tasker) Running() bool
Running checks if the instance running.

func (*Tasker) Stopping
func (t *Tasker) Stopping() bool
Stopping checks whether the tasker is stopping.

type TaskerEventSink
type TaskerEventSink interface {
OnTaskerTask(tasker \*Tasker, event EventStatus, detail TaskerTaskDetail)
}
type TaskerEventSinkAdapter
type TaskerEventSinkAdapter struct {
// contains filtered or unexported fields
}
TaskerEventSinkAdapter is a lightweight adapter that makes it easy to register a single-event handler via a callback function.

func (*TaskerEventSinkAdapter) OnTaskerTask
func (a *TaskerEventSinkAdapter) OnTaskerTask(tasker \*Tasker, status EventStatus, detail TaskerTaskDetail)
type TaskerTaskDetail
type TaskerTaskDetail struct {
TaskID uint64 `json:"task_id"`
Entry string `json:"entry"`
UUID string `json:"uuid"`
Hash string `json:"hash"`
}
TaskerTaskDetail contains information about tasker task events

type TemplateMatchOption
type TemplateMatchOption func(\*NodeTemplateMatchParam)
TemplateMatchOption is a functional option for configuring NodeTemplateMatchParam.

func WithTemplateMatchGreenMask
func WithTemplateMatchGreenMask(greenMask bool) TemplateMatchOption
WithTemplateMatchGreenMask enables green color masking for transparent areas.

func WithTemplateMatchIndex
func WithTemplateMatchIndex(index int) TemplateMatchOption
WithTemplateMatchIndex sets which match to select from results.

func WithTemplateMatchMethod
func WithTemplateMatchMethod(method NodeTemplateMatchMethod) TemplateMatchOption
WithTemplateMatchMethod sets the template matching algorithm.

func WithTemplateMatchOrderBy
func WithTemplateMatchOrderBy(orderBy NodeTemplateMatchOrderBy) TemplateMatchOption
WithTemplateMatchOrderBy sets the result ordering method.

func WithTemplateMatchROI
func WithTemplateMatchROI(roi Target) TemplateMatchOption
WithTemplateMatchROI sets the region of interest for template matching.

func WithTemplateMatchROIOffset
func WithTemplateMatchROIOffset(offset Rect) TemplateMatchOption
WithTemplateMatchROIOffset sets the offset applied to ROI.

func WithTemplateMatchThreshold
func WithTemplateMatchThreshold(threshold []float64) TemplateMatchOption
WithTemplateMatchThreshold sets the matching threshold.

type TouchDownOption
type TouchDownOption func(\*NodeTouchDownParam)
TouchDownOption is a functional option for configuring NodeTouchDownParam.

func WithTouchDownContact
func WithTouchDownContact(contact int) TouchDownOption
WithTouchDownContact sets the touch point identifier.

func WithTouchDownPressure
func WithTouchDownPressure(pressure int) TouchDownOption
WithTouchDownPressure sets the touch pressure.

func WithTouchDownTarget
func WithTouchDownTarget(target Target) TouchDownOption
WithTouchDownTarget sets the touch target position.

func WithTouchDownTargetOffset
func WithTouchDownTargetOffset(offset Rect) TouchDownOption
WithTouchDownTargetOffset sets additional offset applied to target.

type TouchMoveOption
type TouchMoveOption func(\*NodeTouchMoveParam)
TouchMoveOption is a functional option for configuring NodeTouchMoveParam.

func WithTouchMoveContact
func WithTouchMoveContact(contact int) TouchMoveOption
WithTouchMoveContact sets the touch point identifier.

func WithTouchMovePressure
func WithTouchMovePressure(pressure int) TouchMoveOption
WithTouchMovePressure sets the touch pressure.

func WithTouchMoveTarget
func WithTouchMoveTarget(target Target) TouchMoveOption
WithTouchMoveTarget sets the touch target position.

func WithTouchMoveTargetOffset
func WithTouchMoveTargetOffset(offset Rect) TouchMoveOption
WithTouchMoveTargetOffset sets additional offset applied to target.

type TouchUpOption
type TouchUpOption func(\*NodeTouchUpParam)
TouchUpOption is a functional option for configuring NodeTouchUpParam.

func WithTouchUpContact
func WithTouchUpContact(contact int) TouchUpOption
WithTouchUpContact sets the touch point identifier.

type WaitFreezesOption
type WaitFreezesOption func(\*NodeWaitFreezes)
WaitFreezesOption is a functional option for configuring NodeWaitFreezes.

func WithWaitFreezesMethod
func WithWaitFreezesMethod(m int) WaitFreezesOption
WithWaitFreezesMethod sets the template matching algorithm.

func WithWaitFreezesRateLimit
func WithWaitFreezesRateLimit(d time.Duration) WaitFreezesOption
WithWaitFreezesRateLimit sets the minimum interval between checks.

func WithWaitFreezesTarget
func WithWaitFreezesTarget(target Target) WaitFreezesOption
WithWaitFreezesTarget sets the region to monitor for changes.

func WithWaitFreezesTargetOffset
func WithWaitFreezesTargetOffset(offset Rect) WaitFreezesOption
WithWaitFreezesTargetOffset sets additional offset applied to target.

func WithWaitFreezesThreshold
func WithWaitFreezesThreshold(th float64) WaitFreezesOption
WithWaitFreezesThreshold sets the template matching threshold for detecting changes.

func WithWaitFreezesTime
func WithWaitFreezesTime(d time.Duration) WaitFreezesOption
WithWaitFreezesTime sets the duration that the screen must remain stable.

func WithWaitFreezesTimeout
func WithWaitFreezesTimeout(d time.Duration) WaitFreezesOption
WithWaitFreezesTimeout sets the maximum wait time.
