package projectinterface

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

func TestPretaskHelperProcess(t *testing.T) {
	for i, arg := range os.Args {
		if arg == "--pi-record" {
			cwd, _ := os.Getwd()
			record, _ := json.Marshal(map[string]string{"name": os.Args[i+2], "options": os.Args[len(os.Args)-1], "cwd": cwd, "userData": os.Getenv("PI_USER_DATA_DIR"), "version": os.Getenv("PI_INTERFACE_VERSION")})
			file, err := os.OpenFile(os.Args[i+1], os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0600)
			if err != nil {
				os.Exit(2)
			}
			_, err = file.Write(append(record, '\n'))
			file.Close()
			if err != nil {
				os.Exit(3)
			}
			os.Exit(0)
		}
		if arg == "--pi-helper" {
			fmt.Fprintln(os.Stdout, "预任务原始输出")
			if err := os.WriteFile(os.Args[i+1], []byte(os.Args[len(os.Args)-1]), 0600); err != nil {
				os.Exit(2)
			}
			os.Exit(0)
		}
	}
}

func TestSelectedPretasksKeepOrderOptionsAndEnvironment(t *testing.T) {
	executable, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	root := t.TempDir()
	program := func(name string) map[string]any {
		return map[string]any{
			"name": name, "exec": executable, "args": []any{"-test.run=TestPretaskHelperProcess", "--", "--pi-record", "records.jsonl", name}, "option": []any{"path"},
		}
	}
	first, second, disabled, filtered := program("first"), program("second"), program("disabled"), program("filtered")
	filtered["controller"] = []any{"other"}
	snapshot := &ProjectSnapshot{ProjectID: "p", Revision: "r", InterfaceRoot: root, Document: map[string]any{
		"controller": []any{map[string]any{"name": "c", "type": "Adb"}}, "resource": []any{map[string]any{"name": "r", "path": []any{"."}}},
		"pretask": []any{first, second, disabled, filtered},
		"option":  map[string]any{"path": map[string]any{"type": "input", "inputs": []any{map[string]any{"name": "file", "input_type": "file", "verify": `\.json$`, "pattern_msg": "请输入 JSON 文件"}}}},
	}}
	values := map[string]any{"second": map[string]any{"path": map[string]any{"file": `C:\数据\second.json`}}, "first": map[string]any{"path": map[string]any{"file": `C:\数据\first.json`}}}
	req := ContextRequest{Purpose: "interface", Revision: "r", ControllerName: "c", ResourceName: "r", OptionValues: map[string]any{"pretask": values}, PretaskEnabled: map[string]bool{"disabled": false}}
	plan, err := snapshot.ResolveContext(req)
	if err != nil || plan.ContextID == "" {
		t.Fatalf("resolve: %v %#v", err, plan)
	}
	if !snapshot.HasPretasks(plan) {
		t.Fatal("selected pretasks missing")
	}
	if len(plan.PipelineOverrides) != 0 {
		t.Fatal("pretask values leaked into pipeline")
	}
	if err := snapshot.RunPretasks(context.Background(), plan, func(string) {}, RuntimeEnvironment(plan, "test", "5.15.0")); err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile(filepath.Join(root, "records.jsonl"))
	if err != nil {
		t.Fatal(err)
	}
	lines := strings.Split(strings.TrimSpace(string(raw)), "\n")
	if len(lines) != 2 {
		t.Fatalf("disabled or filtered program executed: %s", raw)
	}
	for i, name := range []string{"first", "second"} {
		var record map[string]string
		if err := json.Unmarshal([]byte(lines[i]), &record); err != nil {
			t.Fatal(err)
		}
		if record["name"] != name || record["cwd"] != root || !filepath.IsAbs(record["userData"]) || record["version"] != "v2.11.0" {
			t.Fatalf("bad execution: %#v", record)
		}
		var options map[string]any
		if err := json.Unmarshal([]byte(record["options"]), &options); err != nil {
			t.Fatal(err)
		}
		if !reflect.DeepEqual(options, values[name]) {
			t.Fatalf("options crossed pretask boundaries: %#v", options)
		}
	}
	objectMap(objectMap(values["first"])["path"])["file"] = "invalid.txt"
	invalid, _ := snapshot.ResolveContext(req)
	if invalid.ContextID != "" {
		t.Fatal("invalid selected path accepted")
	}
	req.PretaskEnabled = map[string]bool{"first": false, "second": false, "disabled": false}
	none, _ := snapshot.ResolveContext(req)
	if none.ContextID == "" || snapshot.HasPretasks(none) {
		t.Fatal("disabled pretask validation or preparation still required")
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
	var output []string
	if err = snapshot.RunPretasks(context.Background(), plan, func(line string) { output = append(output, strings.TrimSuffix(line, "\r")) }, nil); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(output, []string{"预任务原始输出"}) {
		t.Fatalf("pretask output includes generated messages: %#v", output)
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
	if err = snapshot.RunPretasks(ctx, plan, func(string) {}, nil); err != context.Canceled {
		t.Fatal(err)
	}
	program := objectArray(snapshot.Document["pretask"])[0]
	program["controller"] = []any{"other"}
	if snapshot.HasPretasks(plan) {
		t.Fatal("inapplicable pretask enabled")
	}
	program["controller"] = nil
	program["exec"] = "not-a-real-mpe-test-program"
	if err = snapshot.RunPretasks(context.Background(), plan, func(string) {}, nil); err == nil || !strings.Contains(err.Error(), "失败") {
		t.Fatal("failed program accepted")
	}
}
