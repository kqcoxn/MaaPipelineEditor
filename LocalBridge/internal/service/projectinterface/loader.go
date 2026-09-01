package projectinterface

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/santhosh-tekuri/jsonschema/v5"
	"github.com/tailscale/hujson"
)

type loader struct {
	schema *jsonschema.Schema
}

func (l *loader) load(entryPath string) (*ProjectSnapshot, error) {
	entryPath, err := canonicalExistingPath(entryPath)
	if err != nil {
		return nil, err
	}
	interfaceRoot := filepath.Dir(entryPath)
	entry, err := l.readDocument(interfaceRoot, entryPath)
	if err != nil {
		return nil, err
	}
	if err := l.schema.Validate(entry.Data); err != nil {
		return nil, schemaLoadError(entryPath, err)
	}

	merged := cloneMap(entry.Data)
	documents := map[string]*SourceDocument{entry.Path: entry}
	provenance := documentProvenance(entry)
	for index, importPath := range stringSlice(entry.Data["import"]) {
		resolved, err := l.resolveProjectPath(interfaceRoot, importPath, true)
		if err != nil {
			return nil, fmt.Errorf("import[%d]: %w", index, err)
		}
		doc, err := l.readDocument(interfaceRoot, resolved)
		if err != nil {
			return nil, fmt.Errorf("读取 import %s 失败: %w", importPath, err)
		}
		documents[doc.Path] = doc
		mergeImported(merged, doc.Data, provenance, documentProvenance(doc))
	}
	if err := l.schema.Validate(merged); err != nil {
		return nil, schemaLoadErrorWithProvenance(entryPath, err, provenance)
	}

	for code, languagePath := range stringMap(entry.Data["languages"]) {
		resolved, err := l.resolveProjectPath(interfaceRoot, languagePath, true)
		if err != nil {
			return nil, fmt.Errorf("languages.%s: %w", code, err)
		}
		doc, err := l.readDocument(interfaceRoot, resolved)
		if err != nil {
			return nil, fmt.Errorf("读取语言文件 %s 失败: %w", languagePath, err)
		}
		documents[doc.Path] = doc
	}

	diagnostics := l.validateSemantics(entry.Path, interfaceRoot, merged)
	if hasErrorDiagnostics(diagnostics) {
		return nil, &loadError{Diagnostics: diagnostics}
	}

	sources := make([]string, 0, len(documents))
	for path := range documents {
		sources = append(sources, path)
	}
	sort.Strings(sources)
	revision := hashDocuments(documents, sources)
	projectID := hashString(strings.ToLower(filepath.Clean(entry.Path)))
	return &ProjectSnapshot{
		ProjectID: projectID, EntryPath: entry.Path, ProjectRoot: interfaceRoot, InterfaceRoot: interfaceRoot,
		Revision: revision, Document: merged, Provenance: provenance,
		Diagnostics: diagnostics, Sources: sources, documents: documents,
	}, nil
}

func (l *loader) readDocument(interfaceRoot, path string) (*SourceDocument, error) {
	resolved, err := l.resolveProjectPath(interfaceRoot, path, true)
	if err != nil {
		return nil, err
	}
	raw, err := os.ReadFile(resolved)
	if err != nil {
		return nil, err
	}
	ast, err := hujson.Parse(raw)
	if err != nil {
		return nil, &loadError{Diagnostics: []Diagnostic{{
			Severity: "error", Category: "syntax", Code: "pi.syntax.invalid",
			Message: err.Error(), File: resolved,
		}}}
	}
	standardized, err := hujson.Standardize(raw)
	if err != nil {
		return nil, err
	}
	var data map[string]any
	if err := json.Unmarshal(standardized, &data); err != nil {
		return nil, err
	}
	return &SourceDocument{Path: resolved, Raw: raw, AST: ast, Data: data}, nil
}

func (l *loader) resolveProjectPath(base, value string, mustExist bool) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "", errors.New("路径为空")
	}
	path := value
	if !filepath.IsAbs(path) {
		path = filepath.Join(base, path)
	}
	abs, err := filepath.Abs(path)
	if err != nil {
		return "", err
	}
	abs = filepath.Clean(abs)
	if !isWithin(base, abs) {
		return "", fmt.Errorf("路径越出 interface.json 所在目录: %s", value)
	}
	if mustExist {
		resolved, err := filepath.EvalSymlinks(abs)
		if err != nil {
			return "", err
		}
		if !isWithin(base, resolved) {
			return "", fmt.Errorf("符号链接越出 interface.json 所在目录: %s", value)
		}
		abs = resolved
	}
	return abs, nil
}

