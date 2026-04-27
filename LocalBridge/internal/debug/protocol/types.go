package protocol

const (
	Generation      = "debug-vNext"
	ProtocolVersion = "0.10.0"
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
	ID            string   `json:"id"`
	Enabled       bool     `json:"enabled"`
	Transport     string   `json:"transport"`
	Identifier    string   `json:"identifier,omitempty"`
	TCPPort       int      `json:"tcpPort,omitempty"`
	BindResources []string `json:"bindResources,omitempty"`
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
