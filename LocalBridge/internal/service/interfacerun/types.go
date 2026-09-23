package interfacerun

import pi "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/service/projectinterface"

const EventState = "interface.run.state"

type Request struct {
	RequestID     string              `json:"requestId"`
	ProjectID     string              `json:"projectId"`
	ControllerID  string              `json:"controllerId"`
	PreparationID string              `json:"preparationId,omitempty"`
	Tasks         []pi.ContextRequest `json:"tasks"`
}
type Item struct {
	Name   string `json:"name"`
	Label  string `json:"label"`
	Entry  string `json:"entry"`
	Status string `json:"status"`
}
type Log struct {
	Sequence int    `json:"sequence"`
	Time     string `json:"time"`
	Message  string `json:"message"`
}
type State struct {
	ControllerName string `json:"controllerName"`
	ResourceName   string `json:"resourceName"`
	RunID          string `json:"runId"`
	RequestID      string `json:"requestId"`
	ProjectID      string `json:"projectId"`
	Revision       string `json:"revision"`
	ControllerID   string `json:"controllerId"`
	Status         string `json:"status"`
	Error          string `json:"error,omitempty"`
	Items          []Item `json:"items"`
	Logs           []Log  `json:"logs"`
	Sequence       int    `json:"sequence"`
	StartedAt      string `json:"startedAt"`
}

func Active(status string) bool {
	return status == "preparing" || status == "running" || status == "stopping"
}