func (l *loader) validateSemantics(entryPath, interfaceRoot string, doc map[string]any) []Diagnostic {
	var result []Diagnostic
	controllers := objectArray(doc["controller"])
	resources := objectArray(doc["resource"])
	controllerNames := namesOf(controllers)
	resourceNames := namesOf(resources)
	result = append(result, duplicateNameDiagnostics(entryPath, "/controller", controllers)...)
	result = append(result, duplicateNameDiagnostics(entryPath, "/resource", resources)...)

	for index, resource := range resources {
		for _, name := range stringSlice(resource["controller"]) {
			if !controllerNames[name] {
				result = append(result, Diagnostic{Severity: "error", Category: "reference", Code: "pi.resource.controller_missing", Message: "资源引用了不存在的 Controller: " + name, File: entryPath, Pointer: fmt.Sprintf("/resource/%d/controller", index)})
			}
		}
		for pathIndex, path := range stringSlice(resource["path"]) {
			if _, err := l.resolveProjectPath(interfaceRoot, path, true); err != nil {
				result = append(result, Diagnostic{Severity: "error", Category: "path", Code: "pi.resource.path_invalid", Message: err.Error(), File: entryPath, Pointer: fmt.Sprintf("/resource/%d/path/%d", index, pathIndex)})
			}
		}
	}
	for index, controller := range controllers {
		for pathIndex, path := range stringSlice(controller["attach_resource_path"]) {
			if _, err := l.resolveProjectPath(interfaceRoot, path, true); err != nil {
				result = append(result, Diagnostic{Severity: "error", Category: "path", Code: "pi.controller.attach_path_invalid", Message: err.Error(), File: entryPath, Pointer: fmt.Sprintf("/controller/%d/attach_resource_path/%d", index, pathIndex)})
			}
		}
	}
	_ = resourceNames
	return result
}

type loadError struct{ Diagnostics []Diagnostic }

func (e *loadError) Error() string {
	if len(e.Diagnostics) == 0 {
		return "Project Interface 加载失败"
	}
	return e.Diagnostics[0].Message
}

func schemaLoadError(path string, err error) error {
	return schemaLoadErrorWithProvenance(path, err, nil)
}

func schemaLoadErrorWithProvenance(path string, err error, provenance map[string]SourceLocation) error {
	validation, ok := err.(*jsonschema.ValidationError)
	if !ok {
		return err
	}
	var diagnostics []Diagnostic
	var visit func(*jsonschema.ValidationError)
	visit = func(item *jsonschema.ValidationError) {
		if len(item.Causes) == 0 && item.Message != "" {
			location, ok := nearestProvenance(provenance, item.InstanceLocation)
			diagnostic := Diagnostic{Severity: "error", Category: "schema", Code: "pi.schema.invalid", Message: item.Message, File: path, Pointer: item.InstanceLocation}
			if ok {
				diagnostic.File = location.File
				diagnostic.Line = location.Line
				diagnostic.Column = location.Column
				diagnostic.EndLine = location.EndLine
				diagnostic.EndColumn = location.EndColumn
			}
			diagnostics = append(diagnostics, diagnostic)
		}
		for _, cause := range item.Causes {
			visit(cause)
		}
	}
	visit(validation)
	return &loadError{Diagnostics: diagnostics}
}

