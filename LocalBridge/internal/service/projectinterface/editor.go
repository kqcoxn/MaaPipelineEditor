package projectinterface

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/tailscale/hujson"
)

// EditorDocument is deliberately raw: translated/merged snapshots cannot be saved.
type EditorDocument struct {
	Path         string `json:"path"`
	RelativePath string `json:"relativePath"`
	Kind         string `json:"kind"`
	Content      string `json:"content"`
	Version      string `json:"version"`
	Imported     bool   `json:"imported"`
	Error        string `json:"error,omitempty"`
}
type EditorChange struct {
	Path    string `json:"path"`
	Version string `json:"version"`
	Content string `json:"content"`
}
type EditorRequest struct {
	EntryPath string            `json:"entryPath"`
	Paths     []string          `json:"paths,omitempty"`
	Changes   []EditorChange    `json:"changes,omitempty"`
	Versions  map[string]string `json:"versions,omitempty"`
}
type EditorIndexItem struct {
	Kind      string `json:"kind"`
	Name      string `json:"name"`
	File      string `json:"file"`
	Pointer   string `json:"pointer"`
	Effective bool   `json:"effective"`
}
type EditorProject struct {
	snapshot *ProjectSnapshot

	EntryPath   string            `json:"entryPath"`
	Documents   []EditorDocument  `json:"documents"`
	Definitions []EditorIndexItem `json:"definitions"`
	References  []EditorIndexItem `json:"references"`
	Diagnostics []Diagnostic      `json:"diagnostics"`
}

func (s *Service) editorEntry(requested string) (string, error) {
	s.mu.RLock()
	entry := s.status.EffectivePath
	s.mu.RUnlock()
	if entry == "" {
		return "", fmt.Errorf("请先指定 PI 项目入口")
	}
	if requested != "" && filepath.Clean(requested) != filepath.Clean(entry) {
		return "", fmt.Errorf("PI 项目已切换，请重新打开文件")
	}
	return entry, nil
}

// Resolve the nearest existing parent as well, so creation cannot escape through symlinks.
func editorPath(root, value string) (string, error) {
	if !filepath.IsAbs(value) {
		value = filepath.Join(root, value)
	}
	value = filepath.Clean(value)
	if filepath.Base(value) == editorJournalName {
		return "", fmt.Errorf("不能编辑 PI 保存恢复记录")
	}
	if !isWithin(root, value) {
		return "", fmt.Errorf("路径越出 PI 项目: %s", value)
	}
	ext := strings.ToLower(filepath.Ext(value))
	if ext != ".json" && ext != ".jsonc" {
		return "", fmt.Errorf("仅支持 JSON/JSONC 文件")
	}
	parent := value
	for {
		_, err := os.Lstat(parent)
		if err == nil {
			break
		}
		if !os.IsNotExist(err) {
			return "", err
		}
		next := filepath.Dir(parent)
		if next == parent {
			return "", err
		}
		parent = next
	}
	resolved, err := filepath.EvalSymlinks(parent)
	if err != nil {
		return "", err
	}
	if !isWithin(root, resolved) {
		return "", fmt.Errorf("符号链接越出 PI 项目")
	}
	rel, _ := filepath.Rel(parent, value)
	return filepath.Clean(filepath.Join(resolved, rel)), nil
}
func parseEditorDocument(raw string) (map[string]any, error) {
	data, err := hujson.Standardize([]byte(raw))
	if err != nil {
		return nil, err
	}
	var result map[string]any
	if err = json.Unmarshal(data, &result); err != nil {
		return nil, err
	}
	if result == nil {
		return nil, fmt.Errorf("文件根值必须是对象")
	}
	return result, nil
}

