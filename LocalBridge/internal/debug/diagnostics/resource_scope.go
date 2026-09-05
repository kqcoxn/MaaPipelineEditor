package diagnostics

import (
	"path/filepath"
	"strings"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/protocol"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/mfw"
)

// Resolver snapshots can include files from other resource configurations.
// Use resolved bundle roots, and keep same-bundle conflicts for diagnosis.
func effectiveResourceResolverNodes(nodes []protocol.NodeResolverSnapshotNode, resolutions []mfw.ResourceBundleResolution, rootFileIDs ...string) []protocol.NodeResolverSnapshotNode {
	if len(resolutions) == 0 {
		return nodes
	}
	priorities := make([]int, len(nodes))
	winners := make(map[string]int)
	for i, node := range nodes {
		priority, longest := -1, -1
		for index, resolution := range resolutions {
			root := resolvedPathKey(filepath.Join(resolution.ResolvedPath, "pipeline"))
			source := resolvedPathKey(node.SourcePath)
			if strings.HasPrefix(source, root+string(filepath.Separator)) && len(root) > longest {
				priority, longest = index, len(root)
			}
		}
		priorities[i] = priority
		if previous, exists := winners[node.RuntimeName]; !exists || priority > previous {
			winners[node.RuntimeName] = priority
		}
	}
	var effective []protocol.NodeResolverSnapshotNode
	rootFileID := ""
	if len(rootFileIDs) > 0 {
		rootFileID = rootFileIDs[0]
	}
	for i, node := range nodes {
		if node.SourcePath != "" && priorities[i] < 0 && node.FileID != rootFileID {
			continue
		}
		if priorities[i] == winners[node.RuntimeName] {
			effective = append(effective, node)
		}
	}
	return effective
}
