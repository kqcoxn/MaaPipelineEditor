package runner

import (
	"errors"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/mfw"
)

type runFailure struct {
	Code           string
	Message        string
	Source         string
	InternalErrors []mfw.FrameworkDiagnostic
}

func newRunFailure(err error, fallbackCode string) runFailure {
	failure := runFailure{
		Code:    fallbackCode,
		Message: err.Error(),
		Source:  "localbridge",
	}
	var frameworkErr *mfw.FrameworkError
	if !errors.As(err, &frameworkErr) {
		return failure
	}

	failure.Code = frameworkErr.Code
	failure.Message = frameworkErr.Error()
	failure.Source = "maafw"
	failure.InternalErrors = frameworkErr.Diagnostics
	return failure
}

func (f runFailure) sessionData(extra map[string]interface{}) map[string]interface{} {
	data := make(map[string]interface{}, len(extra)+6)
	for key, value := range extra {
		data[key] = value
	}
	data["error"] = f.Message
	data["errorCode"] = f.Code
	data["errorSource"] = f.Source
	if len(f.InternalErrors) > 0 {
		data["internalErrors"] = f.InternalErrors
	}
	return data
}

func (f runFailure) diagnosticData() map[string]interface{} {
	data := map[string]interface{}{
		"severity": "error",
		"code":     f.Code,
		"message":  f.Message,
		"source":   f.Source,
	}
	if len(f.InternalErrors) > 0 {
		data["internalErrors"] = f.InternalErrors
	}
	return data
}
