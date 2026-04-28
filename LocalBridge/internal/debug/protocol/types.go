package protocol

const (
	Generation      = "debug-vNext"
	ProtocolVersion = "0.14.0"
)

type RunMode string

const (
	RunModeFullRun               RunMode = "full-run"
	RunModeRunFromNode           RunMode = "run-from-node"
	RunModeSingleNodeRun         RunMode = "single-node-run"
	RunModeRecognitionOnly       RunMode = "recognition-only"
	RunModeActionOnly            RunMode = "action-only"
	RunModeFixedImageRecognition RunMode = "fixed-image-recognition"
	RunModeReplay                RunMode = "replay"
)

type CapabilityManifest struct {
	Generation        string   `json:"generation"`
	Protocol          string   `json:"protocol"`
	RunModes          []string `json:"runModes"`
	Diagnostics       []string `json:"diagnostics"`
	Artifacts         []string `json:"artifacts"`
	ScreenshotSources []string `json:"screenshotSources"`
	ProfileFeatures   []string `json:"profileFeatures"`
	Maa               MaaInfo  `json:"maa"`
}

type MaaInfo struct {
	MFWVersion               string   `json:"mfwVersion"`
	SupportedControllers     []string `json:"supportedControllers"`
	SupportedTaskerAPIs      []string `json:"supportedTaskerApis"`
	SupportedResourceAPIs    []string `json:"supportedResourceApis"`
	SupportedAgentTransports []string `json:"supportedAgentTransports"`
}

type NodeTarget struct {
	FileID      string `json:"fileId"`
	NodeID      string `json:"nodeId"`
	RuntimeName string `json:"runtimeName"`
}

type RunProfile struct {
	ID            string                 `json:"id"`
	Name          string                 `json:"name"`
	Interfaces    []ProfileInterface     `json:"interfaces"`
	ResourcePaths []string               `json:"resourcePaths"`
	Controller    ControllerProfile      `json:"controller"`
	Agents        []AgentProfile         `json:"agents"`
	Entry         NodeTarget             `json:"entry"`
	SavePolicy    string                 `json:"savePolicy"`
	MaaOptions    map[string]interface{} `json:"maaOptions"`
}

type ProfileInterface struct {
	ID      string `json:"id"`
	Path    string `json:"path"`
	Enabled bool   `json:"enabled"`
}

type ControllerProfile struct {
	Type    string                 `json:"type"`
	Options map[string]interface{} `json:"options"`
}

type AgentProfile struct {
	ID            string            `json:"id"`
	Enabled       bool              `json:"enabled"`
	Transport     string            `json:"transport"`
	LaunchMode    string            `json:"launchMode,omitempty"`
	Identifier    string            `json:"identifier,omitempty"`
	TCPPort       int               `json:"tcpPort,omitempty"`
	BindResources []string          `json:"bindResources,omitempty"`
	TimeoutMS     int               `json:"timeoutMs,omitempty"`
	Required      *bool             `json:"required,omitempty"`
	ChildExec     string            `json:"childExec,omitempty"`
	ChildArgs     []string          `json:"childArgs,omitempty"`
	WorkingDir    string            `json:"workingDirectory,omitempty"`
	Env           map[string]string `json:"env,omitempty"`
}

type GraphSnapshot struct {
	GeneratedAt string              `json:"generatedAt"`
	RootFileID  string              `json:"rootFileId"`
	Files       []GraphFileSnapshot `json:"files"`
}

type GraphFileSnapshot struct {
	FileID       string                 `json:"fileId"`
	Path         string                 `json:"path,omitempty"`
	RelativePath string                 `json:"relativePath,omitempty"`
	Pipeline     map[string]interface{} `json:"pipeline"`
	Config       map[string]interface{} `json:"config,omitempty"`
	Dirty        bool                   `json:"dirty,omitempty"`
}

type NodeResolverSnapshot struct {
	GeneratedAt string                     `json:"generatedAt"`
	RootFileID  string                     `json:"rootFileId"`
	Nodes       []NodeResolverSnapshotNode `json:"nodes"`
	Edges       []NodeResolverSnapshotEdge `json:"edges"`
}

type NodeResolverSnapshotNode struct {
	FileID      string            `json:"fileId"`
	NodeID      string            `json:"nodeId"`
	RuntimeName string            `json:"runtimeName"`
	DisplayName string            `json:"displayName"`
	Prefix      string            `json:"prefix,omitempty"`
	SourcePath  string            `json:"sourcePath,omitempty"`
	FieldMap    map[string]string `json:"fieldMap,omitempty"`
}

type NodeResolverSnapshotEdge struct {
	EdgeID          string `json:"edgeId"`
	FromRuntimeName string `json:"fromRuntimeName"`
	ToRuntimeName   string `json:"toRuntimeName"`
	Reason          string `json:"reason"`
}

type PipelineOverride struct {
	RuntimeName string                 `json:"runtimeName"`
	Pipeline    map[string]interface{} `json:"pipeline"`
}

