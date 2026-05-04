package diagnostics

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/protocol"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/runutil"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/mfw"
	"github.com/tailscale/hujson"
)

const (
	resourceHealthCategoryResolution = "resolution"
	resourceHealthCategoryLoading    = "loading"
	resourceHealthCategoryGraph      = "graph"
)

type resourceHealthChecklistContext struct {
	bundleFiles []resourceHealthBundlePipelineFile
}

type resourceHealthBundlePipelineFile struct {
	bundlePath   string
	relativePath string
	sourcePath   string
	parsed       *hujson.Value
	parseErr     error
}

type resourceHealthLoadCheckResult struct {
	diagnostics               []protocol.Diagnostic
	hash                      string
	resolutions               []mfw.ResourceBundleResolution
	shouldRunFailureChecklist bool
}

var resourceHealthLoadFailureChecklist = []func(*Service, resourceHealthChecklistContext) []protocol.Diagnostic{
	(*Service).checkBundlePipelineJSONSyntax,
	(*Service).checkBundlePipelineDuplicateNodeNames,
}

func (s *Service) CheckResourceHealth(
	req protocol.ResourceHealthRequest,
) protocol.ResourceHealthResult {
	startedAt := time.Now()
	paths := runutil.NonEmptyResourcePaths(req.ResourcePaths)
	result := protocol.ResourceHealthResult{
		RequestID:     strings.TrimSpace(req.RequestID),
		ResourcePaths: paths,
		Status:        "failed",
		CheckedAt:     startedAt.UTC().Format(time.RFC3339Nano),
	}

	resolutionDiagnostics := annotateResourceHealthDiagnostics(
		s.checkResources(paths),
		resourceHealthCategoryResolution,
		resourceResolutionSuggestion,
	)
	loadResult := s.checkResourceLoadDiagnostics(
		paths,
		resolutionDiagnostics,
	)
	graphDiagnostics := s.checkGraphHealth(req)

	result.Diagnostics = append(result.Diagnostics, resolutionDiagnostics...)
	result.Diagnostics = append(result.Diagnostics, loadResult.diagnostics...)
	if loadResult.shouldRunFailureChecklist {
		result.Diagnostics = append(
			result.Diagnostics,
			s.runLoadFailureChecklist(loadResult.resolutions)...,
		)
	}
	result.Diagnostics = append(result.Diagnostics, graphDiagnostics...)
	result.DurationMS = time.Since(startedAt).Milliseconds()
	if !HasBlockingDiagnostic(result.Diagnostics) {
		result.Status = "ready"
		result.Hash = loadResult.hash
	}
	return result
}

func (s *Service) checkResourceLoadDiagnostics(
	paths []string,
	resolutionDiagnostics []protocol.Diagnostic,
) resourceHealthLoadCheckResult {
	switch {
	case len(paths) == 0:
		return resourceHealthLoadCheckResult{
			diagnostics: []protocol.Diagnostic{newResourceHealthDiagnostic(
				resourceHealthCategoryLoading,
				"warning",
				"debug.resource.load_skipped",
				"资源路径为空，已跳过 MaaFW 真实加载。",
				"先在调试配置里补充资源路径，或等待 LocalBridge 扫描出资源包后重新体检。",
			)},
		}
	case HasBlockingDiagnostic(resolutionDiagnostics):
		return resourceHealthLoadCheckResult{
			diagnostics: []protocol.Diagnostic{newResourceHealthDiagnostic(
				resourceHealthCategoryLoading,
				"warning",
				"debug.resource.load_skipped",
				"资源路径解析未通过，已跳过 MaaFW 真实加载。",
				"先修复资源路径解析错误，再重新体检。",
			)},
		}
	case s.mfwService == nil || !s.mfwService.IsInitialized():
		return resourceHealthLoadCheckResult{
			diagnostics: []protocol.Diagnostic{newResourceHealthDiagnostic(
				resourceHealthCategoryLoading,
				"error",
				"debug.resource.load_unavailable",
				"MaaFramework 未初始化，无法执行资源真实加载。",
				"先连接 LocalBridge 并完成 MaaFramework 初始化，再重新体检。",
			)},
		}
	}

	hash, resolutions, err := mfw.CheckResourceBundlesDetailed(paths)
	if err != nil {
		return resourceHealthLoadCheckResult{
			diagnostics: []protocol.Diagnostic{withResourceHealthMeta(protocol.Diagnostic{
				Severity: "error",
				Code:     "debug.resource.load_failed",
				Message:  err.Error(),
				Data: map[string]interface{}{
					"resolutions": resourceHealthResolutionData(resolutions),
				},
			}, resourceHealthCategoryLoading, "检查 bundle 目录结构、Lib 目录与资源版本是否匹配后重新体检。")},
			resolutions:               resolutions,
			shouldRunFailureChecklist: true,
		}
	}

	return resourceHealthLoadCheckResult{
		diagnostics: []protocol.Diagnostic{withResourceHealthMeta(protocol.Diagnostic{
			Severity: "info",
			Code:     "debug.resource.ready",
			Message:  "MaaFW 已成功加载当前资源。",
			Data: map[string]interface{}{
				"hash":        hash,
				"resolutions": resourceHealthResolutionData(resolutions),
			},
		}, resourceHealthCategoryLoading, "")},
		hash:        hash,
		resolutions: resolutions,
	}
}

