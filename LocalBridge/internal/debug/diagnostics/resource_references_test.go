package diagnostics

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/protocol"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/mfw"
)

func writeReferencePipeline(t *testing.T, bundle, name, content string) string {
	t.Helper()
	path := filepath.Join(bundle, "pipeline", name)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestResourcePreflightReportsMissingReferencesWithNativeFailure(t *testing.T) {
	bundle := createResourceBundleDir(t)
	path := writeReferencePipeline(t, bundle, "battle.jsonc", `{
  // 编辑器的外部节点记录不是节点定义
  "$__mpe_external_Missing": {},
  "战斗": {
    "next": ["[JumpBack]Missing"],
    "recognition": {"type": "TemplateMatch", "param": {"template": "TODO.png"}}
  }
}`)
	service := NewService(nil, "")
	service.resourceLoadAvailableFn = func() bool { return true }
	service.resourceBundleChecker = func([]string) (string, []mfw.ResourceBundleResolution, error) {
		return "", nil, fmt.Errorf("invalid next node")
	}
	result := service.CheckResourcePreflight(protocol.ResourcePreflightRequest{ResourcePaths: []string{bundle}})
	for _, code := range []string{"debug.resource.pipeline_node_missing", "debug.resource.pipeline_image_missing"} {
		d := findDiagnostic(t, result.Diagnostics, code)
		if d.SourcePath != path || d.FieldPath == "" || d.Data["nodeName"] != "战斗" || d.Data["line"] == nil {
			t.Fatalf("missing actionable source location: %#v", d)
		}
		assertDiagnosticSuggestion(t, result.Diagnostics, code)
		wantLine := 5
		if code == "debug.resource.pipeline_image_missing" {
			wantLine = 6
		}
		if d.Data["line"] != wantLine {
			t.Fatalf("source line = %v, want %d", d.Data["line"], wantLine)
		}
	}
	if result.Status != "failed" {
		t.Fatalf("status = %s", result.Status)
	}
}

func TestResourcePreflightMissingImageDoesNotBlockNativeLoad(t *testing.T) {
	bundle := createResourceBundleDir(t)
	writeReferencePipeline(t, bundle, "main.json", `{"Start":{"recognition":"TemplateMatch","template":"missing.png"}}`)
	service := NewService(nil, "")
	service.resourceLoadAvailableFn = func() bool { return true }
	called := false
	service.resourceBundleChecker = func([]string) (string, []mfw.ResourceBundleResolution, error) {
		called = true
		return "hash", []mfw.ResourceBundleResolution{{ResolvedPath: bundle}}, nil
	}
	result := service.CheckResourcePreflight(protocol.ResourcePreflightRequest{ResourcePaths: []string{bundle}})
	if !called || result.Status != "ready" || findDiagnostic(t, result.Diagnostics, "debug.resource.pipeline_image_missing").Severity != "warning" {
		t.Fatalf("image warning must allow native load and debugging: %#v", result)
	}
}

func TestResourceReferencesObjectNamesAreLiteral(t *testing.T) {
	bundle := createResourceBundleDir(t)
	writeReferencePipeline(t, bundle, "main.json", `{"Start":{"next":[{"name":"[Anchor]Missing"},{"name":"[JumpBack]End"}]},"[JumpBack]End":{}}`)
	diagnostics := NewService(nil, "").checkBundlePipelineDiagnostics([]mfw.ResourceBundleResolution{{ResolvedPath: bundle}})
	d := findDiagnostic(t, diagnostics, "debug.resource.pipeline_node_missing")
	if d.Data["target"] != "[Anchor]Missing" {
		t.Fatalf("object names must not parse attributes: %#v", diagnostics)
	}
}

func TestResourceReferencesRecognitionInheritance(t *testing.T) {
	for _, tc := range []struct{ name, base, overlay, target string }{
		{"v2 to v1", `{"recognition":{"type":"TemplateMatch","param":{"template":"old.png"}}}`, `{"template":"new.png"}`, "new.png"},
		{"inline v2", `{}`, `{"recognition":{"type":"FeatureMatch","template":"new.png"}}`, "new.png"},
		{"default type", `{"recognition":"TemplateMatch","template":"old.png"}`, `{"recognition":{"param":{"threshold":0.8}}}`, "old.png"},
		{"changed type", `{"recognition":"TemplateMatch","template":"old.png"}`, `{"recognition":"OCR"}`, ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			base, overlay := createResourceBundleDir(t), createResourceBundleDir(t)
			writeReferencePipeline(t, base, "base.json", `{"Start":`+tc.base+`}`)
			writeReferencePipeline(t, overlay, "overlay.json", `{"Start":`+tc.overlay+`}`)
			diagnostics := NewService(nil, "").checkBundlePipelineDiagnostics([]mfw.ResourceBundleResolution{{ResolvedPath: base}, {ResolvedPath: overlay}})
			if tc.target == "" {
				assertDiagnosticMissing(t, diagnostics, "debug.resource.pipeline_image_missing")
				return
			}
			d := findDiagnostic(t, diagnostics, "debug.resource.pipeline_image_missing")
			if d.Data["target"] != tc.target {
				t.Fatalf("wrong effective template: %#v", diagnostics)
			}
		})
	}
}

