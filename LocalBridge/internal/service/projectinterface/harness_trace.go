package projectinterface

import (
	"fmt"
	"strings"
)

// Tracing observes the production resolver; it never contributes overrides.
type optionTrace struct {
	scope  string
	Events []HarnessOverride
}
type HarnessOverride struct {
	Scope    string `json:"scope"`
	Option   string `json:"option,omitempty"`
	Pointer  string `json:"pointer"`
	File     string `json:"file"`
	Version  string `json:"version"`
	Active   bool   `json:"active"`
	Reason   string `json:"reason,omitempty"`
	Raw      any    `json:"raw,omitempty"`
	Resolved any    `json:"resolved,omitempty"`
}

func traceEvent(traces []*optionTrace, name, pointer string, raw any, replacements map[string]any, active bool, reason string) {
	if raw == nil {
		pointer = strings.TrimSuffix(pointer, "/pipeline_override")
	}
	for _, t := range traces {
		var resolved []map[string]any
		if active {
			appendPipelineOverride(&resolved, raw, replacements)
		}
		var value any
		if len(resolved) > 0 {
			nodes := map[string]any{}
			for _, item := range resolved {
				name, _ := item["runtimeName"].(string)
				nodes[name] = item["pipeline"]
			}
			value = nodes
		}
		if t.scope == "pretask" {
			active = false
			reason = "预任务选项不参与 Pipeline 覆盖"
			value = nil
		}
		t.Events = append(t.Events, HarnessOverride{Scope: t.scope, Option: name, Pointer: pointer, Active: active, Reason: reason, Raw: raw, Resolved: value})
	}
}
func traceCase(traces []*optionTrace, name string, definition, selected map[string]any) {
	for i, c := range objectArray(definition["cases"]) {
		if c["name"] == selected["name"] {
			traceEvent(traces, name, fmt.Sprintf("/option/%s/cases/%d/pipeline_override", escapePointer(name), i), selected["pipeline_override"], nil, true, "")
			return
		}
	}
}
func traceInactive(traces []*optionTrace, definitions map[string]any, name, reason string, stack map[string]bool) {
	if len(traces) == 0 || stack[name] {
		return
	}
	stack[name] = true
	defer delete(stack, name)
	d := objectMap(definitions[name])
	if d == nil {
		return
	}
	pointer := "/option/" + escapePointer(name)
	sourcePointer := pointer
	if d["pipeline_override"] != nil {
		sourcePointer += "/pipeline_override"
	}
	traceEvent(traces, name, sourcePointer, d["pipeline_override"], nil, false, reason)
	for _, child := range stringSlice(d["option"]) {
		traceInactive(traces, definitions, child, reason, stack)
	}
	for i, c := range objectArray(d["cases"]) {
		traceEvent(traces, name, fmt.Sprintf("%s/cases/%d/pipeline_override", pointer, i), c["pipeline_override"], nil, false, reason)
		for _, child := range stringSlice(c["option"]) {
			traceInactive(traces, definitions, child, reason, stack)
		}
	}
}
func traceUnselected(traces []*optionTrace, definitions map[string]any, name string, d map[string]any, value any) {
	if len(traces) == 0 {
		return
	}
	selected := toStringValues(value)
	if v, ok := value.(string); ok {
		selected = []string{v}
	}
	for i, c := range objectArray(d["cases"]) {
		n, _ := c["name"].(string)
		if containsString(selected, n) {
			continue
		}
		traceEvent(traces, name, fmt.Sprintf("/option/%s/cases/%d/pipeline_override", escapePointer(name), i), c["pipeline_override"], nil, false, "分支未选中")
		for _, child := range stringSlice(c["option"]) {
			traceInactive(traces, definitions, child, "父分支未选中", map[string]bool{})
		}
	}
}
