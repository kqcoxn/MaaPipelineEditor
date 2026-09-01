package projectinterface

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/eventbus"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	fileservice "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/service/file"
)

func TestMain(m *testing.M) {
	_ = logger.Init("ERROR", "", false)
	os.Exit(m.Run())
}

func TestServiceDiscoveryAndContextResolution(t *testing.T) {
	root := t.TempDir()
	mustMkdir(t, filepath.Join(root, "resource", "base"))
	mustMkdir(t, filepath.Join(root, "resource", "extra"))
	mustWrite(t, filepath.Join(root, "interface_zh.json"), `{"Project":"测试项目","Base":"基础资源"}`)
	mustWrite(t, filepath.Join(root, "options.json"), `{
  "option": {
    "Difficulty": {
      "type": "select",
      "default_case": "Hard",
      "cases": [{"name":"Hard","pipeline_override":{"Start":{"timeout":1000}}}]
    }
  },
  "global_option": ["Difficulty"]
}`)
	mustWrite(t, filepath.Join(root, "interface.json"), `{
  // JSONC comment must be accepted.
  "interface_version": 2,
  "name": "demo",
  "label": "$Project",
  "version": "1.0.0",
  "languages": {"zh_cn":"interface_zh.json"},
  "controller": [{"name":"Desktop","label":"Desktop","type":"Win32","attach_resource_path":["resource/extra"]}],
  "resource": [{"name":"Base","label":"$Base","path":["resource/base"],"controller":["Desktop"]}],
  "import": ["options.json"],
  "agent": {"child_exec":"python","child_args":["agent.py"]}
}`)

	bus := eventbus.New()
	files, err := fileservice.NewService(root, nil, []string{".json", ".jsonc"}, 10, 100, bus)
	if err != nil {
		t.Fatal(err)
	}
	if err := files.Start(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(files.Stop)
	service, err := NewService(root, "", files, bus)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(service.Close)
	service.Start()
	status := service.Status()
	if status.State != StateReady {
		t.Fatalf("expected ready, got %#v", status)
	}
	snapshot, err := service.Snapshot("zh_cn")
	if err != nil {
		t.Fatal(err)
	}
	if snapshot.Document["label"] != "测试项目" {
		t.Fatalf("unexpected localized label: %#v", snapshot.Document["label"])
	}
	if _, ok := snapshot.Provenance["/controller/0/name"]; !ok {
		t.Fatalf("nested provenance missing: %#v", snapshot.Provenance)
	}

	plan, err := service.ResolveContext(ContextRequest{Revision: status.Revision, Language: "zh_cn", ControllerName: "Desktop", ResourceName: "Base"})
	if err != nil {
		t.Fatal(err)
	}
	if len(plan.ResourcePaths) != 2 {
		t.Fatalf("expected ordered resource and attach paths, got %#v", plan.ResourcePaths)
	}
	if plan.OptionValues["Difficulty"] != "Hard" {
		t.Fatalf("default option missing: %#v", plan.OptionValues)
	}
	if len(plan.PipelineOverrides) != 1 {
		t.Fatalf("override missing: %#v", plan.PipelineOverrides)
	}
	if len(plan.Agents) != 1 || plan.Agents[0].ChildExec != "python" {
		t.Fatalf("agent missing: %#v", plan.Agents)
	}
	if !plan.Agents[0].Enabled {
		t.Fatal("PI Agent should be enabled by default")
	}
	disabledPlan, err := service.ResolveContext(ContextRequest{
		Revision: status.Revision, Language: "zh_cn", ControllerName: "Desktop", ResourceName: "Base",
		AgentEnabled: map[string]bool{"pi-agent-1": false},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(disabledPlan.Agents) != 1 || disabledPlan.Agents[0].Enabled {
		t.Fatalf("disabled Agent should remain visible but inactive: %#v", disabledPlan.Agents)
	}
}

func TestNestedInterfaceUsesInterfaceDirectoryAsProjectRoot(t *testing.T) {
	root := t.TempDir()
	assetsRoot := filepath.Join(root, "assets")
	resourceRoot := filepath.Join(assetsRoot, "resource", "base")
	mustMkdir(t, resourceRoot)
	mustMkdir(t, filepath.Join(root, "agent"))
	mustWrite(t, filepath.Join(root, "agent", "main.py"), "# fixture")
	mustWrite(t, filepath.Join(assetsRoot, "interface.json"), `{
  "interface_version": 2,
  "name": "nested-layout",
  "controller": [{"name":"c","label":"c","type":"Adb","adb":{}}],
  "resource": [{"name":"r","path":["./resource/base"]}],
  "agent": {"child_exec":"./python/python.exe","child_args":["-u","./agent/main.py"]}
}`)

	schema, err := compileSchema()
	if err != nil {
		t.Fatal(err)
	}
	snapshot, err := (&loader{schema: schema}).load(filepath.Join(assetsRoot, "interface.json"))
	if err != nil {
		t.Fatal(err)
	}
	if !samePath(snapshot.ProjectRoot, assetsRoot) {
		t.Fatalf("project root should be the interface directory: got %s, want %s", snapshot.ProjectRoot, assetsRoot)
	}
	if !samePath(snapshot.InterfaceRoot, assetsRoot) {
		t.Fatalf("interface root should be the entry directory: got %s, want %s", snapshot.InterfaceRoot, assetsRoot)
	}
	plan, err := snapshot.ResolveContext(ContextRequest{
		ControllerName: "c",
		ResourceName:   "r",
		AgentOverrides: map[string]AgentCommandOverride{
			"pi-agent-1": {ChildExec: "python", ChildArgs: []string{"-u", "./agent/main.py"}},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(plan.ResourcePaths) != 1 || !samePath(plan.ResourcePaths[0], resourceRoot) {
		t.Fatalf("resource path should resolve from interface root: %#v", plan.ResourcePaths)
	}
	if !samePath(plan.ProjectRoot, assetsRoot) || !samePath(plan.InterfaceRoot, assetsRoot) {
		t.Fatalf("runtime roots are incorrect: %#v", plan)
	}
	if len(plan.Agents) != 1 || plan.Agents[0].ChildExec != "python" || !containsString(plan.Agents[0].ChildArgs, "./agent/main.py") {
		t.Fatalf("agent override should be part of the runtime plan: %#v", plan.Agents)
	}
}

func TestAliasedInterfaceRootUsesCanonicalPathBoundary(t *testing.T) {
	physicalRoot := t.TempDir()
	aliasRoot := filepath.Join(t.TempDir(), "project")
	if err := os.Symlink(physicalRoot, aliasRoot); err != nil {
		t.Skipf("当前环境无法创建目录符号链接: %v", err)
	}
	mustMkdir(t, filepath.Join(physicalRoot, "resource"))
	entryPath := filepath.Join(physicalRoot, "interface.json")
	mustWrite(t, entryPath, `{
  "interface_version": 2,
  "name": "aliased-root",
  "controller": [{"name":"c","label":"c","type":"Adb","adb":{}}],
  "resource": [{"name":"r","path":["resource"]}]
}`)

	schema, err := compileSchema()
	if err != nil {
		t.Fatal(err)
	}
	snapshot, err := (&loader{schema: schema}).load(filepath.Join(aliasRoot, "interface.json"))
	if err != nil {
		t.Fatal(err)
	}
	if !samePath(snapshot.InterfaceRoot, physicalRoot) {
		t.Fatalf("interface root should resolve to the canonical directory: got %s, want %s", snapshot.InterfaceRoot, physicalRoot)
	}
}

func TestDiscoveredEntryRejectsSymlinkOutsideCanonicalRoot(t *testing.T) {
	root := t.TempDir()
	outsideRoot := t.TempDir()
	outsideEntry := filepath.Join(outsideRoot, "interface.json")
	mustWrite(t, outsideEntry, `{"interface_version":2}`)
	linkedEntry := filepath.Join(root, "interface.json")
	if err := os.Symlink(outsideEntry, linkedEntry); err != nil {
		t.Skipf("当前环境无法创建文件符号链接: %v", err)
	}

	service, err := NewService(root, "", nil, eventbus.New())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(service.Close)
	if _, err := service.resolveDiscoveredEntry(linkedEntry); err == nil || !strings.Contains(err.Error(), "符号链接越出") {
		t.Fatalf("discovered entry escaping through a symlink should be rejected, got %v", err)
	}
}

func TestExplicitInterfaceMayBeOutsideFileRootAndReloadsOnChange(t *testing.T) {
	base := t.TempDir()
	fileRoot := filepath.Join(base, "pipeline")
	interfaceRoot := filepath.Join(base, "project")
	mustMkdir(t, fileRoot)
	mustMkdir(t, filepath.Join(interfaceRoot, "resource"))
	translationPath := filepath.Join(interfaceRoot, "interface_zh.json")
	entryPath := filepath.Join(interfaceRoot, "interface.json")
	mustWrite(t, translationPath, `{"Project":"初始名称"}`)
	mustWrite(t, entryPath, `{
  "interface_version": 2,
  "name": "external-project",
  "label": "$Project",
  "languages": {"zh_cn":"interface_zh.json"},
  "controller": [{"name":"c","label":"c","type":"Adb","adb":{}}],
  "resource": [{"name":"r","path":["resource"]}]
}`)

	bus := eventbus.New()
	files, err := fileservice.NewService(fileRoot, nil, []string{".json"}, 10, 100, bus)
	if err != nil {
		t.Fatal(err)
	}
	if err := files.Start(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(files.Stop)
	service, err := NewService(fileRoot, filepath.Join("..", "project", "interface.json"), files, bus)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(service.Close)
	service.Start()

	status := service.Status()
	if status.State != StateReady || !samePath(status.EffectivePath, entryPath) {
		t.Fatalf("relative external PI entry should be ready: %#v", status)
	}
	snapshot, err := service.Snapshot("zh_cn")
	if err != nil {
		t.Fatal(err)
	}
	if !samePath(snapshot.ProjectRoot, interfaceRoot) || !samePath(snapshot.InterfaceRoot, interfaceRoot) {
		t.Fatalf("PI roots should be independent from file root: %#v", snapshot)
	}
	if snapshot.Document["label"] != "初始名称" {
		t.Fatalf("unexpected initial localization: %#v", snapshot.Document["label"])
	}

	initialRevision := status.Revision
	mustWrite(t, translationPath, `{"Project":"更新名称"}`)
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		status = service.Status()
		if status.Revision != initialRevision {
			break
		}
		time.Sleep(25 * time.Millisecond)
	}
	if status.Revision == initialRevision {
		t.Fatal("external PI source change did not trigger a reload")
	}
	snapshot, err = service.Snapshot("zh_cn")
	if err != nil {
		t.Fatal(err)
	}
	if snapshot.Document["label"] != "更新名称" {
		t.Fatalf("external localization was not reloaded: %#v", snapshot.Document["label"])
	}

	service.Reload(entryPath)
	if service.Status().State != StateReady {
		t.Fatalf("absolute external PI entry should be ready: %#v", service.Status())
	}
}

func TestExplicitMissingExternalInterfaceLoadsWhenCreated(t *testing.T) {
	base := t.TempDir()
	fileRoot := filepath.Join(base, "pipeline")
	interfaceRoot := filepath.Join(base, "project")
	mustMkdir(t, fileRoot)
	mustMkdir(t, interfaceRoot)
	entryPath := filepath.Join(interfaceRoot, "interface.json")

	bus := eventbus.New()
	files, err := fileservice.NewService(fileRoot, nil, []string{".json"}, 10, 100, bus)
	if err != nil {
		t.Fatal(err)
	}
	if err := files.Start(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(files.Stop)
	service, err := NewService(fileRoot, entryPath, files, bus)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(service.Close)
	service.Start()
	if service.Status().State != StateInvalid {
		t.Fatalf("missing explicit PI entry should be invalid: %#v", service.Status())
	}

	mustMkdir(t, filepath.Join(interfaceRoot, "resource"))
	mustWrite(t, entryPath, `{
  "interface_version": 2,
  "name": "created-later",
  "controller": [{"name":"c","label":"c","type":"Adb","adb":{}}],
  "resource": [{"name":"r","path":["resource"]}]
}`)
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		if service.Status().State == StateReady {
			return
		}
		time.Sleep(25 * time.Millisecond)
	}
	t.Fatalf("created external PI entry did not become ready: %#v", service.Status())
}

func TestServiceMultipleDiscoveryAndExplicitOverride(t *testing.T) {
	root := t.TempDir()
	for _, directory := range []string{"a", "b"} {
		mustMkdir(t, filepath.Join(root, directory, "resource"))
		mustWrite(t, filepath.Join(root, directory, "interface.json"), `{"interface_version":2,"name":"`+directory+`","controller":[{"name":"c","label":"c","type":"Adb","adb":{}}],"resource":[{"name":"r","path":["resource"]}]}`)
	}
	bus := eventbus.New()
	files, err := fileservice.NewService(root, nil, []string{".json"}, 10, 100, bus)
	if err != nil {
		t.Fatal(err)
	}
	if err := files.Start(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(files.Stop)
	service, err := NewService(root, "", files, bus)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(service.Close)
	service.Start()
	if service.Status().State != StateMultiple {
		t.Fatalf("expected multiple, got %#v", service.Status())
	}
	service.Reload(filepath.Join("a", "interface.json"))
	if service.Status().State != StateReady || service.Status().Mode != "explicit" {
		t.Fatalf("explicit override failed: %#v", service.Status())
	}
}

func TestReadyInterfaceRestrictsPipelineIndexToDeclaredBundles(t *testing.T) {
	root := t.TempDir()
	resourceRoot := filepath.Join(root, "resource")
	attachedRoot := filepath.Join(root, "attached")
	unrelatedRoot := filepath.Join(root, "unrelated")
	for _, bundle := range []string{resourceRoot, attachedRoot, unrelatedRoot} {
		mustMkdir(t, filepath.Join(bundle, "pipeline"))
		mustWrite(t, filepath.Join(bundle, "pipeline", filepath.Base(bundle)+".json"), `{"Node":{}}`)
	}
	entry := filepath.Join(root, "interface.json")
	mustWrite(t, entry, `{
  "interface_version": 2,
  "name": "filtered-index",
  "controller": [{"name":"c","label":"c","type":"Adb","adb":{},"attach_resource_path":["attached"]}],
  "resource": [{"name":"r","path":["resource"]}]
}`)

	bus := eventbus.New()
	files, err := fileservice.NewService(root, nil, []string{".json"}, 10, 100, bus)
	if err != nil {
		t.Fatal(err)
	}
	if err := files.Start(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(files.Stop)
	if got := files.GetFileList(); len(got) != 3 {
		t.Fatalf("fallback index should include every pipeline directory: %#v", got)
	}

	service, err := NewService(root, "", files, bus)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(service.Close)
	service.Start()
	if service.Status().State != StateReady {
		t.Fatalf("PI should be ready: %#v", service.Status())
	}
	got := files.GetFileList()
	if len(got) != 2 {
		t.Fatalf("PI should retain resource and attached pipelines only: %#v", got)
	}
	for _, file := range got {
		if isWithin(unrelatedRoot, file.FilePath) {
			t.Fatalf("unrelated pipeline remained indexed: %#v", got)
		}
	}

	mustWrite(t, entry, `{ invalid`)
	service.Refresh()
	if service.Status().State != StateInvalid {
		t.Fatalf("PI should become invalid: %#v", service.Status())
	}
	if got := files.GetFileList(); len(got) != 3 {
		t.Fatalf("invalid PI should restore pipeline-directory fallback: %#v", got)
	}
}

func TestServiceKeepsLastGoodForDisplayButBlocksRuntime(t *testing.T) {
	root := t.TempDir()
	mustMkdir(t, filepath.Join(root, "resource"))
	entry := filepath.Join(root, "interface.json")
	mustWrite(t, entry, `{"interface_version":2,"name":"demo","controller":[{"name":"c","label":"c","type":"Adb","adb":{}}],"resource":[{"name":"r","path":["resource"]}]}`)
	bus := eventbus.New()
	files, err := fileservice.NewService(root, nil, []string{".json"}, 10, 100, bus)
	if err != nil {
		t.Fatal(err)
	}
	if err := files.Start(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(files.Stop)
	service, err := NewService(root, "", files, bus)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(service.Close)
	service.Start()
	revision := service.Status().Revision
	mustWrite(t, entry, `{ invalid`)
	service.Refresh()
	if service.Status().State != StateInvalid || !service.Status().HasLastGood {
		t.Fatalf("expected invalid last-good state, got %#v", service.Status())
	}
	snapshot, err := service.Snapshot("zh_cn")
	if err != nil {
		t.Fatal(err)
	}
	if snapshot.Revision != revision {
		t.Fatalf("last-good revision changed: %s", snapshot.Revision)
	}
	if _, err := service.ResolveContext(ContextRequest{Revision: revision, ControllerName: "c", ResourceName: "r"}); err == nil {
		t.Fatal("invalid PI must block new runtime context")
	}
}

func TestInvalidRevisionAndPathBoundary(t *testing.T) {
	root := t.TempDir()
	outside := t.TempDir()
	mustMkdir(t, filepath.Join(root, "resource"))
	mustWrite(t, filepath.Join(root, "interface.json"), `{"interface_version":2,"name":"demo","controller":[{"name":"c","label":"c","type":"Adb","adb":{}}],"resource":[{"name":"r","path":["resource"]}]}`)
	schema, err := compileSchema()
	if err != nil {
		t.Fatal(err)
	}
	loaded, err := (&loader{schema: schema}).load(filepath.Join(root, "interface.json"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := loaded.ResolveContext(ContextRequest{Revision: "stale", ControllerName: "c", ResourceName: "r"}); err == nil {
		t.Fatal("stale revision should fail")
	}
	if _, err := (&loader{schema: schema}).resolveProjectPath(root, filepath.Join(outside, "interface.json"), false); err == nil {
		t.Fatal("path outside the interface directory should fail")
	}
}

func TestHotkeyOptionUsesControllerVirtualKeyCodes(t *testing.T) {
	document := map[string]any{
		"controller":    []any{map[string]any{"name": "desktop", "type": "Win32"}},
		"resource":      []any{map[string]any{"name": "base"}},
		"global_option": []any{"shortcut"},
		"option": map[string]any{"shortcut": map[string]any{
			"type":    "hotkey",
			"hotkeys": []any{map[string]any{"name": "Action", "default": "Ctrl+Shift+A"}},
			"pipeline_override": map[string]any{"KeyDown": map[string]any{
				"primary": "{Action}", "modifier1": "{Action.modifier1}", "modifier2": "{Action.modifier2}",
			}},
		}},
	}
	values, _, overrides, diagnostics := resolveOptions(document, "desktop", "Win32", "base", nil)
	if len(diagnostics) != 0 {
		t.Fatalf("unexpected diagnostics: %#v", diagnostics)
	}
	if values["shortcut"].(map[string]any)["Action"] != "Ctrl+Shift+A" {
		t.Fatalf("hotkey must remain human readable: %#v", values)
	}
	pipeline := overrides[0]["pipeline"].(map[string]any)
	if pipeline["primary"] != 65 || pipeline["modifier1"] != 17 || pipeline["modifier2"] != 16 {
		t.Fatalf("unexpected Win32 key codes: %#v", pipeline)
	}

	_, _, adbOverrides, diagnostics := resolveOptions(document, "desktop", "Adb", "base", map[string]any{"shortcut": map[string]any{"Action": "Alt+E"}})
	if len(diagnostics) != 0 {
		t.Fatalf("unexpected Adb diagnostics: %#v", diagnostics)
	}
	adbPipeline := adbOverrides[0]["pipeline"].(map[string]any)
	if adbPipeline["primary"] != 33 || adbPipeline["modifier1"] != 57 || adbPipeline["modifier2"] != 0 {
		t.Fatalf("unexpected Adb key codes: %#v", adbPipeline)
	}
}

func TestInputPipelineTypeAndI18nOnlySupportedFields(t *testing.T) {
	document := map[string]any{
		"label": "$Label", "name": "$Name", "resource": []any{map[string]any{"name": "$Resource", "path": []any{"$Path"}}},
		"controller": []any{map[string]any{"name": "c", "type": "Adb"}},
		"option": map[string]any{"input": map[string]any{"type": "input", "inputs": []any{
			map[string]any{"name": "count", "pipeline_type": "int", "default": "12"},
			map[string]any{"name": "enabled", "pipeline_type": "bool", "default": "true"},
		}}}, "global_option": []any{"input"},
	}
	localized := localizeDocument(document, map[string]any{"Label": "标签", "Name": "名称", "Resource": "资源", "Path": "路径"}, &[]Diagnostic{}, "test")
	if localized["label"] != "标签" || localized["name"] != "$Name" {
		t.Fatalf("unexpected top-level i18n: %#v", localized)
	}
	resource := objectArray(localized["resource"])[0]
	if resource["name"] != "$Resource" || resource["path"].([]any)[0] != "$Path" {
		t.Fatalf("non-i18n fields were translated: %#v", resource)
	}
	values, _, _, diagnostics := resolveOptions(document, "c", "Adb", "", nil)
	if len(diagnostics) != 0 {
		t.Fatal(diagnostics)
	}
	input := values["input"].(map[string]any)
	if input["count"] != int64(12) || input["enabled"] != true {
		t.Fatalf("pipeline types not converted: %#v", input)
	}
}

func TestSchemaAllowsProjectInterfaceExtensionFields(t *testing.T) {
	schema, err := compileSchema()
	if err != nil {
		t.Fatal(err)
	}
	document := map[string]any{
		"interface_version": 2,
		"name":              "extension-fields",
		"controller":        []any{map[string]any{"name": "c", "type": "Adb", "custom_controller_field": true}},
		"resource":          []any{map[string]any{"name": "r", "path": []any{"resource"}, "custom_resource_field": "value"}},
		"option": map[string]any{
			"demo": map[string]any{
				"type": "input", "lebel": "兼容字段",
				"inputs": []any{map[string]any{"name": "value", "pipeline_type": "string"}},
			},
		},
	}
	if err := schema.Validate(document); err != nil {
		t.Fatalf("Project Interface extension fields should be accepted: %v", err)
	}
}

func TestImportMergeRemapsNestedProvenanceAndSinglePretask(t *testing.T) {
	base := map[string]SourceLocation{"/task/0/name": {File: "main", Line: 1}, "/pretask": {File: "main", Line: 2}}
	source := map[string]SourceLocation{"/task/0/name": {File: "import", Line: 3}, "/pretask": {File: "import", Line: 4}}
	target := map[string]any{"task": []any{map[string]any{"name": "base"}}, "pretask": map[string]any{"name": "base"}}
	imported := map[string]any{"task": []any{map[string]any{"name": "imported"}}, "pretask": map[string]any{"name": "imported"}}
	mergeImported(target, imported, base, source)
	if len(target["task"].([]any)) != 2 || base["/task/1/name"].File != "import" {
		t.Fatalf("nested import provenance missing: %#v", base)
	}
	if len(target["pretask"].([]any)) != 2 || base["/pretask/1"].File != "import" {
		t.Fatalf("single pretask merge/provenance missing: %#v", base)
	}
}

func TestRevisionChangePublishesContextDisposal(t *testing.T) {
	root := t.TempDir()
	mustMkdir(t, filepath.Join(root, "resource"))
	entry := filepath.Join(root, "interface.json")
	mustWrite(t, entry, `{"interface_version":2,"name":"demo","version":"1","controller":[{"name":"c","label":"c","type":"Adb","adb":{}}],"resource":[{"name":"r","path":["resource"]}]}`)
	bus := eventbus.New()
	files, err := fileservice.NewService(root, nil, []string{".json"}, 10, 100, bus)
	if err != nil {
		t.Fatal(err)
	}
	if err := files.Start(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(files.Stop)
	service, err := NewService(root, "", files, bus)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(service.Close)
	service.Start()
	plan, err := service.ResolveContext(ContextRequest{Revision: service.Status().Revision, ControllerName: "c", ResourceName: "r"})
	if err != nil {
		t.Fatal(err)
	}
	var disposed string
	bus.Subscribe(EventContextDisposed, func(event eventbus.Event) { disposed, _ = event.Data.(string) })
	mustWrite(t, entry, `{"interface_version":2,"name":"demo","version":"2","controller":[{"name":"c","label":"c","type":"Adb","adb":{}}],"resource":[{"name":"r","path":["resource"]}]}`)
	service.Refresh()
	if disposed != plan.ContextID {
		t.Fatalf("expected context %s disposal, got %s", plan.ContextID, disposed)
	}
	if _, err := service.Context(plan.ContextID); err == nil {
		t.Fatal("old context should be invalidated")
	}
}

func TestSupervisorEnvironmentOutputAndConflict(t *testing.T) {
	if os.Getenv("MPE_PI_AGENT_HELPER") == "1" {
		fmt.Fprintln(os.Stdout, os.Getenv("PI_CLIENT_NAME")+"|"+filepath.Base(mustGetwd())+"|"+os.Args[len(os.Args)-1])
		if os.Getenv("MPE_PI_AGENT_WAIT") == "1" {
			time.Sleep(5 * time.Second)
		}
		os.Exit(0)
	}
	root := t.TempDir()
	bus := eventbus.New()
	var mu sync.Mutex
	var statuses []AgentProcessStatus
	expectedOutput := "MPE|" + filepath.Base(root) + "|identifier-a"
	outputReady := make(chan struct{}, 1)
	exitedReady := make(chan struct{}, 1)
	bus.Subscribe(eventbus.EventProjectInterfaceAgent, func(event eventbus.Event) {
		if status, ok := event.Data.(AgentProcessStatus); ok {
			mu.Lock()
			statuses = append(statuses, status)
			mu.Unlock()
			for _, line := range status.Output {
				if strings.Contains(line, expectedOutput) {
					select {
					case outputReady <- struct{}{}:
					default:
					}
					if status.State == "exited" {
						select {
						case exitedReady <- struct{}{}:
						default:
						}
					}
					break
				}
			}
		}
	})
	supervisor := NewSupervisor(bus)
	t.Cleanup(supervisor.StopAll)
	plan := &RuntimePlan{ContextID: "context-a", ProjectID: "project", Revision: "revision", Language: "zh_cn", ControllerName: "controller", ResourceName: "resource", ProjectRoot: root}
	agent := AgentPlan{Index: 0, ID: "agent-1", ChildExec: os.Args[0], ChildArgs: []string{"-test.run=TestSupervisorEnvironmentOutputAndConflict"}}
	supervisor.StopAgent(plan.ContextID, agent.ID)
	if err := supervisor.Ensure(plan, agent, "identifier-a", nil); err == nil || !strings.Contains(err.Error(), "启动已取消") {
		t.Fatalf("expected pending start cancellation, got %v", err)
	}
	err := supervisor.Ensure(plan, agent, "identifier-a", map[string]string{"MPE_PI_AGENT_HELPER": "1", "MPE_PI_AGENT_WAIT": "1", "PI_CLIENT_NAME": "MPE"})
	if err != nil {
		t.Fatal(err)
	}
	select {
	case <-outputReady:
	case <-time.After(3 * time.Second):
		mu.Lock()
		snapshot := append([]AgentProcessStatus(nil), statuses...)
		mu.Unlock()
		t.Fatalf("timed out waiting for PI Agent output, got %#v", snapshot)
	}
	conflictPlan := *plan
	conflictPlan.ContextID = "context-b"
	conflictPlan.ResourceName = "other-resource"
	if err := supervisor.Ensure(&conflictPlan, agent, "identifier-a", nil); err == nil || !strings.Contains(err.Error(), "agent_context_conflict") {
		t.Fatalf("expected identifier conflict, got %v", err)
	}
	reusedPlan := *plan
	reusedPlan.ContextID = "context-option-changed"
	supervisor.AdoptContext(&reusedPlan)
	if err := supervisor.Ensure(&reusedPlan, agent, "identifier-a", nil); err != nil {
		t.Fatalf("option-only context should reuse agent: %v", err)
	}
	supervisor.StopContext(plan.ContextID)
	if err := supervisor.Ensure(&reusedPlan, agent, "identifier-a", nil); err != nil {
		t.Fatalf("disposing previous context should keep adopted agent: %v", err)
	}
	supervisor.StopContext(reusedPlan.ContextID)
	select {
	case <-exitedReady:
	case <-time.After(3 * time.Second):
		mu.Lock()
		snapshot := append([]AgentProcessStatus(nil), statuses...)
		mu.Unlock()
		t.Fatalf("timed out waiting for PI Agent exited status, got %#v", snapshot)
	}
	mu.Lock()
	snapshot := append([]AgentProcessStatus(nil), statuses...)
	mu.Unlock()
	for _, status := range snapshot {
		if status.State != "exited" {
			continue
		}
		for _, line := range status.Output {
			if strings.Contains(line, expectedOutput) {
				return
			}
		}
	}
	t.Fatalf("expected exited status to retain PI environment/cwd/identifier output, got %#v", snapshot)
}

func TestSupervisorFailedStartCanRetryImmediately(t *testing.T) {
	if os.Getenv("MPE_PI_AGENT_RETRY_HELPER") == "1" {
		os.Exit(0)
	}
	root := t.TempDir()
	supervisor := NewSupervisor(eventbus.New())
	t.Cleanup(supervisor.StopAll)
	plan := &RuntimePlan{ContextID: "context-retry", ProjectID: "project", Revision: "revision", Language: "zh_cn", ControllerName: "controller", ResourceName: "resource", ProjectRoot: root}
	agent := AgentPlan{Index: 0, ID: "agent-retry", Enabled: true, ChildExec: filepath.Join(root, "missing-agent.exe")}
	if err := supervisor.Ensure(plan, agent, "identifier-retry", nil); err == nil {
		t.Fatal("expected the missing executable to fail")
	}

	supervisor.StopAgentIfRunning(plan.ContextID, agent.ID)
	agent.ChildExec = os.Args[0]
	agent.ChildArgs = []string{"-test.run=TestSupervisorFailedStartCanRetryImmediately"}
	if err := supervisor.Ensure(plan, agent, "identifier-retry", map[string]string{"MPE_PI_AGENT_RETRY_HELPER": "1"}); err != nil {
		t.Fatalf("retry after a failed start should not be canceled: %v", err)
	}
}

func TestSupervisorThrottlesBurstOutput(t *testing.T) {
	if os.Getenv("MPE_PI_AGENT_BURST_HELPER") == "1" {
		for index := 0; index < 500; index++ {
			fmt.Fprintf(os.Stdout, "burst-%03d\n", index)
		}
		os.Exit(0)
	}

	bus := eventbus.New()
	var mu sync.Mutex
	var statuses []AgentProcessStatus
	exited := make(chan struct{}, 1)
	bus.Subscribe(eventbus.EventProjectInterfaceAgent, func(event eventbus.Event) {
		status, ok := event.Data.(AgentProcessStatus)
		if !ok {
			return
		}
		mu.Lock()
		statuses = append(statuses, status)
		mu.Unlock()
		if status.State == "exited" {
			select {
			case exited <- struct{}{}:
			default:
			}
		}
	})

	supervisor := NewSupervisor(bus)
	t.Cleanup(supervisor.StopAll)
	plan := &RuntimePlan{
		ContextID:      "context-burst",
		ProjectID:      "project",
		Revision:       "revision",
		Language:       "zh_cn",
		ControllerName: "controller",
		ResourceName:   "resource",
		ProjectRoot:    t.TempDir(),
	}
	agent := AgentPlan{
		Index:     0,
		ID:        "agent-burst",
		ChildExec: os.Args[0],
		ChildArgs: []string{"-test.run=TestSupervisorThrottlesBurstOutput"},
	}
	if err := supervisor.Ensure(plan, agent, "identifier-burst", map[string]string{"MPE_PI_AGENT_BURST_HELPER": "1"}); err != nil {
		t.Fatal(err)
	}

	select {
	case <-exited:
	case <-time.After(3 * time.Second):
		t.Fatal("timed out waiting for burst helper to exit")
	}

	mu.Lock()
	snapshot := append([]AgentProcessStatus(nil), statuses...)
	mu.Unlock()
	outputEvents := 0
	var final AgentProcessStatus
	for _, status := range snapshot {
		if status.State == "output" {
			outputEvents++
		}
		if status.State == "exited" {
			final = status
		}
	}
	if outputEvents >= 100 {
		t.Fatalf("expected burst output broadcasts to be throttled, got %d events", outputEvents)
	}
	if len(final.Output) != 200 {
		t.Fatalf("expected 200 retained output lines, got %d", len(final.Output))
	}
	if !strings.Contains(final.Output[len(final.Output)-1], "burst-499") {
		t.Fatalf("expected final output to include the last line, got %q", final.Output[len(final.Output)-1])
	}
}

func mustWrite(t *testing.T, path, content string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}
func mustMkdir(t *testing.T, path string) {
	t.Helper()
	if err := os.MkdirAll(path, 0o755); err != nil {
		t.Fatal(err)
	}
}

func mustGetwd() string {
	value, err := os.Getwd()
	if err != nil {
		panic(err)
	}
	return value
}
