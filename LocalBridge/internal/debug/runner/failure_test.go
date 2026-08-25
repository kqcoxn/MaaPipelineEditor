package runner

import (
	"errors"
	"testing"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/mfw"
)

func TestNewRunFailurePreservesFrameworkDetails(t *testing.T) {
	diagnostic := mfw.FrameworkDiagnostic{
		Scope:   "MaaNS::regex_valid",
		Message: "invalid regex [regex=+]",
	}
	failure := newRunFailure(&mfw.FrameworkError{
		Code:        "maafw.task.submit_failed",
		Summary:     "MaaFramework 拒绝提交任务",
		Diagnostics: []mfw.FrameworkDiagnostic{diagnostic},
	}, "debug.run.start_failed")

	if failure.Code != "maafw.task.submit_failed" {
		t.Fatalf("Code = %q", failure.Code)
	}
	if failure.Source != "maafw" {
		t.Fatalf("Source = %q", failure.Source)
	}

	sessionData := failure.sessionData(nil)
	if sessionData["error"] != "MaaFramework 拒绝提交任务" {
		t.Fatalf("sessionData() = %#v", sessionData)
	}
	diagnosticData := failure.diagnosticData()
	if diagnosticData["code"] != "maafw.task.submit_failed" ||
		diagnosticData["source"] != "maafw" {
		t.Fatalf("diagnosticData() = %#v", diagnosticData)
	}
	internalErrors, ok := diagnosticData["internalErrors"].([]mfw.FrameworkDiagnostic)
	if !ok || len(internalErrors) != 1 || internalErrors[0] != diagnostic {
		t.Fatalf("internalErrors = %#v", diagnosticData["internalErrors"])
	}
}

func TestNewRunFailureFallsBackForLocalBridgeErrors(t *testing.T) {
	failure := newRunFailure(errors.New("启动失败"), "debug.run.start_failed")

	if failure.Code != "debug.run.start_failed" ||
		failure.Source != "localbridge" ||
		failure.Message != "启动失败" {
		t.Fatalf("newRunFailure() = %#v", failure)
	}
}