func (s *Service) checkGraphHealth(
	req protocol.ResourceHealthRequest,
) []protocol.Diagnostic {
	diagnostics := make([]protocol.Diagnostic, 0)
	graphSnapshot := req.GraphSnapshot
	resolverSnapshot := req.ResolverSnapshot

	fileIDs := make(map[string]struct{}, len(graphSnapshot.Files))
	if strings.TrimSpace(graphSnapshot.RootFileID) == "" {
		diagnostics = append(diagnostics, newResourceHealthDiagnostic(
			resourceHealthCategoryGraph,
			"error",
			"debug.graph.root_missing",
			"graph snapshot 缺少 rootFileId。",
			"确认当前编辑器存在根文件，再重新体检。",
		))
	}
	if len(graphSnapshot.Files) == 0 {
		diagnostics = append(diagnostics, newResourceHealthDiagnostic(
			resourceHealthCategoryGraph,
			"error",
			"debug.graph.empty",
			"当前图快照为空，无法确认调试合法性。",
			"先在当前图中创建或导入至少一个 Pipeline 节点，再重新体检。",
		))
	}

	rootFileFound := false
	for index, file := range graphSnapshot.Files {
		fieldPrefix := fmt.Sprintf("graphSnapshot.files[%d]", index)
		fileID := strings.TrimSpace(file.FileID)
		if fileID == "" {
			diagnostics = append(diagnostics, newResourceHealthFieldDiagnostic(
				resourceHealthCategoryGraph,
				"error",
				"debug.graph.file_id_missing",
				"graph snapshot 存在缺少 fileId 的文件项。",
				fmt.Sprintf("%s.fileId", fieldPrefix),
				"补齐文件标识后重新体检。",
			))
			continue
		}
		if _, exists := fileIDs[fileID]; exists {
			diagnostics = append(diagnostics, withResourceHealthMeta(protocol.Diagnostic{
				Severity:  "warning",
				Code:      "debug.graph.file_duplicate",
				Message:   "graph snapshot 中存在重复的 fileId。",
				FieldPath: fmt.Sprintf("%s.fileId", fieldPrefix),
				FileID:    fileID,
			}, resourceHealthCategoryGraph, "确认当前文件列表没有重复导出项后重新体检。"))
		}
		fileIDs[fileID] = struct{}{}
		if fileID == graphSnapshot.RootFileID {
			rootFileFound = true
		}
		if file.Pipeline == nil {
			diagnostics = append(diagnostics, newResourceHealthFieldDiagnostic(
				resourceHealthCategoryGraph,
				"error",
				"debug.graph.pipeline_missing",
				"graph snapshot 中存在缺少 pipeline 的文件项。",
				fmt.Sprintf("%s.pipeline", fieldPrefix),
				"先修复对应文件的 Pipeline 数据，再重新体检。",
			))
		}
	}
	if graphSnapshot.RootFileID != "" && len(graphSnapshot.Files) > 0 && !rootFileFound {
		diagnostics = append(diagnostics, withResourceHealthMeta(protocol.Diagnostic{
			Severity:  "error",
			Code:      "debug.graph.root_not_found",
			Message:   "graph snapshot 的 rootFileId 不在文件列表中。",
			FieldPath: "graphSnapshot.rootFileId",
			FileID:    graphSnapshot.RootFileID,
		}, resourceHealthCategoryGraph, "确认当前根文件仍在调试快照内后重新体检。"))
	}

	if strings.TrimSpace(resolverSnapshot.RootFileID) == "" {
		diagnostics = append(diagnostics, newResourceHealthDiagnostic(
			resourceHealthCategoryGraph,
			"error",
			"debug.resolver.root_missing",
			"resolver snapshot 缺少 rootFileId。",
			"重新生成当前图的 resolver snapshot 后再体检。",
		))
	} else if graphSnapshot.RootFileID != "" && resolverSnapshot.RootFileID != graphSnapshot.RootFileID {
		diagnostics = append(diagnostics, withResourceHealthMeta(protocol.Diagnostic{
			Severity: "error",
			Code:     "debug.resolver.root_mismatch",
			Message:  "graph snapshot 与 resolver snapshot 的 rootFileId 不一致。",
			Data: map[string]interface{}{
				"graphRootFileId":    graphSnapshot.RootFileID,
				"resolverRootFileId": resolverSnapshot.RootFileID,
			},
		}, resourceHealthCategoryGraph, "先刷新当前图和 resolver 导出，再重新体检。"))
	}

	if len(resolverSnapshot.Nodes) == 0 {
		diagnostics = append(diagnostics, newResourceHealthDiagnostic(
			resourceHealthCategoryGraph,
			"error",
			"debug.resolver.empty",
			"当前图没有可映射到运行时的 Pipeline 节点。",
			"确认当前图里存在可导出的 Pipeline 节点后重新体检。",
		))
	}

	runtimeIndex := make(map[string]protocol.NodeResolverSnapshotNode, len(resolverSnapshot.Nodes))
	nodeIndex := make(map[string]protocol.NodeResolverSnapshotNode, len(resolverSnapshot.Nodes))
	for index, node := range resolverSnapshot.Nodes {
		fieldPrefix := fmt.Sprintf("resolverSnapshot.nodes[%d]", index)
		fileID := strings.TrimSpace(node.FileID)
		nodeID := strings.TrimSpace(node.NodeID)
		runtimeName := strings.TrimSpace(node.RuntimeName)
		if fileID == "" {
			diagnostics = append(diagnostics, newResourceHealthFieldDiagnostic(
				resourceHealthCategoryGraph,
				"error",
				"debug.resolver.file_id_missing",
				"resolver snapshot 存在缺少 fileId 的节点。",
				fmt.Sprintf("%s.fileId", fieldPrefix),
				"补齐该节点的 fileId 后重新体检。",
			))
			continue
		}
		if nodeID == "" {
			diagnostics = append(diagnostics, newResourceHealthFieldDiagnostic(
				resourceHealthCategoryGraph,
				"error",
				"debug.resolver.node_id_missing",
				"resolver snapshot 存在缺少 nodeId 的节点。",
				fmt.Sprintf("%s.nodeId", fieldPrefix),
				"补齐该节点的 nodeId 后重新体检。",
			))
			continue
		}
		if runtimeName == "" {
			diagnostics = append(diagnostics, newResourceHealthFieldDiagnostic(
				resourceHealthCategoryGraph,
				"error",
				"debug.resolver.runtime_missing",
				"resolver snapshot 存在缺少 runtimeName 的节点。",
				fmt.Sprintf("%s.runtimeName", fieldPrefix),
				"补齐该节点的 runtimeName 后重新体检。",
			))
			continue
		}

		nodeKey := resourceHealthNodeKey(fileID, nodeID)
		if previous, exists := nodeIndex[nodeKey]; exists {
			diagnostics = append(diagnostics, withResourceHealthMeta(protocol.Diagnostic{
				Severity:   "error",
				Code:       "debug.resolver.node_duplicate",
				Message:    "resolver snapshot 中存在重复的 fileId / nodeId 组合。",
				FileID:     fileID,
				NodeID:     nodeID,
				SourcePath: node.SourcePath,
				Data: map[string]interface{}{
					"runtimeName":         runtimeName,
					"previousRuntimeName": previous.RuntimeName,
					"previousSourcePath":  previous.SourcePath,
				},
			}, resourceHealthCategoryGraph, "确认节点 ID 没有重复，或重新导出 resolver snapshot 后再体检。"))
		} else {
			nodeIndex[nodeKey] = node
		}

		runtimeKey := strings.ToLower(runtimeName)
		if previous, exists := runtimeIndex[runtimeKey]; exists {
			diagnostics = append(diagnostics, withResourceHealthMeta(protocol.Diagnostic{
				Severity:   "error",
				Code:       "debug.resolver.runtime_duplicate",
				Message:    "resolver snapshot 中存在重复的 runtimeName。",
				FileID:     fileID,
				NodeID:     nodeID,
				SourcePath: node.SourcePath,
				Data: map[string]interface{}{
					"runtimeName":        runtimeName,
					"previousFileId":     previous.FileID,
					"previousNodeId":     previous.NodeID,
					"previousSourcePath": previous.SourcePath,
				},
			}, resourceHealthCategoryGraph, "调整重复节点的名称或 prefix，确保 runtimeName 唯一后重新体检。"))
		} else {
			runtimeIndex[runtimeKey] = node
		}
	}

	for index, edge := range resolverSnapshot.Edges {
		fieldPrefix := fmt.Sprintf("resolverSnapshot.edges[%d]", index)
		fromRuntimeName := strings.TrimSpace(edge.FromRuntimeName)
		toRuntimeName := strings.TrimSpace(edge.ToRuntimeName)
		if fromRuntimeName == "" {
			diagnostics = append(diagnostics, newResourceHealthFieldDiagnostic(
				resourceHealthCategoryGraph,
				"error",
				"debug.resolver.edge_source_missing",
				"resolver snapshot 存在缺少起点 runtimeName 的边。",
				fmt.Sprintf("%s.fromRuntimeName", fieldPrefix),
				"补齐边的起点 runtimeName 后重新体检。",
			))
		} else if _, exists := runtimeIndex[strings.ToLower(fromRuntimeName)]; !exists {
			diagnostics = append(diagnostics, withResourceHealthMeta(protocol.Diagnostic{
				Severity:  "error",
				Code:      "debug.resolver.edge_source_unknown",
				Message:   "resolver edge 的起点 runtimeName 不存在。",
				FieldPath: fmt.Sprintf("%s.fromRuntimeName", fieldPrefix),
				Data: map[string]interface{}{
					"runtimeName": fromRuntimeName,
					"edgeId":      edge.EdgeID,
				},
			}, resourceHealthCategoryGraph, "修复该边指向的起点节点后重新体检。"))
		}
		if toRuntimeName == "" {
			diagnostics = append(diagnostics, newResourceHealthFieldDiagnostic(
				resourceHealthCategoryGraph,
				"error",
				"debug.resolver.edge_target_missing",
				"resolver snapshot 存在缺少终点 runtimeName 的边。",
				fmt.Sprintf("%s.toRuntimeName", fieldPrefix),
				"补齐边的终点 runtimeName 后重新体检。",
			))
		} else if _, exists := runtimeIndex[strings.ToLower(toRuntimeName)]; !exists {
			diagnostics = append(diagnostics, withResourceHealthMeta(protocol.Diagnostic{
				Severity:  "error",
				Code:      "debug.resolver.edge_target_unknown",
				Message:   "resolver edge 的终点 runtimeName 不存在。",
				FieldPath: fmt.Sprintf("%s.toRuntimeName", fieldPrefix),
				Data: map[string]interface{}{
					"runtimeName": toRuntimeName,
					"edgeId":      edge.EdgeID,
				},
			}, resourceHealthCategoryGraph, "修复该边指向的终点节点后重新体检。"))
		}
	}

	diagnostics = append(diagnostics, s.checkGraphTarget(req, runtimeIndex)...)
	if len(diagnostics) == 0 {
		diagnostics = append(diagnostics, newResourceHealthDiagnostic(
			resourceHealthCategoryGraph,
			"info",
			"debug.graph.ready",
			"当前图静态检查通过。",
			"",
		))
	}
	return diagnostics
}

