package diagnostics

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/protocol"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/mfw"
)

func TestResourceResolverScope(t *testing.T) {
	base, en, jp := createResourceBundleDir(t), createResourceBundleDir(t), createResourceBundleDir(t)
	nodes := []protocol.NodeResolverSnapshotNode{
		{FileID: "base", NodeID: "base", RuntimeName: "Shared", SourcePath: filepath.Join(base, "pipeline", "main.json")},
		{FileID: "en", NodeID: "en", RuntimeName: "Shared", SourcePath: filepath.Join(en, "pipeline", "main.json")},
		{FileID: "jp", NodeID: "jp", RuntimeName: "JapaneseOnly", SourcePath: filepath.Join(jp, "pipeline", "main.json")},
	}
	resolved := []mfw.ResourceBundleResolution{{ResolvedPath: base}, {ResolvedPath: en}}
	effective := effectiveResourceResolverNodes(nodes, resolved)
	if len(effective) != 1 || effective[0].FileID != "en" {
		t.Fatalf("incorrect resource scope: %#v", effective)
	}
	nodes = append(nodes, protocol.NodeResolverSnapshotNode{FileID: "en2", NodeID: "en2", RuntimeName: "Shared", SourcePath: filepath.Join(en, "pipeline", "other.json")})
	if effective = effectiveResourceResolverNodes(nodes, resolved); len(effective) != 2 {
		t.Fatalf("same-bundle conflict lost: %#v", effective)
	}
}

func TestNativeLoadDecidesWhetherStaticFindingsBlock(t *testing.T) {
	for _, accepted := range []bool{true, false} {
		t.Run(fmt.Sprint(accepted), func(t *testing.T) {
			bundle := createResourceBundleDir(t)
			writeReferencePipeline(t, bundle, "first.json", `{"Shared":{}}`)
			writeReferencePipeline(t, bundle, "second.json", `{"Shared":{}}`)
			service := NewService(nil, "")
			service.resourceLoadAvailableFn = func() bool { return true }
			called := false
			service.resourceBundleChecker = func([]string) (string, []mfw.ResourceBundleResolution, error) {
				called = true
				if !accepted {
					return "", nil, fmt.Errorf("key already exists")
				}
				return "hash", []mfw.ResourceBundleResolution{{ResolvedPath: bundle}}, nil
			}
			result := service.CheckResourcePreflight(protocol.ResourcePreflightRequest{ResourcePaths: []string{bundle}})
			if !called || (result.Status == "ready") != accepted {
				t.Fatalf("native result ignored: %#v", result)
			}
			if accepted && HasBlockingDiagnostic(result.Diagnostics) {
				t.Fatalf("static result vetoed native success: %#v", result)
			}
			if !accepted {
				assertDiagnosticCode(t, result.Diagnostics, "debug.resource.load_failed")
			}
			if HasBlockingDiagnostic(service.checkResources([]string{bundle})) {
				t.Fatal("run precheck must leave rejection to the runtime loader")
			}
		})
	}
}

func TestImageOnlyBundleDoesNotWarnAboutAbsentPipeline(t *testing.T) {
	bundle := t.TempDir()
	if err := os.Mkdir(filepath.Join(bundle, "image"), 0o755); err != nil {
		t.Fatal(err)
	}
	diagnostics := NewService(nil, "").checkBundlePipelineDiagnostics([]mfw.ResourceBundleResolution{{ResolvedPath: bundle}})
	if len(diagnostics) != 0 {
		t.Fatalf("image-only bundle is valid: %#v", diagnostics)
	}
}

func TestGraphMissingAnchorIsNotAStaticNodeError(t *testing.T) {
	req := protocol.ResourceHealthRequest{
		GraphSnapshot:    protocol.GraphSnapshot{RootFileID: "main", Files: []protocol.GraphFileSnapshot{{FileID: "main", Pipeline: map[string]interface{}{}}}},
		ResolverSnapshot: protocol.NodeResolverSnapshot{RootFileID: "main", Nodes: []protocol.NodeResolverSnapshotNode{{FileID: "main", NodeID: "start", RuntimeName: "Start"}}, Edges: []protocol.NodeResolverSnapshotEdge{{FromRuntimeName: "Start", ToRuntimeName: "DynamicAnchor", Reason: "anchor"}}},
		Target:           &protocol.NodeTarget{FileID: "main", NodeID: "start", RuntimeName: "Start"},
	}
	diagnostics := NewService(nil, "").checkGraphHealth(req)
	if HasBlockingDiagnostic(diagnostics) {
		t.Fatalf("runtime anchor was blocked: %#v", diagnostics)
	}
	assertDiagnosticMissing(t, diagnostics, "debug.resolver.edge_target_unknown")
	req.ResolverSnapshot.Edges[0].Reason = "next"
	diagnostics = NewService(nil, "").checkGraphHealth(req)
	if findDiagnostic(t, diagnostics, "debug.resolver.edge_target_unknown").Severity != "warning" {
		t.Fatal("partial resolver is not native resource validity")
	}
	req.ResolverSnapshot.Nodes = append(req.ResolverSnapshot.Nodes, protocol.NodeResolverSnapshotNode{FileID: "main", NodeID: "second", RuntimeName: "Start"})
	req.Target.NodeID = "second"
	diagnostics = NewService(nil, "").checkGraphHealth(req)
	if HasBlockingDiagnostic(diagnostics) {
		t.Fatalf("explicit target must be resolved by identity, not the first namesake: %#v", diagnostics)
	}
}
