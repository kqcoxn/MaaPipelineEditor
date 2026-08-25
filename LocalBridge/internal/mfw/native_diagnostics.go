package mfw

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"

	maa "github.com/MaaXYZ/maa-framework-go/v4"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/paths"
)

const maxMaaFWLogLinePrefix = 64 * 1024

var (
	maaFWLogLinePattern = regexp.MustCompile(
		`^\[[^\]]+\]\[([A-Z]+)\]\[P(?:x)?([^\]]+)\]\[T(?:x)?([^\]]+)\]\[([^\]]+)\]\[L\d+\]\[([^\]]+)\]\s*(.*)$`,
	)
	maaFWPostTaskDiagnosticMu sync.Mutex
)

type FrameworkDiagnostic struct {
	ProcessID string `json:"processId,omitempty"`
	ThreadID  string `json:"threadId,omitempty"`
	File      string `json:"file,omitempty"`
	Scope     string `json:"scope,omitempty"`
	Message   string `json:"message"`
}

type FrameworkError struct {
	Code        string                `json:"code"`
	Operation   string                `json:"operation"`
	Summary     string                `json:"summary"`
	Diagnostics []FrameworkDiagnostic `json:"diagnostics,omitempty"`
}

func (e *FrameworkError) Error() string {
	if e == nil {
		return "MaaFramework 内部错误"
	}
	return e.Summary
}

type maaFWLogCheckpoint struct {
	path   string
	offset int64
}

func currentMaaFWLogPath() string {
	return filepath.Join(paths.GetLogDir(), "maafw.log")
}

func newMaaFWLogCheckpoint(path string) maaFWLogCheckpoint {
	checkpoint := maaFWLogCheckpoint{path: path}
	if info, err := os.Stat(path); err == nil {
		checkpoint.offset = info.Size()
	}
	return checkpoint
}

func postTaskWithMaaFWDiagnostics(entry string, post func() *maa.TaskJob) (*maa.TaskJob, error) {
	maaFWPostTaskDiagnosticMu.Lock()
	defer maaFWPostTaskDiagnosticMu.Unlock()

	checkpoint := newMaaFWLogCheckpoint(currentMaaFWLogPath())
	job := post()
	if job != nil && !job.Invalid() {
		return job, nil
	}

	diagnostics, err := readMaaFWErrorsSince(checkpoint, entry)
	if err != nil {
		logger.Warn("MaaFW", "读取 MaaFramework 提交失败详情失败: %v", err)
	}
	return nil, newFrameworkOperationError(
		"maafw.task.submit_failed",
		"提交任务",
		diagnostics,
	)
}

func readMaaFWErrorsSince(
	checkpoint maaFWLogCheckpoint,
	entry string,
) ([]FrameworkDiagnostic, error) {
	file, err := os.Open(checkpoint.path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	info, err := file.Stat()
	if err != nil {
		return nil, err
	}
	offset := checkpoint.offset
	if offset < 0 || offset > info.Size() {
		offset = 0
	}
	if _, err := file.Seek(offset, io.SeekStart); err != nil {
		return nil, err
	}

	reader := bufio.NewReaderSize(file, maxMaaFWLogLinePrefix)
	diagnostics := make([]FrameworkDiagnostic, 0, 4)
	for {
		line, readErr := readMaaFWLogLinePrefix(reader)
		if line != "" {
			if diagnostic, ok := parseMaaFWErrorLine(line); ok && !isMaaFWFollowUpNoise(diagnostic) {
				diagnostics = append(diagnostics, diagnostic)
			}
		}
		if errors.Is(readErr, io.EOF) {
			break
		}
		if readErr != nil {
			return nil, readErr
		}
	}

	return filterMaaFWDiagnosticsForEntry(diagnostics, entry), nil
}

func readMaaFWLogLinePrefix(reader *bufio.Reader) (string, error) {
	var prefix []byte
	for {
		part, isPrefix, err := reader.ReadLine()
		if len(prefix) < maxMaaFWLogLinePrefix {
			remaining := maxMaaFWLogLinePrefix - len(prefix)
			if len(part) > remaining {
				part = part[:remaining]
			}
			prefix = append(prefix, part...)
		}
		if err != nil {
			return string(prefix), err
		}
		if !isPrefix {
			return string(prefix), nil
		}
	}
}

func parseMaaFWErrorLine(line string) (FrameworkDiagnostic, bool) {
	match := maaFWLogLinePattern.FindStringSubmatch(strings.TrimSpace(line))
	if len(match) != 7 || match[1] != "ERR" {
		return FrameworkDiagnostic{}, false
	}
	return FrameworkDiagnostic{
		ProcessID: match[2],
		ThreadID:  match[3],
		File:      match[4],
		Scope:     match[5],
		Message:   strings.TrimSpace(match[6]),
	}, true
}

func filterMaaFWDiagnosticsForEntry(
	diagnostics []FrameworkDiagnostic,
	entry string,
) []FrameworkDiagnostic {
	trimmedEntry := strings.TrimSpace(entry)
	if trimmedEntry == "" {
		return diagnostics
	}

	var processID string
	var threadID string
	for _, diagnostic := range diagnostics {
		if extractMaaFWLogField(diagnostic.Message, "task_ptr->entry()") == trimmedEntry {
			processID = diagnostic.ProcessID
			threadID = diagnostic.ThreadID
		}
	}
	if threadID == "" {
		return diagnostics
	}

	filtered := make([]FrameworkDiagnostic, 0, len(diagnostics))
	for _, diagnostic := range diagnostics {
		if diagnostic.ProcessID == processID && diagnostic.ThreadID == threadID {
			filtered = append(filtered, diagnostic)
		}
	}
	return filtered
}

func isMaaFWFollowUpNoise(diagnostic FrameworkDiagnostic) bool {
	return strings.Contains(diagnostic.Scope, "task_id_to_runner_id") ||
		strings.Contains(diagnostic.Message, "runner id not found [task_id=0]")
}

func newFrameworkOperationError(
	code string,
	operation string,
	diagnostics []FrameworkDiagnostic,
) *FrameworkError {
	messages := meaningfulMaaFWDiagnosticMessages(diagnostics)
	var summary string
	if len(messages) > 0 {
		summary = fmt.Sprintf(
			"MaaFramework %s失败：\n%s",
			operation,
			strings.Join(messages, "\n"),
		)
	} else {
		summary = fmt.Sprintf(
			"MaaFramework 拒绝%s，但未提供可读取的错误详情。请查看 maafw.log。",
			operation,
		)
	}

	return &FrameworkError{
		Code:        code,
		Operation:   operation,
		Summary:     summary,
		Diagnostics: diagnostics,
	}
}

func meaningfulMaaFWDiagnosticMessages(
	diagnostics []FrameworkDiagnostic,
) []string {
	messages := make([]string, 0, len(diagnostics))
	for _, diagnostic := range diagnostics {
		if strings.Contains(diagnostic.Message, "failed to override_pipeline") {
			continue
		}
		messages = append(messages, diagnostic.Message)
	}
	return messages
}

func extractMaaFWLogField(message string, key string) string {
	prefix := "[" + key + "="
	start := strings.Index(message, prefix)
	if start < 0 {
		return ""
	}
	value := message[start+len(prefix):]
	end := strings.IndexByte(value, ']')
	if end < 0 {
		return ""
	}
	return strings.TrimSpace(value[:end])
}
