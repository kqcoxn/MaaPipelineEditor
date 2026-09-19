package projectinterface

import (
	"os"
	"path/filepath"
	"testing"
)

func taskSnapshot(t *testing.T) *ProjectSnapshot {
	t.Helper()
	root := t.TempDir()
	if err := os.Mkdir(filepath.Join(root, "resource"), 0755); err != nil {
		t.Fatal(err)
	}
	return &ProjectSnapshot{ProjectID: "project", Revision: "r1", InterfaceRoot: root, Document: map[string]any{
		"controller":    []any{map[string]any{"name": "c", "type": "Adb", "option": []any{"mode"}}},
		"resource":      []any{map[string]any{"name": "r", "path": []any{"resource"}, "option": []any{"mode"}}},
		"global_option": []any{"mode"},
		"task":          []any{map[string]any{"name": "daily", "entry": "Start", "option": []any{"mode"}, "pipeline_override": map[string]any{"Start": map[string]any{"timeout": 1.}}}},
		"option": map[string]any{"mode": map[string]any{"type": "select", "default_case": "a", "cases": []any{
			map[string]any{"name": "a", "pipeline_override": map[string]any{"Start": map[string]any{"timeout": 2.}}},
			map[string]any{"name": "b", "pipeline_override": map[string]any{"Start": map[string]any{"timeout": 3.}}},
		}}},
	}}
}

func TestTaskScopesAndOverrideOrder(t *testing.T) {
	snapshot := taskSnapshot(t)
	plan, err := snapshot.ResolveContext(ContextRequest{RequestID: "req1", Revision: "r1", TaskName: "daily", ControllerName: "c", ResourceName: "r", OptionValues: map[string]any{
		"global": map[string]any{"mode": "b"}, "task": map[string]any{"mode": "b"},
	}})
	if err != nil {
		t.Fatal(err)
	}
	if plan.ContextID == "" || plan.Entry != "Start" || plan.RequestID != "req1" {
		t.Fatalf("unexpected plan: %#v", plan)
	}
	for i, want := range []float64{1, 3, 2, 2, 3} {
		if got := objectMap(plan.PipelineOverrides[i]["pipeline"])["timeout"]; got != want {
			t.Fatalf("override %d = %v, want %v", i, got, want)
		}
	}
	if objectMap(plan.OptionValues["resource"])["mode"] != "a" {
		t.Fatal("global value leaked into resource scope")
	}
	environment, err := snapshot.ResolveContext(ContextRequest{ControllerName: "c", ResourceName: "r"})
	if err != nil || environment.TaskName != "" || len(environment.PipelineOverrides) != 3 {
		t.Fatalf("environment context changed: %#v %v", environment, err)
	}
}

func TestInvalidTaskInputRetainsEditableTreeWithoutRuntime(t *testing.T) {
	snapshot := taskSnapshot(t)
	objectMap(snapshot.Document["option"])["mode"] = map[string]any{"type": "input", "inputs": []any{map[string]any{"name": "count", "pipeline_type": "int", "default": "1", "verify": "^[0-9]+$"}}, "pipeline_override": map[string]any{"Start": map[string]any{"timeout": "{count}"}}}
	plan, err := snapshot.ResolveContext(ContextRequest{TaskName: "daily", OptionValues: map[string]any{"task": map[string]any{"mode": map[string]any{"count": "bad"}}}})
	if err != nil {
		t.Fatal(err)
	}
	if plan.ContextID != "" || len(plan.PipelineOverrides) != 0 || !hasErrorDiagnostics(plan.Diagnostics) {
		t.Fatalf("invalid plan is runnable: %#v", plan)
	}
	if len(plan.OptionGroups[3].Nodes) != 1 || objectMap(objectMap(plan.OptionValues["task"])["mode"])["count"] != "bad" {
		t.Fatal("invalid input vanished")
	}
}