func mergeImported(target, imported map[string]any, targetProvenance, sourceProvenance map[string]SourceLocation) {
	for _, key := range []string{"task", "preset", "setting"} {
		base := anySlice(target[key])
		extra := anySlice(imported[key])
		target[key] = append(base, extra...)
		remapArrayProvenance(targetProvenance, sourceProvenance, key, len(base), len(extra))
	}
	basePretask := oneOrMany(target["pretask"])
	extraPretask := oneOrMany(imported["pretask"])
	if len(basePretask)+len(extraPretask) > 0 {
		target["pretask"] = append(basePretask, extraPretask...)
		remapOneOrManyProvenance(targetProvenance, sourceProvenance, "pretask", len(basePretask), len(extraPretask), imported["pretask"])
	}

	groups := anySlice(target["group"])
	seenGroups := objectNames(groups, "name")
	for sourceIndex, item := range anySlice(imported["group"]) {
		obj, _ := item.(map[string]any)
		name, _ := obj["name"].(string)
		if name != "" && seenGroups[name] {
			continue
		}
		targetIndex := len(groups)
		groups = append(groups, item)
		if name != "" {
			seenGroups[name] = true
		}
		remapProvenancePrefix(targetProvenance, sourceProvenance, fmt.Sprintf("/group/%d", sourceIndex), fmt.Sprintf("/group/%d", targetIndex))
	}
	if len(groups) > 0 {
		target["group"] = groups
	}

	globalOptions := stringSlice(target["global_option"])
	seenOptions := map[string]bool{}
	for _, name := range globalOptions {
		seenOptions[name] = true
	}
	for sourceIndex, name := range stringSlice(imported["global_option"]) {
		if seenOptions[name] {
			continue
		}
		targetIndex := len(globalOptions)
		globalOptions = append(globalOptions, name)
		seenOptions[name] = true
		remapProvenancePrefix(targetProvenance, sourceProvenance, fmt.Sprintf("/global_option/%d", sourceIndex), fmt.Sprintf("/global_option/%d", targetIndex))
	}
	if len(globalOptions) > 0 {
		values := make([]any, len(globalOptions))
		for index, name := range globalOptions {
			values[index] = name
		}
		target["global_option"] = values
	}

	options, _ := target["option"].(map[string]any)
	if options == nil {
		options = map[string]any{}
	}
	for name, value := range objectMap(imported["option"]) {
		options[name] = value
		prefix := "/option/" + escapePointer(name)
		deleteProvenancePrefix(targetProvenance, prefix)
		remapProvenancePrefix(targetProvenance, sourceProvenance, prefix, prefix)
	}
	target["option"] = options
}

func documentProvenance(doc *SourceDocument) map[string]SourceLocation {
	result := map[string]SourceLocation{}
	collectProvenance(doc, &doc.AST, "", result)
	return result
}

func collectProvenance(doc *SourceDocument, value *hujson.Value, pointer string, result map[string]SourceLocation) {
	if pointer != "" {
		line, column := lineColumn(doc.Raw, value.StartOffset)
		endLine, endColumn := lineColumn(doc.Raw, value.EndOffset)
		result[pointer] = SourceLocation{File: doc.Path, Line: line, Column: column, EndLine: endLine, EndColumn: endColumn}
	}
	switch typed := value.Value.(type) {
	case *hujson.Object:
		for index := range typed.Members {
			member := &typed.Members[index]
			literal, ok := member.Name.Value.(hujson.Literal)
			if !ok {
				continue
			}
			var name string
			if err := json.Unmarshal(literal, &name); err != nil {
				continue
			}
			collectProvenance(doc, &member.Value, pointer+"/"+escapePointer(name), result)
		}
	case *hujson.Array:
		for index := range typed.Elements {
			collectProvenance(doc, &typed.Elements[index], fmt.Sprintf("%s/%d", pointer, index), result)
		}
	}
}

func remapArrayProvenance(target, source map[string]SourceLocation, key string, base, count int) {
	for index := 0; index < count; index++ {
		remapProvenancePrefix(target, source, fmt.Sprintf("/%s/%d", key, index), fmt.Sprintf("/%s/%d", key, base+index))
	}
}

func remapOneOrManyProvenance(target, source map[string]SourceLocation, key string, base, count int, raw any) {
	for index := 0; index < count; index++ {
		sourcePrefix := "/" + key
		if _, isArray := raw.([]any); isArray {
			sourcePrefix = fmt.Sprintf("/%s/%d", key, index)
		}
		remapProvenancePrefix(target, source, sourcePrefix, fmt.Sprintf("/%s/%d", key, base+index))
	}
}

func remapProvenancePrefix(target, source map[string]SourceLocation, sourcePrefix, targetPrefix string) {
	for pointer, location := range source {
		if pointer == sourcePrefix || strings.HasPrefix(pointer, sourcePrefix+"/") {
			target[targetPrefix+strings.TrimPrefix(pointer, sourcePrefix)] = location
		}
	}
}

func deleteProvenancePrefix(target map[string]SourceLocation, prefix string) {
	for pointer := range target {
		if pointer == prefix || strings.HasPrefix(pointer, prefix+"/") {
			delete(target, pointer)
		}
	}
}

func nearestProvenance(provenance map[string]SourceLocation, pointer string) (SourceLocation, bool) {
	for candidate := pointer; candidate != ""; {
		if location, ok := provenance[candidate]; ok {
			return location, true
		}
		index := strings.LastIndex(candidate, "/")
		if index < 0 {
			break
		}
		candidate = candidate[:index]
	}
	return SourceLocation{}, false
}

func oneOrMany(value any) []any {
	if value == nil {
		return nil
	}
	if values, ok := value.([]any); ok {
		return values
	}
	if _, ok := value.(map[string]any); ok {
		return []any{value}
	}
	return nil
}

