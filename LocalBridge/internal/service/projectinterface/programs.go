package projectinterface

import (
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

func RuntimeEnvironment(plan *RuntimePlan, clientVersion, frameworkVersion string) map[string]string {
	controller, _ := json.Marshal(plan.Controller)
	resource, _ := json.Marshal(plan.Resource)
	return map[string]string{"PI_INTERFACE_VERSION": "v2.5.0", "PI_CLIENT_NAME": "MPE", "PI_CLIENT_VERSION": clientVersion, "PI_CLIENT_LANGUAGE": plan.Language, "PI_CLIENT_MAAFW_VERSION": frameworkVersion, "PI_VERSION": plan.ProjectVersion, "PI_CONTROLLER": string(controller), "PI_RESOURCE": string(resource)}
}
func applicablePrograms(doc map[string]any, controller, resource string) []map[string]any {
	values := objectArray(doc["pretask"])
	if value, ok := doc["pretask"].(map[string]any); ok {
		values = []map[string]any{value}
	}
	result := []map[string]any{}
	for _, value := range values {
		if optionApplicable(value, controller, resource) {
			result = append(result, value)
		}
	}
	return result
}
func (s *ProjectSnapshot) HasPretasks(plan *RuntimePlan) bool {
	return len(applicablePrograms(s.Document, plan.ControllerName, plan.ResourceName)) > 0
}
func (s *ProjectSnapshot) RunPretasks(ctx context.Context, plan *RuntimePlan, emit func(string)) error {
	definitions := objectMap(s.Document["option"])
	for _, program := range applicablePrograms(s.Document, plan.ControllerName, plan.ResourceName) {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		executable, _ := program["exec"].(string)
		if executable == "" {
			return fmt.Errorf("预任务缺少 exec")
		}
		args := append([]string{}, stringSlice(program["args"])...)
		refs := stringSlice(program["option"])
		if len(refs) > 0 {
			values, active, _, diagnostics := resolveOptions(definitions, refs, plan.ControllerName, fmt.Sprint(plan.Controller["type"]), plan.ResourceName, objectMap(plan.OptionValues["pretask"]))
			if hasErrorDiagnostics(diagnostics) {
				return fmt.Errorf("预任务选项无效")
			}
			input := map[string]any{}
			for name := range active {
				input[name] = values[name]
				if raw, ok := objectMap(plan.OptionValues["pretask"])[name]; ok {
					input[name] = raw
				}
			}
			encoded, err := json.Marshal(input)
			if err != nil {
				return err
			}
			args = append(args, string(encoded))
		}
		if strings.ContainsAny(executable, `/\`) && !filepath.IsAbs(executable) {
			executable = filepath.Join(plan.InterfaceRoot, executable)
		}
		cmd := exec.CommandContext(ctx, executable, args...)
		cmd.Dir = plan.InterfaceRoot
		output := &programOutput{emit: emit}
		cmd.Stdout = output
		cmd.Stderr = output
		prepareProcess(cmd)
		cmd.Cancel = func() error { terminateProcess(cmd); return nil }
		cmd.WaitDelay = 2 * time.Second
		name, _ := program["label"].(string)
		if name == "" {
			name, _ = program["name"].(string)
		}
		if name == "" {
			name = "预任务"
		}
		emit("执行预任务 · " + name)
		// Never record command arguments: pretask inputs can contain credentials.
		if err := cmd.Run(); err != nil {
			output.flush()
			return fmt.Errorf("预任务 %s 失败: %w", name, err)
		}
		output.flush()
	}
	return nil
}

// Bound partial lines, and stream stdout/stderr without logging invocation arguments.
type programOutput struct {
	mu      sync.Mutex
	pending string
	emit    func(string)
}

func (w *programOutput) Write(p []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.pending += string(p)
	for {
		index := strings.IndexByte(w.pending, '\n')
		if index < 0 {
			break
		}
		w.emit(w.pending[:index])
		w.pending = w.pending[index+1:]
	}
	if len(w.pending) > 8000 {
		w.emit(w.pending[:8000] + "…")
		w.pending = ""
	}
	return len(p), nil
}
func (w *programOutput) flush() {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.pending != "" {
		w.emit(w.pending)
		w.pending = ""
	}
}
