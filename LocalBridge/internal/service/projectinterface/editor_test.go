package projectinterface

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/eventbus"
	fileservice "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/service/file"
)

func editorFixture(t *testing.T) (*Service, string) {
	t.Helper()
	root, err := filepath.EvalSymlinks(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	mustWrite(t, filepath.Join(root, "interface.json"), `{"interface_version":2,"name":"test","controller":[{"name":"adb","type":"Adb"}],"resource":[{"name":"base","path":["resource"]}],"import":["tasks/a.json","tasks/b.json"],"languages":{"zh_cn":"zh.json"}}`)
	if err = os.MkdirAll(filepath.Join(root, "resource"), 0755); err != nil {
		t.Fatal(err)
	}
	if err = os.MkdirAll(filepath.Join(root, "tasks"), 0755); err != nil {
		t.Fatal(err)
	}
	mustWrite(t, filepath.Join(root, "tasks/a.json"), "{\n// comment\n\"task\":[{\"name\":\"A\",\"entry\":\"Start\",\"label\":\"$label\",\"option\":[\"shared\"]}],\"option\":{\"shared\":{\"type\":\"select\",\"cases\":[{\"name\":\"yes\"}]}}}")
	mustWrite(t, filepath.Join(root, "tasks/b.json"), `{"task":[{"name":"B","entry":"Start","option":["shared"]}]}`)
	mustWrite(t, filepath.Join(root, "zh.json"), `{"label":"任务"}`)
	bus := eventbus.New()
	files, err := fileservice.NewService(root, nil, []string{".json", ".jsonc"}, 20, 1000, bus)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(files.Stop)
	svc, err := NewService(root, filepath.Join(root, "interface.json"), files, bus)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(svc.Close)
	svc.Start()
	return svc, root
}
func editorDoc(t *testing.T, p *EditorProject, suffix string) EditorDocument {
	t.Helper()
	for _, d := range p.Documents {
		if strings.HasSuffix(filepath.ToSlash(d.Path), suffix) {
			return d
		}
	}
	t.Fatalf("missing %s", suffix)
	return EditorDocument{}
}
func TestEditorRawSourcesAndReferences(t *testing.T) {
	s, _ := editorFixture(t)
	p, err := s.ReadEditor(EditorRequest{})
	if err != nil {
		t.Fatal(err)
	}
	if len(p.Documents) != 4 {
		t.Fatal(len(p.Documents))
	}
	doc := editorDoc(t, p, "tasks/a.json")
	if !strings.Contains(doc.Content, "// comment") || !strings.Contains(doc.Content, "$label") {
		t.Fatal("source localized or reformatted")
	}
	count := 0
	for _, r := range p.References {
		if r.Kind == "option" && r.Name == "shared" {
			count++
		}
	}
	if count != 2 {
		t.Fatal(p.References)
	}
}
func TestEditorSavePreservesRawAndRejectsConflicts(t *testing.T) {
	s, _ := editorFixture(t)
	p, _ := s.ReadEditor(EditorRequest{})
	a := editorDoc(t, p, "tasks/a.json")
	edited := strings.Replace(a.Content, `"entry":"Start"`, `"entry":"NewStart"`, 1)
	req := EditorRequest{EntryPath: p.EntryPath, Changes: []EditorChange{{Path: a.Path, Version: a.Version, Content: edited}}}
	if _, err := s.SaveEditor(req); err != nil {
		t.Fatal(err)
	}
	raw, _ := os.ReadFile(a.Path)
	if string(raw) != edited {
		t.Fatal("save reformatted source")
	}
	if _, err := s.SaveEditor(req); err == nil {
		t.Fatal("stale save accepted")
	} else {
		var conflict *EditorConflictError
		if !errors.As(err, &conflict) {
			t.Fatal(err)
		}
	}
}
func TestEditorNewFileAndImportTransaction(t *testing.T) {
	s, root := editorFixture(t)
	p, _ := s.ReadEditor(EditorRequest{})
	entry := editorDoc(t, p, "interface.json")
	updated := strings.Replace(entry.Content, `"tasks/b.json"`, `"tasks/b.json","tasks/new.json"`, 1)
	req := EditorRequest{EntryPath: p.EntryPath, Paths: []string{"tasks/new.json"}, Changes: []EditorChange{{Path: entry.Path, Version: entry.Version, Content: updated}, {Path: filepath.Join(root, "tasks/new.json"), Version: "missing", Content: `{"task":[{"name":"new","entry":"Start"}]}`}}}
	if _, err := s.SaveEditor(req); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(root, "tasks/new.json")); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(root, editorJournalName)); !os.IsNotExist(err) {
		t.Fatal("journal retained after commit")
	}
}
func TestEditorValidationPreventsPartialWrite(t *testing.T) {
	s, _ := editorFixture(t)
	p, _ := s.ReadEditor(EditorRequest{})
	a := editorDoc(t, p, "tasks/a.json")
	b := editorDoc(t, p, "tasks/b.json")
	req := EditorRequest{Changes: []EditorChange{{Path: a.Path, Version: a.Version, Content: strings.Replace(a.Content, `"Start"`, `"changed"`, 1)}, {Path: b.Path, Version: b.Version, Content: `{"task":[{"name":"B","entry":"Start","option":["missing"]}]}`}}}
	if _, err := s.SaveEditor(req); err == nil {
		t.Fatal("invalid references saved")
	}
	raw, _ := os.ReadFile(a.Path)
	if string(raw) != a.Content {
		t.Fatal("partially wrote first file")
	}
}
func TestEditorRecoversInterruptedSave(t *testing.T) {
	s, root := editorFixture(t)
	p, _ := s.ReadEditor(EditorRequest{})
	a := editorDoc(t, p, "tasks/a.json")
	after := strings.Replace(a.Content, "Start", "Changed", 1)
	journal, _ := json.Marshal(editorJournal{Files: []editorBackup{{Path: a.Path, Before: []byte(a.Content), AfterHash: hashString(after), Exists: true, Mode: 0644}}})
	mustWrite(t, filepath.Join(root, editorJournalName), string(journal))
	mustWrite(t, a.Path, after)
	s.Refresh()
	raw, _ := os.ReadFile(a.Path)
	if string(raw) != a.Content {
		t.Fatal("recovery failed")
	}
}
func TestEditorBrokenEntryRemainsEditableAndSymlinksBlocked(t *testing.T) {
	s, root := editorFixture(t)
	mustWrite(t, filepath.Join(root, "interface.json"), "{broken")
	s.Refresh()
	p, err := s.ReadEditor(EditorRequest{})
	if err != nil {
		t.Fatal(err)
	}
	if editorDoc(t, p, "interface.json").Error == "" {
		t.Fatal("missing syntax error")
	}
	editorDoc(t, p, "tasks/a.json")
	outside, err := filepath.EvalSymlinks(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err = os.Symlink(outside, filepath.Join(root, "escape")); err != nil {
		t.Skip(err)
	}
	if _, err = editorPath(root, "escape/new.json"); err == nil {
		t.Fatal("symlink escaped root")
	}
}
func TestEditorCycleAndOverrideIndex(t *testing.T) {
	s, _ := editorFixture(t)
	p, _ := s.ReadEditor(EditorRequest{})
	b := editorDoc(t, p, "tasks/b.json")
	p, err := s.ReadEditor(EditorRequest{Changes: []EditorChange{{Path: b.Path, Content: `{"option":{"shared":{"cases":[{"name":"yes","option":["shared"]}]}}}`}}})
	if err != nil {
		t.Fatal(err)
	}
	n := 0
	for _, d := range p.Definitions {
		if d.Kind == "option" && d.Name == "shared" && d.Effective {
			n++
			if d.File != b.Path {
				t.Fatal("wrong effective source")
			}
		}
	}
	if n != 1 {
		t.Fatal(n)
	}
	found := false
	for _, d := range p.Diagnostics {
		if strings.Contains(d.Message, "循环") {
			found = true
		}
	}
	if !found {
		t.Fatal("cycle undetected")
	}
}
func TestEditorExecutionLease(t *testing.T) {
	s, _ := editorFixture(t)
	s.SetEditorLease(func() (func(), error) { return nil, errors.New("running") })
	if _, err := s.SaveEditor(EditorRequest{}); err == nil {
		t.Fatal("saved while running")
	}
}

func TestEditorWriteFailureRollsBackAllFiles(t *testing.T) {
	s, _ := editorFixture(t)
	p, _ := s.ReadEditor(EditorRequest{})
	a := editorDoc(t, p, "tasks/a.json")
	b := editorDoc(t, p, "tasks/b.json")
	s.editorWrite = func(path string, raw []byte, mode os.FileMode) error {
		if path == b.Path {
			return errors.New("injected disk failure")
		}
		return writeEditorAtomic(path, raw, mode)
	}
	req := EditorRequest{Changes: []EditorChange{{Path: a.Path, Version: a.Version, Content: strings.Replace(a.Content, "Start", "Updated", 1)}, {Path: b.Path, Version: b.Version, Content: strings.Replace(b.Content, "Start", "Updated", 1)}}}
	if _, err := s.SaveEditor(req); err == nil || !strings.Contains(err.Error(), "disk failure") {
		t.Fatal(err)
	}
	for _, doc := range []EditorDocument{a, b} {
		raw, _ := os.ReadFile(doc.Path)
		if string(raw) != doc.Content {
			t.Fatalf("partial write: %s", doc.Path)
		}
	}
}
func TestEditorRecoveryDoesNotOverwriteNewExternalChanges(t *testing.T) {
	s, root := editorFixture(t)
	p, _ := s.ReadEditor(EditorRequest{})
	a := editorDoc(t, p, "tasks/a.json")
	journal, _ := json.Marshal(editorJournal{Files: []editorBackup{{Path: a.Path, Before: []byte(a.Content), AfterHash: hashString("saved"), Exists: true, Mode: 0644}}})
	mustWrite(t, filepath.Join(root, editorJournalName), string(journal))
	mustWrite(t, a.Path, `{"external":true}`)
	s.Refresh()
	if s.Status().State != StateInvalid {
		t.Fatal("recovery failure did not block runtime")
	}
	raw, _ := os.ReadFile(a.Path)
	if string(raw) != `{"external":true}` {
		t.Fatal("external edit overwritten")
	}
}
func TestEditorMaaDuDuLTemporaryCopy(t *testing.T) {
	source := os.Getenv("MPE_PI_REFERENCE_ROOT")
	if source == "" {
		source = "../../../../../MaaDuDuL-backup"
	}
	entryRaw, err := os.ReadFile(filepath.Join(source, "interface.json"))
	if os.IsNotExist(err) {
		t.Skip("MaaDuDuL-backup reference is not available")
	}
	if err != nil {
		t.Fatal(err)
	}
	entry, err := parseEditorDocument(string(entryRaw))
	if err != nil {
		t.Fatal(err)
	}
	root, err := filepath.EvalSymlinks(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	copyPaths := append([]string{"interface.json"}, stringSlice(entry["import"])...)
	for _, path := range stringMap(entry["languages"]) {
		copyPaths = append(copyPaths, path)
	}
	for _, path := range copyPaths {
		raw, err := os.ReadFile(filepath.Join(source, path))
		if err != nil {
			t.Fatal(err)
		}
		target := filepath.Join(root, path)
		if err = os.MkdirAll(filepath.Dir(target), 0755); err != nil {
			t.Fatal(err)
		}
		if err = os.WriteFile(target, raw, 0644); err != nil {
			t.Fatal(err)
		}
	}
	for _, resource := range objectArray(entry["resource"]) {
		for _, path := range stringSlice(resource["path"]) {
			if err = os.MkdirAll(filepath.Join(root, path), 0755); err != nil {
				t.Fatal(err)
			}
		}
	}
	bus := eventbus.New()
	files, err := fileservice.NewService(root, nil, []string{".json", ".jsonc"}, 20, 10000, bus)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(files.Stop)
	s, err := NewService(root, filepath.Join(root, "interface.json"), files, bus)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(s.Close)
	s.Start()
	p, err := s.ReadEditor(EditorRequest{})
	if err != nil {
		t.Fatal(err)
	}
	purchase := editorDoc(t, p, "tasks/daily/purchase.json")
	data, _ := parseEditorDocument(purchase.Content)
	if len(objectMap(data["option"])) < 30 {
		t.Fatal("reference no longer exercises nested options")
	}
	edited := strings.Replace(purchase.Content, `"每日采购_开始"`, `"每日采购_验证入口"`, 1)
	if edited == purchase.Content {
		t.Fatal("reference entry changed")
	}
	if _, err = s.SaveEditor(EditorRequest{Changes: []EditorChange{{Path: purchase.Path, Version: purchase.Version, Content: edited}}}); err != nil {
		t.Fatal(err)
	}
	saved, _ := os.ReadFile(purchase.Path)
	if string(saved) != edited {
		t.Fatal("source formatting changed")
	}
	original, _ := os.ReadFile(filepath.Join(source, "tasks/daily/purchase.json"))
	if string(original) != purchase.Content {
		t.Fatal("reference project modified")
	}
}

func TestEditorSchemaDiagnosticsLocateImportedSource(t *testing.T) {
	s, _ := editorFixture(t)
	p, _ := s.ReadEditor(EditorRequest{})
	b := editorDoc(t, p, "tasks/b.json")
	p, err := s.ReadEditor(EditorRequest{Changes: []EditorChange{{Path: b.Path, Content: `{"task":[{"name":"B","entry":false}]}`}}})
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, d := range p.Diagnostics {
		if d.Category == "schema" && d.File == b.Path && d.Line > 0 {
			found = true
		}
	}
	if !found {
		t.Fatal(p.Diagnostics)
	}
}