func objectNames(values []any, key string) map[string]bool {
	result := map[string]bool{}
	for _, value := range values {
		obj, _ := value.(map[string]any)
		if name, _ := obj[key].(string); name != "" {
			result[name] = true
		}
	}
	return result
}

func lineColumn(raw []byte, offset int) (int, int) {
	if offset < 0 {
		offset = 0
	}
	if offset > len(raw) {
		offset = len(raw)
	}
	line, column := 1, 1
	for _, b := range raw[:offset] {
		if b == '\n' {
			line++
			column = 1
		} else {
			column++
		}
	}
	return line, column
}

func hashDocuments(documents map[string]*SourceDocument, sources []string) string {
	hash := sha256.New()
	for _, path := range sources {
		hash.Write([]byte(path))
		hash.Write([]byte{0})
		hash.Write(documents[path].Raw)
		hash.Write([]byte{0})
	}
	return hex.EncodeToString(hash.Sum(nil))
}

func hashString(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}

func isWithin(root, path string) bool {
	rootAbs, err := filepath.Abs(root)
	if err != nil {
		return false
	}
	pathAbs, err := filepath.Abs(path)
	if err != nil {
		return false
	}
	rel, err := filepath.Rel(rootAbs, pathAbs)
	return err == nil && rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))
}

func canonicalExistingPath(path string) (string, error) {
	abs, err := filepath.Abs(path)
	if err != nil {
		return "", err
	}
	resolved, err := filepath.EvalSymlinks(filepath.Clean(abs))
	if err != nil {
		return "", err
	}
	return filepath.Clean(resolved), nil
}

func hasErrorDiagnostics(items []Diagnostic) bool {
	for _, item := range items {
		if item.Severity == "error" {
			return true
		}
	}
	return false
}
func cloneMap(value map[string]any) map[string]any {
	raw, _ := json.Marshal(value)
	var result map[string]any
	_ = json.Unmarshal(raw, &result)
	return result
}
func anySlice(value any) []any { result, _ := value.([]any); return result }
func objectArray(value any) []map[string]any {
	values := anySlice(value)
	result := make([]map[string]any, 0, len(values))
	for _, value := range values {
		if item, ok := value.(map[string]any); ok {
			result = append(result, item)
		}
	}
	return result
}
func objectMap(value any) map[string]any { result, _ := value.(map[string]any); return result }
func stringSlice(value any) []string {
	values := anySlice(value)
	result := make([]string, 0, len(values))
	for _, value := range values {
		if item, ok := value.(string); ok {
			result = append(result, item)
		}
	}
	return result
}
func stringMap(value any) map[string]string {
	raw := objectMap(value)
	result := map[string]string{}
	for key, value := range raw {
		if item, ok := value.(string); ok {
			result[key] = item
		}
	}
	return result
}
func namesOf(items []map[string]any) map[string]bool {
	result := map[string]bool{}
	for _, item := range items {
		if name, ok := item["name"].(string); ok {
			result[name] = true
		}
	}
	return result
}
func duplicateNameDiagnostics(path, pointer string, items []map[string]any) []Diagnostic {
	seen := map[string]bool{}
	var result []Diagnostic
	for index, item := range items {
		name, _ := item["name"].(string)
		if name != "" && seen[name] {
			result = append(result, Diagnostic{Severity: "error", Category: "reference", Code: "pi.name.duplicate", Message: "名称重复: " + name, File: path, Pointer: fmt.Sprintf("%s/%d/name", pointer, index)})
		}
		seen[name] = true
	}
	return result
}
func appendUniqueStrings(base, extra []string) []string {
	seen := map[string]bool{}
	result := make([]string, 0, len(base)+len(extra))
	for _, list := range [][]string{base, extra} {
		for _, item := range list {
			if !seen[item] {
				seen[item] = true
				result = append(result, item)
			}
		}
	}
	return result
}
func appendUniqueObjects(base, extra []any, key string) []any {
	seen := map[string]bool{}
	result := make([]any, 0, len(base)+len(extra))
	for _, list := range [][]any{base, extra} {
		for _, item := range list {
			obj, _ := item.(map[string]any)
			name, _ := obj[key].(string)
			if name == "" || !seen[name] {
				result = append(result, item)
				if name != "" {
					seen[name] = true
				}
			}
		}
	}
	return result
}
func escapePointer(value string) string {
	return strings.ReplaceAll(strings.ReplaceAll(value, "~", "~0"), "/", "~1")
}
