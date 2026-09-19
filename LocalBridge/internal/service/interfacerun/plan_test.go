package interfacerun

import (
	pi "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/service/projectinterface"
	"testing"
)

func TestRunPlanRejectsStaleDuplicateAndIncompatibleTasks(t *testing.T) {
	snapshot := &pi.ProjectSnapshot{ProjectID: "p", Revision: "r", InterfaceRoot: t.TempDir(), Document: map[string]any{
		"controller": []any{map[string]any{"name": "mac", "type": "MacOS"}},
		"resource":   []any{map[string]any{"name": "base", "path": []any{"."}}},
		"task":       []any{map[string]any{"name": "a", "entry": "DynamicEntry", "pipeline_override": map[string]any{"DynamicEntry": map[string]any{"timeout": 321}}}, map[string]any{"name": "b", "entry": "B", "controller": []any{"other"}}},
	}}
	request := Request{ProjectID: "p", Tasks: []pi.ContextRequest{{TaskName: "a", Revision: "r", ControllerName: "mac", ResourceName: "base"}}}
	plans, _, err := resolveSnapshot(snapshot, request)
	if err != nil || plans[0].Entry != "DynamicEntry" {
		t.Fatalf("source-free entry failed: %v", err)
	}
	if mergeOverrides(plans[0].PipelineOverrides)["DynamicEntry"].(map[string]any)["timeout"] != float64(321) {
		t.Fatal("resolved task override was not applied")
	}
	stale := request
	stale.ProjectID = "other"
	if _, _, err = resolveSnapshot(snapshot, stale); err == nil {
		t.Fatal("stale project accepted")
	}
	duplicate := request
	duplicate.Tasks = append(duplicate.Tasks, duplicate.Tasks[0])
	if _, _, err = resolveSnapshot(snapshot, duplicate); err == nil {
		t.Fatal("duplicate tasks accepted")
	}
	for _, name := range []string{"missing", "b"} {
		invalid := request
		invalid.Tasks = []pi.ContextRequest{{TaskName: name, Revision: "r", ControllerName: "mac", ResourceName: "base"}}
		if _, _, err = resolveSnapshot(snapshot, invalid); err == nil {
			t.Fatalf("invalid task accepted: %s", name)
		}
	}
	stale = request
	stale.Tasks = []pi.ContextRequest{{TaskName: "a", Revision: "old"}}
	if _, _, err = resolveSnapshot(snapshot, stale); err == nil {
		t.Fatal("stale revision accepted")
	}
}
func TestPreparationKeyIgnoresTaskButTracksEnvironment(t *testing.T) {
	a := &pi.RuntimePlan{ProjectID: "p", Revision: "r", ControllerName: "c", ResourceName: "resource", TaskName: "a", OptionValues: map[string]any{"pretask": map[string]any{"mode": "x"}, "task": map[string]any{"x": 1}}}
	b := *a
	b.TaskName = "b"
	if preparationKey(a) != preparationKey(&b) {
		t.Fatal("task browsing invalidates preparation")
	}
	b.Revision = "new"
	if preparationKey(a) == preparationKey(&b) {
		t.Fatal("stale preparation accepted")
	}
}
