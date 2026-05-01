package runutil

import (
	"strings"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/protocol"
)

func UsesLiveController(mode protocol.RunMode) bool {
	switch mode {
	case protocol.RunModeRunFromNode,
		protocol.RunModeSingleNodeRun,
		protocol.RunModeRecognitionOnly,
		protocol.RunModeActionOnly:
		return true
	default:
		return false
	}
}

func NonEmptyResourcePaths(paths []string) []string {
	result := make([]string, 0, len(paths))
	for _, path := range paths {
		if strings.TrimSpace(path) != "" {
			result = append(result, strings.TrimSpace(path))
		}
	}
	return result
}
