package mfw

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestReadMaaFWErrorsSinceFiltersPostTaskThread(t *testing.T) {
	logPath := filepath.Join(t.TempDir(), "maafw.log")
	if err := os.WriteFile(logPath, []byte("old log\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	checkpoint := newMaaFWLogCheckpoint(logPath)
	appended := strings.Join([]string{
		`[2026-08-25 13:57:48.688][DBG][Px65516][Tx7145][MaaTasker.cpp][L128][MaaTaskerPostTask] [entry=新建节点21]`,
		`[2026-08-25 13:57:48.695][ERR][Px65516][Tx7145][Encoding.cpp][L151][MaaNS::regex_valid] The repeat operator "+" cannot start a regular expression.  The error occurred while parsing the regular expression: '>>>HERE>>>+'. [regex=+]`,
		`[2026-08-25 13:57:48.695][ERR][Px65516][Tx9999][Other.cpp][L1][Other] unrelated failure`,
		`[2026-08-25 13:57:48.695][ERR][Px65516][Tx7145][PipelineChecker.cpp][L49][MaaNS::ResourceNS::PipelineChecker::check_all_regex] regex invalid [name=新建节点33]`,
		`[2026-08-25 13:57:48.695][ERR][Px65516][Tx7145][Tasker.cpp][L301][MaaNS::Tasker::post_task] failed to override_pipeline [task_id=200000023] [task_ptr->entry()=新建节点21]`,
		`[2026-08-25 13:57:48.696][ERR][Px65516][Tx2070][Tasker.cpp][L410][MaaNS::Tasker::task_id_to_runner_id] runner id not found [task_id=0]`,
	}, "\n") + "\n"
	file, err := os.OpenFile(logPath, os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := file.WriteString(appended); err != nil {
		file.Close()
		t.Fatal(err)
	}
	if err := file.Close(); err != nil {
		t.Fatal(err)
	}

	diagnostics, err := readMaaFWErrorsSince(checkpoint, "新建节点21")
	if err != nil {
		t.Fatalf("readMaaFWErrorsSince() error = %v", err)
	}
	if len(diagnostics) != 3 {
		t.Fatalf("len(diagnostics) = %d, want 3: %#v", len(diagnostics), diagnostics)
	}
	for _, diagnostic := range diagnostics {
		if diagnostic.ThreadID != "7145" {
			t.Fatalf("diagnostic.ThreadID = %q, want 7145", diagnostic.ThreadID)
		}
		if strings.Contains(diagnostic.Message, "task_id_to_runner_id") ||
			strings.Contains(diagnostic.Message, "unrelated failure") {
			t.Fatalf("unexpected diagnostic: %#v", diagnostic)
		}
	}
}

func TestNewFrameworkOperationErrorPreservesReportedMessages(t *testing.T) {
	diagnostics := []FrameworkDiagnostic{
		{
			Scope:   "MaaNS::regex_valid",
			Message: `The repeat operator "+" cannot start a regular expression.  The error occurred while parsing the regular expression: '>>>HERE>>>+'. [regex=+]`,
		},
		{
			Scope:   "MaaNS::ResourceNS::PipelineChecker::check_all_regex",
			Message: "regex invalid [name=新建节点33]",
		},
	}

	err := newFrameworkOperationError(
		"maafw.task.submit_failed",
		"提交任务",
		diagnostics,
	)
	want := "MaaFramework 提交任务失败：\n" +
		`The repeat operator "+" cannot start a regular expression.  The error occurred while parsing the regular expression: '>>>HERE>>>+'. [regex=+]` + "\n" +
		"regex invalid [name=新建节点33]"
	if err.Error() != want {
		t.Fatalf("Error() = %q, want %q", err.Error(), want)
	}
}

func TestNewFrameworkOperationErrorDoesNotExposePipelineOverride(t *testing.T) {
	diagnostics := []FrameworkDiagnostic{
		{
			Scope: "MaaNS::Tasker::post_task",
			Message: "failed to override_pipeline [task_id=1] " +
				`[pipeline_override={"secret":"large pipeline"}]`,
		},
	}

	err := newFrameworkOperationError(
		"maafw.task.submit_failed",
		"提交任务",
		diagnostics,
	)
	if strings.Contains(err.Error(), "pipeline_override") ||
		strings.Contains(err.Error(), "secret") {
		t.Fatalf("Error() exposed pipeline override: %q", err.Error())
	}
	if !strings.Contains(err.Error(), "未提供可读取的错误详情") {
		t.Fatalf("Error() = %q", err.Error())
	}
}