func (s *Service) checkGraphTarget(
	req protocol.ResourceHealthRequest,
	runtimeIndex map[string]protocol.NodeResolverSnapshotNode,
) []protocol.Diagnostic {
	if req.Target == nil {
		return []protocol.Diagnostic{newResourceHealthDiagnostic(
			resourceHealthCategoryGraph,
			"error",
			"debug.target.missing",
			"当前调试上下文缺少目标节点。",
			"在中控台选择可调试节点，或先把节点设为调试入口后重新体检。",
		)}
	}

	target := *req.Target
	if strings.TrimSpace(target.FileID) == "" ||
		strings.TrimSpace(target.NodeID) == "" ||
		strings.TrimSpace(target.RuntimeName) == "" {
		return []protocol.Diagnostic{withResourceHealthMeta(protocol.Diagnostic{
			Severity:   "error",
			Code:       "debug.target.incomplete",
			Message:    "当前目标节点信息不完整。",
			FileID:     target.FileID,
			NodeID:     target.NodeID,
			SourcePath: target.SourcePath,
		}, resourceHealthCategoryGraph, "重新选择调试目标，确保目标节点能解析到完整的 fileId / nodeId / runtimeName。")}
	}

	node, exists := runtimeIndex[strings.ToLower(strings.TrimSpace(target.RuntimeName))]
	if !exists || node.FileID != target.FileID || node.NodeID != target.NodeID {
		return []protocol.Diagnostic{withResourceHealthMeta(protocol.Diagnostic{
			Severity:   "error",
			Code:       "debug.target.not_in_resolver",
			Message:    "目标节点不在 resolver snapshot 中。",
			FileID:     target.FileID,
			NodeID:     target.NodeID,
			SourcePath: target.SourcePath,
			Data: map[string]interface{}{
				"runtimeName": target.RuntimeName,
			},
		}, resourceHealthCategoryGraph, "重新选择入口节点，或修复节点 JSON / prefix / runtimeName 映射后重新体检。")}
	}
	return nil
}