func TestTaskMissingAndRestrictedNeverFallBack(t *testing.T) {
	snapshot := taskSnapshot(t)
	for _, name := range []string{"missing", "daily"} {
		objectArray(snapshot.Document["task"])[0]["controller"] = []any{"other"}
		plan, err := snapshot.ResolveContext(ContextRequest{TaskName: name})
		if err != nil || plan.ContextID != "" || !hasErrorDiagnostics(plan.Diagnostics) {
			t.Fatalf("task %s was accepted: %#v %v", name, plan, err)
		}
	}
	if _, err := snapshot.ResolveContext(ContextRequest{Revision: "old"}); err == nil {
		t.Fatal("stale revision accepted")
	}
	if _, err := snapshot.ResolveContext(ContextRequest{ControllerName: "missing"}); err == nil {
		t.Fatal("unknown controller silently replaced")
	}
}

func TestTaskNestedOptionsOnlyApplyActiveBranch(t *testing.T) {
	snapshot := taskSnapshot(t)
	definitions := objectMap(snapshot.Document["option"])
	objectArray(objectMap(definitions["mode"])["cases"])[1]["option"] = []any{"child"}
	definitions["child"] = map[string]any{"type": "input", "inputs": []any{map[string]any{"name": "count", "default": "9", "pipeline_type": "int"}}, "pipeline_override": map[string]any{"Start": map[string]any{"timeout": "{count}"}}}
	plan, err := snapshot.ResolveContext(ContextRequest{TaskName: "daily", OptionValues: map[string]any{"task": map[string]any{"mode": "b"}}})
	if err != nil || plan.ContextID == "" {
		t.Fatalf("failed: %#v %v", plan, err)
	}
	if len(plan.OptionGroups[3].Nodes[0].Children) != 1 || len(plan.OptionGroups[0].Nodes[0].Children) != 0 {
		t.Fatal("nested scope activation incorrect")
	}
	definitions["child"].(map[string]any)["resource"] = []any{"other"}
	plan, _ = snapshot.ResolveContext(ContextRequest{TaskName: "daily", OptionValues: map[string]any{"task": map[string]any{"mode": "b"}}})
	if len(plan.PipelineOverrides) != 5 || len(plan.OptionGroups[3].Nodes[0].Children) != 0 {
		t.Fatal("inapplicable nested option produced override")
	}
}

func TestTaskPasswordAndCheckboxRemainEditableButCannotRun(t *testing.T) {
	snapshot := taskSnapshot(t)
	definitions := objectMap(snapshot.Document["option"])
	definitions["mode"] = map[string]any{"type": "checkbox", "min_count": 1., "cases": []any{map[string]any{"name": "a"}}}
	plan, _ := snapshot.ResolveContext(ContextRequest{TaskName: "daily"})
	if plan.ContextID != "" || len(plan.OptionGroups[3].Nodes) != 1 {
		t.Fatal("incomplete checkbox should render but not run")
	}
	definitions["mode"] = map[string]any{"type": "input", "inputs": []any{map[string]any{"name": "secret", "password": true}}, "pipeline_override": map[string]any{"Start": map[string]any{"custom_action_param": "{secret}"}}}
	plan, _ = snapshot.ResolveContext(ContextRequest{TaskName: "daily", OptionValues: map[string]any{"task": map[string]any{"mode": map[string]any{"secret": "sensitive"}}}})
	if plan.ContextID != "" || len(plan.PipelineOverrides) != 0 {
		t.Fatal("password must not reach runtime overrides")
	}
}

func TestDuplicateTaskNamesAreDiagnosed(t *testing.T) {
	snapshot := taskSnapshot(t)
	snapshot.Document["task"] = append(anySlice(snapshot.Document["task"]), objectArray(snapshot.Document["task"])[0])
	diagnostics := (&loader{}).validateSemantics(filepath.Join(snapshot.InterfaceRoot, "interface.json"), snapshot.InterfaceRoot, snapshot.Document)
	if !hasErrorDiagnostics(diagnostics) {
		t.Fatal("duplicate task identity accepted")
	}
}