func TestResourceReferencesResolveAcrossFilesAndIgnoreHiddenMetadata(t *testing.T) {
	bundle := createResourceBundleDir(t)
	writeReferencePipeline(t, bundle, "main.json", `{"Start":{"next":["[JumpBack]End","[Anchor]Dynamic"],"recognition":"TemplateMatch","template":"ok.png"},"$meta":{"next":"Missing"}}`)
	writeReferencePipeline(t, bundle, "sub/end.jsonc", `{"End":{}}`)
	writeReferencePipeline(t, bundle, ".ignored/broken.json", `{ invalid`)
	if err := os.WriteFile(filepath.Join(bundle, "image", "ok.png"), []byte("placeholder"), 0o644); err != nil {
		t.Fatal(err)
	}
	diagnostics := NewService(nil, "").checkBundlePipelineDiagnostics([]mfw.ResourceBundleResolution{{ResolvedPath: bundle}})
	if HasBlockingDiagnostic(diagnostics) {
		t.Fatalf("unexpected errors: %#v", diagnostics)
	}
}

func TestResourceReferencesRespectBundleLoadOrder(t *testing.T) {
	base, overlay := createResourceBundleDir(t), createResourceBundleDir(t)
	writeReferencePipeline(t, base, "base.json", `{"Base":{}}`)
	writeReferencePipeline(t, overlay, "overlay.json", `{"Overlay":{"next":"Base"}}`)
	service := NewService(nil, "")
	valid := service.checkBundlePipelineDiagnostics([]mfw.ResourceBundleResolution{{ResolvedPath: base}, {ResolvedPath: overlay}})
	assertDiagnosticMissing(t, valid, "debug.resource.pipeline_node_missing")
	invalid := service.checkBundlePipelineDiagnostics([]mfw.ResourceBundleResolution{{ResolvedPath: overlay}, {ResolvedPath: base}})
	assertDiagnosticCode(t, invalid, "debug.resource.pipeline_node_missing")
}

func TestResourceReferencesWarnForDynamicImages(t *testing.T) {
	bundle := createResourceBundleDir(t)
	writeReferencePipeline(t, bundle, "dynamic.json", `{"Start":{"recognition":{"type":"TemplateMatch","param":{"template":"runtime_image"}}}}`)
	diagnostics := NewService(nil, "").checkBundlePipelineDiagnostics([]mfw.ResourceBundleResolution{{ResolvedPath: bundle}})
	d := findDiagnostic(t, diagnostics, "debug.resource.pipeline_image_dynamic")
	if d.Severity != "warning" || HasBlockingDiagnostic(diagnostics) {
		t.Fatalf("dynamic image must only warn: %#v", diagnostics)
	}
}

func TestResourceReferencesCheckObjectNextAndNestedTemplates(t *testing.T) {
	bundle := createResourceBundleDir(t)
	writeReferencePipeline(t, bundle, "nested.json", `{
  "Start": {
    "next": [{"name":"Missing","jump_back":true}, {"name":"Dynamic","anchor":true}],
    "on_error": "MissingError",
    "recognition": {"type":"And","param":{"all_of":[
      {"recognition":{"type":"TemplateMatch","param":{"template":["missing.png"]}}},
      {"recognition":"Custom","custom_recognition_param":{"template":"not_an_image.png"}}
    ]}}
  }
}`)
	diagnostics := NewService(nil, "").checkBundlePipelineDiagnostics([]mfw.ResourceBundleResolution{{ResolvedPath: bundle}})
	counts := map[string]int{}
	for _, d := range diagnostics {
		counts[d.Code]++
	}
	if counts["debug.resource.pipeline_node_missing"] != 2 || counts["debug.resource.pipeline_image_missing"] != 1 {
		t.Fatalf("unexpected nested diagnostics: %#v", diagnostics)
	}
}

func TestResourceReferencesUseImagesFromAllBundlesAndAllowDirectories(t *testing.T) {
	base, overlay := createResourceBundleDir(t), createResourceBundleDir(t)
	writeReferencePipeline(t, base, "base.json", `{"Start":{"recognition":"TemplateMatch","template":"old.png"}}`)
	writeReferencePipeline(t, overlay, "overlay.json", `{"Start":{"template":["shared.png","icons"]}}`)
	if err := os.WriteFile(filepath.Join(base, "image", "shared.png"), []byte("placeholder"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(filepath.Join(overlay, "image", "icons"), 0o755); err != nil {
		t.Fatal(err)
	}
	diagnostics := NewService(nil, "").checkBundlePipelineDiagnostics([]mfw.ResourceBundleResolution{{ResolvedPath: base}, {ResolvedPath: overlay}})
	if HasBlockingDiagnostic(diagnostics) {
		t.Fatalf("valid overlay images: %#v", diagnostics)
	}
}

func TestResourceReferencesRefreshAfterFilesAreFixed(t *testing.T) {
	bundle := createResourceBundleDir(t)
	writeReferencePipeline(t, bundle, "main.json", `{"Start":{"next":"End","recognition":"TemplateMatch","template":"fixed.png"}}`)
	service := NewService(nil, "")
	resolutions := []mfw.ResourceBundleResolution{{ResolvedPath: bundle}}
	before := service.checkBundlePipelineDiagnostics(resolutions)
	assertDiagnosticCode(t, before, "debug.resource.pipeline_node_missing")
	assertDiagnosticCode(t, before, "debug.resource.pipeline_image_missing")
	writeReferencePipeline(t, bundle, "end.json", `{"End":{}}`)
	if err := os.WriteFile(filepath.Join(bundle, "image", "fixed.png"), []byte("placeholder"), 0o644); err != nil {
		t.Fatal(err)
	}
	after := service.checkBundlePipelineDiagnostics(resolutions)
	if HasBlockingDiagnostic(after) {
		t.Fatalf("stale errors after repair: %#v", after)
	}
}