func (s *Service) runLoadFailureChecklist(
	resolutions []mfw.ResourceBundleResolution,
) []protocol.Diagnostic {
	bundleFiles, inspectionDiagnostics := s.inspectBundlePipelineFiles(resolutions)
	ctx := resourceHealthChecklistContext{
		bundleFiles: bundleFiles,
	}
	diagnostics := make([]protocol.Diagnostic, 0, len(inspectionDiagnostics))
	diagnostics = append(diagnostics, inspectionDiagnostics...)
	for _, check := range resourceHealthLoadFailureChecklist {
		diagnostics = append(diagnostics, check(s, ctx)...)
	}
	return diagnostics
}

func (s *Service) inspectBundlePipelineFiles(
	resolutions []mfw.ResourceBundleResolution,
) ([]resourceHealthBundlePipelineFile, []protocol.Diagnostic) {
	bundleFiles := make([]resourceHealthBundlePipelineFile, 0)
	diagnostics := make([]protocol.Diagnostic, 0)
	seenBundles := make(map[string]struct{}, len(resolutions))
	for _, resolution := range resolutions {
		bundlePath := strings.TrimSpace(resolution.ResolvedPath)
		if bundlePath == "" {
			continue
		}
		key := resolvedPathKey(bundlePath)
		if _, exists := seenBundles[key]; exists {
			continue
		}
		seenBundles[key] = struct{}{}
		pipelineDir := filepath.Join(bundlePath, "pipeline")
		walkErr := filepath.WalkDir(pipelineDir, func(path string, d os.DirEntry, err error) error {
			if err != nil {
				diagnostics = append(diagnostics, withResourceHealthMeta(protocol.Diagnostic{
					Severity:   "warning",
					Code:       "debug.resource.pipeline_file_unreadable",
					Message:    fmt.Sprintf("为定位 MaaFW 加载失败，无法读取资源目录中的 Pipeline 条目：%v", err),
					SourcePath: path,
					Data: map[string]interface{}{
						"bundlePath": bundlePath,
						"error":      err.Error(),
					},
				}, resourceHealthCategoryLoading, "确认资源目录中的 pipeline 文件仍可访问后重新体检，以继续缩小 MaaFW 加载失败原因。"))
				return nil
			}
			if d.IsDir() {
				return nil
			}
			lower := strings.ToLower(d.Name())
			if !strings.HasSuffix(lower, ".json") && !strings.HasSuffix(lower, ".jsonc") {
				return nil
			}
			data, readErr := os.ReadFile(path)
			relativePath, relErr := filepath.Rel(bundlePath, path)
			if relErr != nil {
				relativePath = d.Name()
			}
			relativePath = filepath.ToSlash(relativePath)
			if readErr != nil {
				diagnostics = append(diagnostics, withResourceHealthMeta(protocol.Diagnostic{
					Severity:   "warning",
					Code:       "debug.resource.pipeline_file_unreadable",
					Message:    fmt.Sprintf("为定位 MaaFW 加载失败，无法读取资源目录中的 Pipeline 文件：%v", readErr),
					SourcePath: path,
					Data: map[string]interface{}{
						"bundlePath":   bundlePath,
						"relativePath": relativePath,
						"error":        readErr.Error(),
					},
				}, resourceHealthCategoryLoading, "确认该 Pipeline 文件仍存在且可访问后重新体检，以继续缩小 MaaFW 加载失败原因。"))
				return nil
			}
			parsed, parseErr := hujson.Parse(data)
			if parseErr != nil {
				bundleFiles = append(bundleFiles, resourceHealthBundlePipelineFile{
					bundlePath:   bundlePath,
					relativePath: relativePath,
					sourcePath:   path,
					parseErr:     parseErr,
				})
				return nil
			}
			parsedCopy := parsed
			bundleFiles = append(bundleFiles, resourceHealthBundlePipelineFile{
				bundlePath:   bundlePath,
				relativePath: relativePath,
				sourcePath:   path,
				parsed:       &parsedCopy,
			})
			return nil
		})
		if walkErr != nil {
			diagnostics = append(diagnostics, withResourceHealthMeta(protocol.Diagnostic{
				Severity:   "warning",
				Code:       "debug.resource.pipeline_file_unreadable",
				Message:    fmt.Sprintf("为定位 MaaFW 加载失败，扫描资源目录中的 pipeline 文件时发生异常：%v", walkErr),
				SourcePath: pipelineDir,
				Data: map[string]interface{}{
					"bundlePath": bundlePath,
					"error":      walkErr.Error(),
				},
			}, resourceHealthCategoryLoading, "确认 bundle 目录中的 pipeline 子目录可访问后重新体检，以继续缩小 MaaFW 加载失败原因。"))
		}
	}
	return bundleFiles, diagnostics
}

