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

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/paths"
)

func RuntimeEnvironment(plan *RuntimePlan, clientVersion, frameworkVersion string) map[string]string {
	controller, _ := json.Marshal(plan.Controller)
	resource, _ := json.Marshal(plan.Resource)
	return map[string]string{
		"PI_INTERFACE_VERSION":    "v2.11.0",
		"PI_CLIENT_NAME":          "MPE",
		"PI_CLIENT_VERSION":       clientVersion,
		"PI_CLIENT_LANGUAGE":      plan.Language,
		"PI_CLIENT_MAAFW_VERSION": frameworkVersion,
		"PI_VERSION":              plan.ProjectVersion,
		"PI_CONTROLLER":           string(controller),
		"PI_RESOURCE":             string(resource),
		"PI_USER_DATA_DIR":        paths.GetDataDir(),
	}
}

type pretaskProgram struct {
	ID         string
	Definition map[string]any
}

func pretaskPrograms(doc map[string]any) []pretaskProgram {
	values := objectArray(doc["pretask"])
	if value, ok := doc["pretask"].(map[string]any); ok {
		values = []map[string]any{value}
	}
	result := []pretaskProgram{}
	for index, value := range values {
		id, _ := value["name"].(string)
		if id == "" {
			id = fmt.Sprintf("#%d", index)
		}
		result = append(result, pretaskProgram{ID: id, Definition: value})
	}
	return result
}
func applicablePrograms(doc map[string]any, controller, resource string, enabled map[string]bool) []pretaskProgram {
	result := []pretaskProgram{}
	for _, program := range pretaskPrograms(doc) {
		if selected, exists := enabled[program.ID]; exists && !selected {
			continue
		}
		if optionApplicable(program.Definition, controller, resource) {
			result = append(result, program)
		}
	}
	return result
}
func (s *ProjectSnapshot) HasPretasks(plan *RuntimePlan) bool {
	return len(applicablePrograms(s.Document, plan.ControllerName, plan.ResourceName, plan.PretaskEnabled)) > 0
}
func (s *ProjectSnapshot) RunPretasks(ctx context.Context, plan *RuntimePlan, emit func(string), env map[string]string) error {
	definitions := objectMap(s.Document["option"])
	for _, selected := range applicablePrograms(s.Document, plan.ControllerName, plan.ResourceName, plan.PretaskEnabled) {
		program := selected.Definition
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
			provided := objectMap(objectMap(plan.OptionValues["pretask"])[selected.ID])
			values, active, _, diagnostics := resolveOptions(definitions, refs, plan.ControllerName, fmt.Sprint(plan.Controller["type"]), plan.ResourceName, provided)
			if hasErrorDiagnostics(diagnostics) {
				return fmt.Errorf("预任务选项无效")
			}
			input := map[string]any{}
			for name := range active {
				input[name] = values[name]
				if raw, ok := provided[name]; ok {
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
		cmd.Env = mergeEnvironment(env)
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
