package diagnostics

import (
	"errors"
	"strings"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/protocol"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/mfw"
)

func BuildResourceResolutionDiagnostic(index int, resolution mfw.ResourceBundleResolution) protocol.Diagnostic {
	data := resolution.DiagnosticData()
	data["index"] = index
	return protocol.Diagnostic{
		Severity:   "info",
		Code:       "debug.resource.resolved",
		Message:    "资源路径已解析为 bundle 根目录。",
		SourcePath: preferResourceDiagnosticPath(resolution.InputAbsPath, resolution.InputPath),
		Data:       data,
	}
}

func BuildResourceResolutionDiagnostics(resolutions []mfw.ResourceBundleResolution) []protocol.Diagnostic {
	if len(resolutions) == 0 {
		return nil
	}
	diagnostics := make([]protocol.Diagnostic, 0, len(resolutions))
	for index, resolution := range resolutions {
		diagnostics = append(diagnostics, BuildResourceResolutionDiagnostic(index, resolution))
	}
	return diagnostics
}

func BuildResourceResolveErrorDiagnostic(index int, err error) protocol.Diagnostic {
	diagnostic := protocol.Diagnostic{
		Severity: "error",
		Code:     "debug.resource.resolve_failed",
		Message:  err.Error(),
	}

	data := map[string]interface{}{}
	if index >= 0 {
		data["index"] = index
	}

	var resolveErr *mfw.ResourceBundleResolveError
	if errors.As(err, &resolveErr) {
		data = resolveErr.DiagnosticData()
		if index >= 0 {
			data["index"] = index
		}
		diagnostic.SourcePath = preferResourceDiagnosticPath(resolveErr.InputAbsPath, resolveErr.InputPath)
	}

	if len(data) > 0 {
		diagnostic.Data = data
	}
	return diagnostic
}

func preferResourceDiagnosticPath(primary, fallback string) string {
	if strings.TrimSpace(primary) != "" {
		return primary
	}
	return fallback
}