func (s *Service) checkBundlePipelineJSONSyntax(
	ctx resourceHealthChecklistContext,
) []protocol.Diagnostic {
	diagnostics := make([]protocol.Diagnostic, 0)
	for _, bundleFile := range ctx.bundleFiles {
		if bundleFile.parseErr == nil {
			continue
		}
		diagnostics = append(diagnostics, withResourceHealthMeta(protocol.Diagnostic{
			Severity:   "error",
			Code:       "debug.resource.pipeline_json_invalid",
			Message:    fmt.Sprintf("为定位 MaaFW 加载失败，检查到资源目录中的 Pipeline 文件存在 JSON/JSONC 格式错误：%v", bundleFile.parseErr),
			FieldPath:  bundleFile.relativePath,
			SourcePath: bundleFile.sourcePath,
			Data: map[string]interface{}{
				"bundlePath":   bundleFile.bundlePath,
				"relativePath": bundleFile.relativePath,
				"error":        bundleFile.parseErr.Error(),
			},
		}, resourceHealthCategoryLoading, "修复该 Pipeline 文件的 JSON/JSONC 语法错误后重新体检，确认 MaaFW 是否恢复可加载。"))
	}
	return diagnostics
}

func (s *Service) checkBundlePipelineDuplicateNodeNames(
	ctx resourceHealthChecklistContext,
) []protocol.Diagnostic {
	diagnostics := make([]protocol.Diagnostic, 0)
	for _, bundleFile := range ctx.bundleFiles {
		if bundleFile.parsed == nil {
			continue
		}
		for _, name := range resourceHealthDuplicateNodeNames(*bundleFile.parsed) {
			diagnostics = append(diagnostics, withResourceHealthMeta(protocol.Diagnostic{
				Severity:   "error",
				Code:       "debug.resource.pipeline_node_name_duplicate",
				Message:    fmt.Sprintf("为定位 MaaFW 加载失败，检查到资源目录中的 Pipeline 文件存在重复节点名：%s。", name),
				FieldPath:  bundleFile.relativePath,
				SourcePath: bundleFile.sourcePath,
				Data: map[string]interface{}{
					"bundlePath":   bundleFile.bundlePath,
					"relativePath": bundleFile.relativePath,
					"nodeName":     name,
				},
			}, resourceHealthCategoryLoading, "修改该 Pipeline 文件中的重复节点名，确保同一文件内每个节点名唯一后重新体检，确认 MaaFW 是否恢复可加载。"))
		}
	}
	return diagnostics
}

