package diagnostics

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/protocol"
)

func checkResourceRecognitionTemplates(ctx resourceHealthChecklistContext, name string, reco resourceReferenceField) []protocol.Diagnostic {
	// Inline sub-recognitions use the same v1/v2 node syntax as parse_recognition.
	// A string here is a runtime node reference, not an image path.
	return checkEffectiveResourceImageRecognition(ctx, name,
		mergeResourceImageRecognition(reco, resourceImageRecognition{kind: "DirectHit"}))
}

func checkResourceTemplateField(ctx resourceHealthChecklistContext, name string, field resourceReferenceField) []protocol.Diagnostic {
	var diagnostics []protocol.Diagnostic
	for _, ref := range resourceReferenceItems(field) {
		template, ok := resourceReferenceString(ref.value)
		if !ok || template == "" {
			continue
		}
		found := false
		var paths []string
		var readErr error
		for _, resolution := range ctx.resolutions {
			imagePath := filepath.FromSlash(strings.ReplaceAll(template, "\\", "/"))
			if !filepath.IsAbs(imagePath) {
				imagePath = filepath.Join(resolution.ResolvedPath, "image", imagePath)
			}
			paths = append(paths, imagePath)
			info, err := os.Stat(imagePath)
			if err == nil && (info.Mode().IsRegular() || info.IsDir()) {
				found = true
				break
			}
			if err != nil && !os.IsNotExist(err) {
				readErr = err
			}
		}
		if !found {
			severity, code := "warning", "debug.resource.pipeline_image_missing"
			message := fmt.Sprintf("节点「%s」的 %s 引用了不存在的图片「%s」。", name, ref.path, template)
			suggestion := "图片在识别时读取，不阻止资源加载或调试；若执行到该识别，请补齐 image 目录中的图片、修正 template 路径，或确保运行时已注入同名图片。"
			if readErr != nil {
				severity, code = "warning", "debug.resource.pipeline_image_unreadable"
				message = fmt.Sprintf("无法检查节点「%s」引用的图片「%s」：%v。", name, template, readErr)
				suggestion = "检查图片路径和访问权限后重新检测。"
			} else if filepath.Ext(template) == "" {
				severity, code = "warning", "debug.resource.pipeline_image_dynamic"
				message = fmt.Sprintf("节点「%s」引用的「%s」不是现有图片或目录，可能是运行时注入的图片名。", name, template)
				suggestion = "若使用动态图片，请确保识别前已注入；若使用文件或目录，请修正 template 路径。"
			}
			d := resourceReferenceDiagnostic(ref, name, severity, code, message, suggestion, template)
			d.Data["searchedPaths"] = paths
			diagnostics = append(diagnostics, d)
		}
		if strings.Contains(template, "\\") {
			diagnostics = append(diagnostics, resourceReferenceDiagnostic(ref, name, "warning", "debug.resource.pipeline_image_path_separator",
				fmt.Sprintf("节点「%s」的图片路径「%s」使用了反斜杠。", name, template), "建议使用 / 作为图片路径分隔符，避免跨平台运行时找不到文件。", template))
		}
	}
	return diagnostics
}
