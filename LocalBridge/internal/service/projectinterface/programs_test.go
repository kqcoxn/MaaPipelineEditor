package projectinterface

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestPretaskHelperProcess(t *testing.T) {
	for i, arg := range os.Args {
		if arg == "--pi-helper" {
			if err := os.WriteFile(os.Args[i+1], []byte(os.Args[len(os.Args)-1]), 0600); err != nil {
				os.Exit(2)
			}
			os.Exit(0)
		}
	}
}
func TestPretaskArgumentsWorkingDirectoryAndNoOverrides(t *testing.T) {
	executable, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	root := t.TempDir()
	snapshot := &ProjectSnapshot{ProjectID: "p", Revision: "r", InterfaceRoot: root, Document: map[string]any{
		"controller": []any{map[string]any{"name": "c", "type": "Adb"}}, "resource": []any{map[string]any{"name": "r", "path": []any{"."}}},
		"pretask": []any{map[string]any{"exec": executable, "args": []any{"-test.run=TestPretaskHelperProcess", "--", "--pi-helper", "args.json"}, "option": []any{"text"}}},
		"option":  map[string]any{"text": map[string]any{"type": "input", "inputs": []any{map[string]any{"name": "count", "default": "3", "pipeline_type": "int"}}, "pipeline_override": map[string]any{"Forbidden": map[string]any{"timeout": 1}}}},
	}}
	plan, err := snapshot.ResolveContext(ContextRequest{Purpose: "interface", Revision: "r", ControllerName: "c", ResourceName: "r"})
	if err != nil || plan.ContextID == "" {
		t.Fatalf("%v %#v", err, plan)
	}
	if len(plan.PipelineOverrides) != 0 {
		t.Fatal("pretask option leaked into pipeline")
	}
	if err = snapshot.RunPretasks(context.Background(), plan, func(string) {}); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(filepath.Join(root, "args.json"))
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != `{"text":{"count":"3"}}` {
		t.Fatalf("not raw compact option JSON: %s", data)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err = snapshot.RunPretasks(ctx, plan, func(string) {}); err != context.Canceled {
		t.Fatal(err)
	}
	program := objectArray(snapshot.Document["pretask"])[0]
	program["controller"] = []any{"other"}
	if snapshot.HasPretasks(plan) {
		t.Fatal("inapplicable pretask enabled")
	}
	program["controller"] = nil
	program["exec"] = "not-a-real-mpe-test-program"
	if err = snapshot.RunPretasks(context.Background(), plan, func(string) {}); err == nil || !strings.Contains(err.Error(), "失败") {
		t.Fatal("failed program accepted")
	}
}