func resourceHealthDuplicateNodeNames(value hujson.Value) []string {
	object, ok := value.Value.(*hujson.Object)
	if !ok {
		return nil
	}
	counts := make(map[string]int, len(object.Members))
	duplicates := make([]string, 0)
	for _, member := range object.Members {
		name := resourceHealthObjectMemberName(member)
		if name == "" || strings.HasPrefix(name, "$") {
			continue
		}
		counts[name]++
		if counts[name] == 2 {
			duplicates = append(duplicates, name)
		}
	}
	sort.Strings(duplicates)
	return duplicates
}

func resourceHealthObjectMemberName(member hujson.ObjectMember) string {
	literal, ok := member.Name.Value.(hujson.Literal)
	if !ok {
		return ""
	}
	return literal.String()
}

func annotateResourceHealthDiagnostics(
	diagnostics []protocol.Diagnostic,
	category string,
	suggestion func(protocol.Diagnostic) string,
) []protocol.Diagnostic {
	if len(diagnostics) == 0 {
		return nil
	}
	annotated := make([]protocol.Diagnostic, 0, len(diagnostics))
	for _, diagnostic := range diagnostics {
		annotated = append(annotated, withResourceHealthMeta(
			diagnostic,
			category,
			suggestion(diagnostic),
		))
	}
	return annotated
}