type ArtifactPolicy struct {
	IncludeRawImage     bool `json:"includeRawImage"`
	IncludeDrawImage    bool `json:"includeDrawImage"`
	IncludeActionDetail bool `json:"includeActionDetail"`
}

type RunInput struct {
	ImagePath         string `json:"imagePath,omitempty"`
	ImageRelativePath string `json:"imageRelativePath,omitempty"`
	ConfirmAction     bool   `json:"confirmAction,omitempty"`
}

type RunRequest struct {
	SessionID        string               `json:"sessionId,omitempty"`
	ProfileID        string               `json:"profileId,omitempty"`
	Profile          RunProfile           `json:"profile"`
	Mode             RunMode              `json:"mode"`
	GraphSnapshot    GraphSnapshot        `json:"graphSnapshot"`
	ResolverSnapshot NodeResolverSnapshot `json:"resolverSnapshot"`
	Target           *NodeTarget          `json:"target,omitempty"`
	Overrides        []PipelineOverride   `json:"overrides,omitempty"`
	ArtifactPolicy   *ArtifactPolicy      `json:"artifactPolicy,omitempty"`
	Input            *RunInput            `json:"input,omitempty"`
}

type RunStopRequest struct {
	SessionID string `json:"sessionId"`
	RunID     string `json:"runId,omitempty"`
	Reason    string `json:"reason,omitempty"`
}

type ArtifactGetRequest struct {
	SessionID  string `json:"sessionId"`
	ArtifactID string `json:"artifactId"`
}

type ScreenshotCaptureRequest struct {
	SessionID    string `json:"sessionId,omitempty"`
	ControllerID string `json:"controllerId,omitempty"`
	Force        bool   `json:"force,omitempty"`
}

type ScreenshotStreamStartRequest struct {
	SessionID    string `json:"sessionId,omitempty"`
	RunID        string `json:"runId,omitempty"`
	ControllerID string `json:"controllerId,omitempty"`
	IntervalMS   int    `json:"intervalMs,omitempty"`
	Force        bool   `json:"force,omitempty"`
	MaxFrames    int    `json:"maxFrames,omitempty"`
}

type ScreenshotStreamStopRequest struct {
	SessionID string `json:"sessionId"`
	RunID     string `json:"runId,omitempty"`
	Reason    string `json:"reason,omitempty"`
}

type ScreenshotStreamStatus struct {
	SessionID    string `json:"sessionId"`
	RunID        string `json:"runId,omitempty"`
	ControllerID string `json:"controllerId,omitempty"`
	IntervalMS   int    `json:"intervalMs,omitempty"`
	Force        bool   `json:"force,omitempty"`
	Active       bool   `json:"active"`
	FrameCount   int64  `json:"frameCount,omitempty"`
	StartedAt    string `json:"startedAt,omitempty"`
	StoppedAt    string `json:"stoppedAt,omitempty"`
	Reason       string `json:"reason,omitempty"`
}

type InterfaceImportRequest struct {
	Path string `json:"path"`
}

type InterfaceImportResult struct {
	Profile     RunProfile                  `json:"profile"`
	EntryName   string                      `json:"entryName,omitempty"`
	Diagnostics []Diagnostic                `json:"diagnostics,omitempty"`
	Selections  InterfaceImportSelections   `json:"selections,omitempty"`
	Controllers []InterfaceImportController `json:"controllers,omitempty"`
	Resources   []InterfaceImportResource   `json:"resources,omitempty"`
	Tasks       []InterfaceImportTask       `json:"tasks,omitempty"`
	Presets     []InterfaceImportPreset     `json:"presets,omitempty"`
	Options     []InterfaceImportOption     `json:"options,omitempty"`
	Overrides   []PipelineOverride          `json:"overrides,omitempty"`
}

type InterfaceImportSelections struct {
	ControllerName string                 `json:"controllerName,omitempty"`
	ResourceName   string                 `json:"resourceName,omitempty"`
	TaskName       string                 `json:"taskName,omitempty"`
	PresetName     string                 `json:"presetName,omitempty"`
	OptionValues   map[string]interface{} `json:"optionValues,omitempty"`
}

type InterfaceImportController struct {
	Name                string                 `json:"name"`
	Label               string                 `json:"label,omitempty"`
	Type                string                 `json:"type"`
	AttachResourcePaths []string               `json:"attachResourcePaths,omitempty"`
	Options             []string               `json:"options,omitempty"`
	Raw                 map[string]interface{} `json:"raw,omitempty"`
}

type InterfaceImportResource struct {
	Name        string                 `json:"name"`
	Label       string                 `json:"label,omitempty"`
	Paths       []string               `json:"paths,omitempty"`
	Controllers []string               `json:"controllers,omitempty"`
	Options     []string               `json:"options,omitempty"`
	Raw         map[string]interface{} `json:"raw,omitempty"`
}

