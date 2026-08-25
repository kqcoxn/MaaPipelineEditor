package projectinterface

import "github.com/tailscale/hujson"

type State string

const (
	StateNotFound State = "not_found"
	StateMultiple State = "multiple"
	StateInvalid  State = "invalid"
	StateReady    State = "ready"
)

type Diagnostic struct {
	Severity  string         `json:"severity"`
	Category  string         `json:"category"`
	Code      string         `json:"code"`
	Message   string         `json:"message"`
	File      string         `json:"file,omitempty"`
	Pointer   string         `json:"pointer,omitempty"`
	Line      int            `json:"line,omitempty"`
	Column    int            `json:"column,omitempty"`
	EndLine   int            `json:"endLine,omitempty"`
	EndColumn int            `json:"endColumn,omitempty"`
	Data      map[string]any `json:"data,omitempty"`
}

type SourceLocation struct {
	File      string `json:"file"`
	Line      int    `json:"line"`
	Column    int    `json:"column"`
	EndLine   int    `json:"endLine"`
	EndColumn int    `json:"endColumn"`
}

type SourceDocument struct {
	Path string
	Raw  []byte
	AST  hujson.Value
	Data map[string]any
}

type ProjectSnapshot struct {
	ProjectID     string                    `json:"projectId"`
	EntryPath     string                    `json:"entryPath"`
	ProjectRoot   string                    `json:"projectRoot"`
	InterfaceRoot string                    `json:"interfaceRoot"`
	Revision      string                    `json:"revision"`
	Language      string                    `json:"language,omitempty"`
	Document      map[string]any            `json:"document"`
	Provenance    map[string]SourceLocation `json:"provenance,omitempty"`
	Diagnostics   []Diagnostic              `json:"diagnostics,omitempty"`
	Sources       []string                  `json:"sources"`
	documents     map[string]*SourceDocument
}

type Status struct {
	State          State        `json:"state"`
	Mode           string       `json:"mode"`
	ConfiguredPath string       `json:"configuredPath,omitempty"`
	EffectivePath  string       `json:"effectivePath,omitempty"`
	Candidates     []string     `json:"candidates,omitempty"`
	ProjectID      string       `json:"projectId,omitempty"`
	Revision       string       `json:"revision,omitempty"`
	Diagnostics    []Diagnostic `json:"diagnostics,omitempty"`
	HasLastGood    bool         `json:"hasLastGood"`
}

type ContextRequest struct {
	Revision       string                          `json:"revision"`
	Language       string                          `json:"language,omitempty"`
	ControllerName string                          `json:"controllerName"`
	ResourceName   string                          `json:"resourceName"`
	OptionValues   map[string]any                  `json:"optionValues,omitempty"`
	AgentEnabled   map[string]bool                 `json:"agentEnabled,omitempty"`
	AgentOverrides map[string]AgentCommandOverride `json:"agentOverrides,omitempty"`
}

type AgentCommandOverride struct {
	ChildExec string   `json:"childExec"`
	ChildArgs []string `json:"childArgs,omitempty"`
}

type AgentPlan struct {
	Index      int      `json:"index"`
	ID         string   `json:"id"`
	Enabled    bool     `json:"enabled"`
	ChildExec  string   `json:"childExec"`
	ChildArgs  []string `json:"childArgs,omitempty"`
	Identifier string   `json:"identifier,omitempty"`
}

type RuntimePlan struct {
	ContextID         string           `json:"contextId"`
	ProjectID         string           `json:"projectId"`
	Revision          string           `json:"revision"`
	Language          string           `json:"language"`
	ProjectRoot       string           `json:"projectRoot"`
	InterfaceRoot     string           `json:"interfaceRoot"`
	ProjectVersion    string           `json:"projectVersion,omitempty"`
	ControllerName    string           `json:"controllerName"`
	ResourceName      string           `json:"resourceName"`
	Controller        map[string]any   `json:"controller"`
	Resource          map[string]any   `json:"resource"`
	ResourcePaths     []string         `json:"resourcePaths"`
	Options           map[string]any   `json:"options,omitempty"`
	OptionValues      map[string]any   `json:"optionValues,omitempty"`
	PipelineOverrides []map[string]any `json:"pipelineOverrides,omitempty"`
	Agents            []AgentPlan      `json:"agents,omitempty"`
}

type ChangeEvent struct {
	Status Status `json:"status"`
}