func resourceResolutionSuggestion(diagnostic protocol.Diagnostic) string {
	switch diagnostic.Code {
	case "debug.resource.resolved":
		return "若解析结果不是预期 bundle 根目录，请在调试配置里改成更精确的资源路径。"
	case "debug.resource.duplicate":
		return "删除重复路径，只保留一个 bundle 根目录后重新体检。"
	case "debug.resource.empty":
		return "先在调试配置里补充资源路径，或等待 LocalBridge 扫描出资源包后重新体检。"
	default:
		return "检查资源路径是否指向正确的 bundle 根目录；若存在歧义，请改成更精确的绝对路径后重新体检。"
	}
}

func newResourceHealthDiagnostic(
	category string,
	severity string,
	code string,
	message string,
	suggestion string,
) protocol.Diagnostic {
	return withResourceHealthMeta(protocol.Diagnostic{
		Severity: severity,
		Code:     code,
		Message:  message,
	}, category, suggestion)
}

func newResourceHealthFieldDiagnostic(
	category string,
	severity string,
	code string,
	message string,
	fieldPath string,
	suggestion string,
) protocol.Diagnostic {
	return withResourceHealthMeta(protocol.Diagnostic{
		Severity:  severity,
		Code:      code,
		Message:   message,
		FieldPath: fieldPath,
	}, category, suggestion)
}

func withResourceHealthMeta(
	diagnostic protocol.Diagnostic,
	category string,
	suggestion string,
) protocol.Diagnostic {
	data := make(map[string]interface{}, len(diagnostic.Data)+2)
	for key, value := range diagnostic.Data {
		data[key] = value
	}
	data["category"] = category
	if suggestion != "" {
		data["suggestion"] = suggestion
	}
	diagnostic.Data = data
	return diagnostic
}

func resourceHealthNodeKey(fileID string, nodeID string) string {
	return strings.ToLower(strings.TrimSpace(fileID)) + "\x00" + strings.ToLower(strings.TrimSpace(nodeID))
}

func resourceHealthResolutionData(
	resolutions []mfw.ResourceBundleResolution,
) []map[string]interface{} {
	if len(resolutions) == 0 {
		return nil
	}
	items := make([]map[string]interface{}, 0, len(resolutions))
	for _, resolution := range resolutions {
		items = append(items, resolution.DiagnosticData())
	}
	return items
}