type InterfaceImportTask struct {
	Name             string                 `json:"name"`
	Label            string                 `json:"label,omitempty"`
	Entry            string                 `json:"entry,omitempty"`
	DefaultCheck     bool                   `json:"defaultCheck,omitempty"`
	Resources        []string               `json:"resources,omitempty"`
	Controllers      []string               `json:"controllers,omitempty"`
	Options          []string               `json:"options,omitempty"`
	PipelineOverride map[string]interface{} `json:"pipelineOverride,omitempty"`
}

type InterfaceImportPreset struct {
	Name  string                      `json:"name"`
	Label string                      `json:"label,omitempty"`
	Tasks []InterfaceImportPresetTask `json:"tasks,omitempty"`
}

type InterfaceImportPresetTask struct {
	Name    string                 `json:"name"`
	Enabled *bool                  `json:"enabled,omitempty"`
	Option  map[string]interface{} `json:"option,omitempty"`
}

type InterfaceImportOption struct {
	Name             string                       `json:"name"`
	Label            string                       `json:"label,omitempty"`
	Type             string                       `json:"type,omitempty"`
	Controllers      []string                     `json:"controllers,omitempty"`
	Resources        []string                     `json:"resources,omitempty"`
	DefaultValue     interface{}                  `json:"defaultValue,omitempty"`
	Cases            []InterfaceImportOptionCase  `json:"cases,omitempty"`
	Inputs           []InterfaceImportOptionInput `json:"inputs,omitempty"`
	PipelineOverride map[string]interface{}       `json:"pipelineOverride,omitempty"`
}

type InterfaceImportOptionCase struct {
	Name             string                 `json:"name"`
	Label            string                 `json:"label,omitempty"`
	Options          []string               `json:"options,omitempty"`
	PipelineOverride map[string]interface{} `json:"pipelineOverride,omitempty"`
}

type InterfaceImportOptionInput struct {
	Name         string `json:"name"`
	Label        string `json:"label,omitempty"`
	Default      string `json:"default,omitempty"`
	PipelineType string `json:"pipelineType,omitempty"`
	Verify       string `json:"verify,omitempty"`
	PatternMsg   string `json:"patternMsg,omitempty"`
}

type ArtifactRef struct {
	ID        string `json:"id"`
	SessionID string `json:"sessionId"`
	Type      string `json:"type"`
	Mime      string `json:"mime"`
	Size      int64  `json:"size,omitempty"`
	CreatedAt string `json:"createdAt"`
	EventSeq  int64  `json:"eventSeq,omitempty"`
}

type ArtifactPayload struct {
	Ref      ArtifactRef `json:"ref"`
	Encoding string      `json:"encoding,omitempty"`
	Content  string      `json:"content,omitempty"`
	Data     interface{} `json:"data,omitempty"`
}

type Diagnostic struct {
	Severity   string                 `json:"severity"`
	Code       string                 `json:"code"`
	Message    string                 `json:"message"`
	FileID     string                 `json:"fileId,omitempty"`
	NodeID     string                 `json:"nodeId,omitempty"`
	FieldPath  string                 `json:"fieldPath,omitempty"`
	SourcePath string                 `json:"sourcePath,omitempty"`
	Data       map[string]interface{} `json:"data,omitempty"`
}

type Event struct {
	SessionID     string                 `json:"sessionId"`
	RunID         string                 `json:"runId"`
	Seq           int64                  `json:"seq"`
	Timestamp     string                 `json:"timestamp"`
	Source        string                 `json:"source"`
	Kind          string                 `json:"kind"`
	MaaFWMessage  string                 `json:"maafwMessage,omitempty"`
	Phase         string                 `json:"phase,omitempty"`
	Status        string                 `json:"status,omitempty"`
	TaskID        int64                  `json:"taskId,omitempty"`
	Node          *EventNode             `json:"node,omitempty"`
	Edge          *EventEdge             `json:"edge,omitempty"`
	DetailRef     string                 `json:"detailRef,omitempty"`
	ScreenshotRef string                 `json:"screenshotRef,omitempty"`
	Data          map[string]interface{} `json:"data,omitempty"`
}

type EventNode struct {
	RuntimeName string `json:"runtimeName"`
	FileID      string `json:"fileId,omitempty"`
	NodeID      string `json:"nodeId,omitempty"`
	Label       string `json:"label,omitempty"`
}

type EventEdge struct {
	FromRuntimeName string `json:"fromRuntimeName,omitempty"`
	ToRuntimeName   string `json:"toRuntimeName,omitempty"`
	EdgeID          string `json:"edgeId,omitempty"`
	Reason          string `json:"reason,omitempty"`
}

func IsValidRunMode(mode RunMode) bool {
	switch mode {
	case RunModeFullRun,
		RunModeRunFromNode,
		RunModeSingleNodeRun,
		RunModeRecognitionOnly,
		RunModeActionOnly,
		RunModeFixedImageRecognition,
		RunModeReplay:
		return true
	default:
		return false
	}
}

func RunModeRequiresTarget(mode RunMode) bool {
	switch mode {
	case RunModeRunFromNode,
		RunModeSingleNodeRun,
		RunModeRecognitionOnly,
		RunModeActionOnly,
		RunModeFixedImageRecognition:
		return true
	default:
		return false
	}
}
