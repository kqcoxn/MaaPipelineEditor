package diagnostics

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/protocol"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/mfw"
	"github.com/tailscale/hujson"
)

type resourceHealthChecklistContext struct {
	bundleFiles []resourceHealthBundlePipelineFile
	resolutions []mfw.ResourceBundleResolution
}

type resourceHealthBundlePipelineFile struct {
	bundlePath   string
	relativePath string
	sourcePath   string
	parsed       *hujson.Value
	parseErr     error
	source       []byte
}

var resourceHealthStaticChecklist = []func(*Service, resourceHealthChecklistContext) []protocol.Diagnostic{
	(*Service).checkBundlePipelineJSONSyntax,
	(*Service).checkBundlePipelineDuplicateNodeNames,
	(*Service).checkBundlePipelineReferences,
}

func (s *Service) checkBundlePipelineDiagnostics(
	resolutions []mfw.ResourceBundleResolution,
) []protocol.Diagnostic {
	bundleFiles, inspectionDiagnostics := s.inspectBundlePipelineFiles(resolutions)
	ctx := resourceHealthChecklistContext{
		bundleFiles: bundleFiles,
		resolutions: uniqueResourceHealthResolutions(resolutions),
	}
	diagnostics := make([]protocol.Diagnostic, 0, len(inspectionDiagnostics))
	diagnostics = append(diagnostics, inspectionDiagnostics...)
	for _, check := range resourceHealthStaticChecklist {
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
		// Image/model-only overlay bundles need not contain a pipeline directory.
		if _, err := os.Stat(pipelineDir); os.IsNotExist(err) {
			continue
		}
		walkErr := filepath.WalkDir(pipelineDir, func(path string, d os.DirEntry, err error) error {
			if err != nil {
				diagnostics = append(diagnostics, withResourceHealthMeta(protocol.Diagnostic{
					Severity:   "warning",
					Code:       "debug.resource.pipeline_file_unreadable",
					Message:    fmt.Sprintf("无法读取资源目录中的 Pipeline 条目：%v", err),
					SourcePath: path,
					Data: map[string]interface{}{
						"bundlePath": bundlePath,
						"error":      err.Error(),
					},
				}, resourceHealthCategoryLoading, "确认资源目录中的 pipeline 文件仍可访问后重新体检。"))
				return nil
			}
			if strings.HasPrefix(d.Name(), ".") {
				if d.IsDir() {
					return filepath.SkipDir
				}
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
					Message:    fmt.Sprintf("无法读取资源目录中的 Pipeline 文件：%v", readErr),
					SourcePath: path,
					Data: map[string]interface{}{
						"bundlePath":   bundlePath,
						"relativePath": relativePath,
						"error":        readErr.Error(),
					},
				}, resourceHealthCategoryLoading, "确认该 Pipeline 文件仍存在且可访问后重新体检。"))
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
				source:       data,
			})
			return nil
		})
		if walkErr != nil {
			diagnostics = append(diagnostics, withResourceHealthMeta(protocol.Diagnostic{
				Severity:   "warning",
				Code:       "debug.resource.pipeline_file_unreadable",
				Message:    fmt.Sprintf("扫描资源目录中的 pipeline 文件时发生异常：%v", walkErr),
				SourcePath: pipelineDir,
				Data: map[string]interface{}{
					"bundlePath": bundlePath,
					"error":      walkErr.Error(),
				},
			}, resourceHealthCategoryLoading, "确认 bundle 目录中的 pipeline 子目录可访问后重新体检。"))
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
			Message:    fmt.Sprintf("检查到资源目录中的 Pipeline 文件存在 JSON/JSONC 格式错误：%v", bundleFile.parseErr),
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
	type occurrence struct {
		bundleFile resourceHealthBundlePipelineFile
	}
	byBundle := make(map[string]map[string][]occurrence)
	for _, bundleFile := range ctx.bundleFiles {
		if bundleFile.parsed == nil {
			continue
		}
		object, ok := bundleFile.parsed.Value.(*hujson.Object)
		if !ok {
			continue
		}
		bundleKey := resolvedPathKey(bundleFile.bundlePath)
		if byBundle[bundleKey] == nil {
			byBundle[bundleKey] = make(map[string][]occurrence)
		}
		for _, member := range object.Members {
			name := resourceHealthObjectMemberName(member)
			if name == "" || strings.HasPrefix(name, "$") {
				continue
			}
			byBundle[bundleKey][name] = append(byBundle[bundleKey][name], occurrence{bundleFile: bundleFile})
		}
	}

	bundleKeys := make([]string, 0, len(byBundle))
	for bundleKey := range byBundle {
		bundleKeys = append(bundleKeys, bundleKey)
	}
	sort.Strings(bundleKeys)
	for _, bundleKey := range bundleKeys {
		names := make([]string, 0)
		for name, occurrences := range byBundle[bundleKey] {
			if len(occurrences) > 1 {
				names = append(names, name)
			}
		}
		sort.Strings(names)
		for _, name := range names {
			occurrences := byBundle[bundleKey][name]
			conflictFiles := make([]string, 0, len(occurrences))
			seenFiles := make(map[string]struct{}, len(occurrences))
			for _, item := range occurrences {
				if _, exists := seenFiles[item.bundleFile.relativePath]; exists {
					continue
				}
				seenFiles[item.bundleFile.relativePath] = struct{}{}
				conflictFiles = append(conflictFiles, item.bundleFile.relativePath)
			}
			first := occurrences[0].bundleFile
			diagnostics = append(diagnostics, withResourceHealthMeta(protocol.Diagnostic{
				Severity:   "error",
				Code:       "debug.resource.pipeline_node_name_duplicate",
				Message:    fmt.Sprintf("同一 Bundle 中存在重复节点名 %s：%s。", name, strings.Join(conflictFiles, "、")),
				FieldPath:  first.relativePath,
				SourcePath: first.sourcePath,
				Data: map[string]interface{}{
					"bundlePath":      first.bundlePath,
					"relativePath":    first.relativePath,
					"nodeName":        name,
					"conflictFiles":   conflictFiles,
					"occurrenceCount": len(occurrences),
				},
			}, resourceHealthCategoryLoading, "修改冲突节点名，确保同一 Bundle 内所有 Pipeline 文件的节点名唯一后重新体检。"))
		}
	}
	return diagnostics
}

func resourceHealthObjectMemberName(member hujson.ObjectMember) string {
	literal, ok := member.Name.Value.(hujson.Literal)
	if !ok {
		return ""
	}
	return literal.String()
}
