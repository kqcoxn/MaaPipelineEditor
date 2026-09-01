package file

import (
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func TestExtractFieldValues(t *testing.T) {
	nodeData := map[string]interface{}{
		"recognition": map[string]interface{}{
			"type": "TemplateMatch",
			"param": map[string]interface{}{
				"template":  []interface{}{"button.png", "button.png"},
				"threshold": 0.8,
			},
		},
		"enabled": true,
		"empty":   "",
		"ignored": nil,
	}

	got := extractFieldValues(nodeData)
	want := []string{"0.8", "TemplateMatch", "button.png", "true"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("extractFieldValues() = %v, want %v", got, want)
	}
}

func TestScanIndexesOnlyPipelineFilesAndInterfaceEntry(t *testing.T) {
	root := t.TempDir()
	pipelinePath := filepath.Join(root, "assets", "resource", "pipeline", "main.json")
	interfacePath := filepath.Join(root, "assets", "interface.json")
	otherPath := filepath.Join(root, "assets", "settings.json")
	hiddenPath := filepath.Join(root, "assets", "resource", "pipeline", ".draft", "hidden.json")
	for path, content := range map[string]string{
		pipelinePath:  `{"PipelineNode":{"action":"DoNothing"}}`,
		interfacePath: `{"NotAPipelineNode":{"action":"Click"}}`,
		otherPath:     `{"AlsoNotPipeline":{"action":"Click"}}`,
		hiddenPath:    `{"HiddenNode":{"action":"Click"}}`,
	} {
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
	}

	scanner := NewScanner(root, nil, []string{".json", ".jsonc"})
	result, err := scanner.ScanWithLimit()
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Files) != 2 {
		t.Fatalf("expected Pipeline plus interface metadata, got %#v", result.Files)
	}
	byPath := map[string]struct {
		nodes int
		hash  string
	}{}
	for _, file := range result.Files {
		byPath[file.AbsPath] = struct {
			nodes int
			hash  string
		}{len(file.Nodes), file.ContentHash}
	}
	if got := byPath[pipelinePath]; got.nodes != 1 || got.hash == "" {
		t.Fatalf("Pipeline file was not parsed: %#v", got)
	}
	if got := byPath[interfacePath]; got.nodes != 0 || got.hash != "" {
		t.Fatalf("interface entry should only retain discovery metadata: %#v", got)
	}
	if _, exists := byPath[otherPath]; exists {
		t.Fatal("non-Pipeline JSON entered the index")
	}
	if _, exists := byPath[hiddenPath]; exists {
		t.Fatal("dot-prefixed Pipeline path entered the index")
	}
}

func TestPipelineRootItselfIsIndexable(t *testing.T) {
	root := filepath.Join(t.TempDir(), "pipeline")
	path := filepath.Join(root, "nested", "main.jsonc")
	if !IsPipelineFile(root, path) {
		t.Fatalf("file below a pipeline root should be indexable: %s", path)
	}
	if IsPipelineFile(filepath.Dir(root), filepath.Join(filepath.Dir(root), "pipeline.json")) {
		t.Fatal("a similarly named file outside a pipeline directory was accepted")
	}
}

func TestPipelineRootDescendantIsIndexable(t *testing.T) {
	bundleRoot := t.TempDir()
	root := filepath.Join(bundleRoot, "pipeline", "subdir")
	path := filepath.Join(root, "nested", "main.json")
	if !IsPipelineFile(root, path) {
		t.Fatalf("file below a descendant of a pipeline root should be indexable: %s", path)
	}
	if IsPipelineFile(filepath.Join(bundleRoot, "pipeline", ".draft"), filepath.Join(bundleRoot, "pipeline", ".draft", "main.json")) {
		t.Fatal("a scan root below a dot-prefixed Pipeline path was accepted")
	}
}

func TestIsWithinPathAcceptsEquivalentSymlinkPath(t *testing.T) {
	root := t.TempDir()
	filePath := filepath.Join(root, "pipeline", "main.json")
	if err := os.MkdirAll(filepath.Dir(filePath), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filePath, []byte(`{"Node":{}}`), 0o644); err != nil {
		t.Fatal(err)
	}
	aliasRoot := filepath.Join(t.TempDir(), "project")
	if err := os.Symlink(root, aliasRoot); err != nil {
		t.Skipf("当前环境无法创建目录符号链接: %v", err)
	}
	if !isWithinPath(filepath.Join(aliasRoot, "pipeline"), filePath) {
		t.Fatalf("equivalent filesystem paths should share the same boundary: root=%s path=%s", aliasRoot, filePath)
	}
}

func TestScanSingleKeepsPipelineInterfaceAsDiscoveryMetadata(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "pipeline", "interface.json")
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(`{"NotAPipelineNode":{"action":"Click"}}`), 0o644); err != nil {
		t.Fatal(err)
	}

	file, err := NewScanner(root, nil, []string{".json", ".jsonc"}).ScanSingle(path)
	if err != nil {
		t.Fatal(err)
	}
	if file == nil {
		t.Fatal("interface entry should remain available for PI discovery")
	}
	if len(file.Nodes) != 0 || file.ContentHash != "" {
		t.Fatalf("interface entry should not be parsed as Pipeline: %#v", file)
	}
}