func (s *Service) ReadEditor(req EditorRequest) (*EditorProject, error) {
	s.refreshMu.Lock()
	defer s.refreshMu.Unlock()
	return s.readEditor(req)
}
func (s *Service) readEditor(req EditorRequest) (*EditorProject, error) {
	entry, err := s.editorEntry(req.EntryPath)
	if err != nil {
		return nil, err
	}
	root := filepath.Dir(entry)
	result := &EditorProject{EntryPath: entry, Documents: []EditorDocument{}, Definitions: []EditorIndexItem{}, References: []EditorIndexItem{}, Diagnostics: []Diagnostic{}}
	overlay := map[string]string{}
	for _, change := range req.Changes {
		path, err := editorPath(root, change.Path)
		if err != nil {
			return nil, err
		}
		overlay[path] = change.Content
	}
	seen := map[string]int{}
	sourceLocations := map[string]map[string]SourceLocation{}
	read := func(value, kind string, imported bool) map[string]any {
		path, err := editorPath(root, value)
		if err != nil {
			result.Diagnostics = append(result.Diagnostics, editorDiagnostic(value, "", "error", err.Error()))
			return nil
		}
		if idx, exists := seen[path]; exists {
			if imported {
				result.Documents[idx].Imported = true
			}
			data, _ := parseEditorDocument(result.Documents[idx].Content)
			return data
		}
		raw, readErr := os.ReadFile(path)
		version := "missing"
		if readErr == nil {
			version = hashString(string(raw))
		}
		content := string(raw)
		if draft, exists := overlay[path]; exists {
			content = draft
			readErr = nil
		}
		rel, _ := filepath.Rel(root, path)
		doc := EditorDocument{Path: path, RelativePath: filepath.ToSlash(rel), Kind: kind, Imported: imported, Content: content, Version: version}
		data, parseErr := parseEditorDocument(content)
		if readErr != nil {
			doc.Error = readErr.Error()
		} else if parseErr != nil {
			doc.Error = parseErr.Error()
		}
		if doc.Error != "" {
			result.Diagnostics = append(result.Diagnostics, editorDiagnostic(path, "", "error", doc.Error))
		}
		if ast, err := hujson.Parse([]byte(content)); err == nil {
			sourceLocations[path] = documentProvenance(&SourceDocument{Path: path, Raw: []byte(content), AST: ast, Data: data})
		}
		seen[path] = len(result.Documents)
		result.Documents = append(result.Documents, doc)
		return data
	}
	main := read(entry, "entry", true)
	provenance := sourceLocations[entry]
	if provenance == nil {
		provenance = map[string]SourceLocation{}
	}
	merged := cloneMap(main)
	if merged == nil {
		merged = map[string]any{}
	}
	for _, path := range stringSlice(main["import"]) {
		data := read(path, "fragment", true)
		if data != nil {
			resolved, _ := editorPath(root, path)
			mergeImported(merged, data, provenance, sourceLocations[resolved])
		}
	}
	languages := stringMap(main["languages"])
	keys := make([]string, 0, len(languages))
	for k := range languages {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, key := range keys {
		read(languages[key], "language", true)
	}
	// Last-good sources remain editable when a broken entry no longer parses.
	s.mu.RLock()
	previous := s.lastGood
	s.mu.RUnlock()
	if main == nil && previous != nil && previous.EntryPath == entry {
		for _, path := range previous.Sources {
			kind := "fragment"
			for _, language := range stringMap(previous.Document["languages"]) {
				resolved, _ := editorPath(root, language)
				if path == resolved {
					kind = "language"
				}
			}
			read(path, kind, false)
		}
	}
	for _, path := range req.Paths {
		read(path, "fragment", false)
	}
	for _, change := range req.Changes {
		read(change.Path, "fragment", false)
	}
	indexEditor(result)
	if main != nil {
		if err := s.loader.schema.Validate(merged); err != nil {
			if typed, ok := schemaLoadErrorWithProvenance(entry, err, provenance).(*loadError); ok {
				result.Diagnostics = append(result.Diagnostics, typed.Diagnostics...)
			}
		}
		result.Diagnostics = append(result.Diagnostics, s.loader.validateSemantics(entry, root, merged)...)
	}
	validateEditorReferences(result, merged)
	validateEditorOptions(result, merged)
	s.validateEditorEntries(result, merged)
	s.mu.Lock()
	for _, doc := range result.Documents {
		if !containsString(s.editorSources, doc.Path) {
			s.editorSources = append(s.editorSources, doc.Path)
		}
	}
	status, snapshot := s.status, s.current
	s.mu.Unlock()
	s.updateWatchedSources(status, snapshot)
	for i := range result.Diagnostics {
		diagnostic := &result.Diagnostics[i]
		if diagnostic.Line == 0 && diagnostic.File == entry {
			if location, ok := nearestProvenance(provenance, diagnostic.Pointer); ok {
				diagnostic.File = location.File
				diagnostic.Line = location.Line
				diagnostic.Column = location.Column
			}
		}
		if diagnostic.Line > 0 {
			for pointer, location := range sourceLocations[diagnostic.File] {
				if location.Line == diagnostic.Line && location.Column == diagnostic.Column {
					diagnostic.Pointer = pointer
					break
				}
			}
		}
	}
	result.snapshot = &ProjectSnapshot{EntryPath: entry, InterfaceRoot: root, ProjectRoot: root, Document: merged, Provenance: provenance, documents: map[string]*SourceDocument{}}
	for _, doc := range result.Documents {
		data, _ := parseEditorDocument(doc.Content)
		result.snapshot.documents[doc.Path] = &SourceDocument{Path: doc.Path, Raw: []byte(doc.Content), Data: data}
	}
	return result, nil
}
func editorDiagnostic(file, pointer, severity, message string) Diagnostic {
	return Diagnostic{File: file, Pointer: pointer, Severity: severity, Category: "editor", Code: "pi.editor.validation", Message: message}
}
