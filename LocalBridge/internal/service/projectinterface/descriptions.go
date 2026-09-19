package projectinterface

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"unicode/utf8"
)

// displaySnapshot resolves task documentation only for the GUI. Runtime documents
// and the source files retain their original description values.
func (s *ProjectSnapshot) displaySnapshot(language string) *ProjectSnapshot {
	result := s.Localize(language)
	for index, task := range objectArray(result.Document["task"]) {
		text, ok := task["description"].(string)
		if !ok || strings.ContainsAny(text, "\r\n") || strings.Contains(text, "://") {
			continue
		}
		switch strings.ToLower(filepath.Ext(text)) {
		case ".md", ".markdown", ".txt":
		default:
			continue
		}
		content, err := readTaskDescription(s.InterfaceRoot, text)
		if err != nil {
			task["description"] = "任务说明暂不可用，请检查描述文件。"
			result.Diagnostics = append(result.Diagnostics, Diagnostic{Severity: "warning", Category: "path", Code: "pi.description.unavailable", Message: fmt.Sprintf("读取任务说明 %s 失败: %v", text, err), File: s.EntryPath, Pointer: fmt.Sprintf("/task/%d/description", index)})
			continue
		}
		task["description"] = content
	}
	return result
}

func readTaskDescription(root, path string) (string, error) {
	resolved, err := (&loader{}).resolveProjectPath(root, path, true)
	if err != nil {
		return "", err
	}
	file, err := os.Open(resolved)
	if err != nil {
		return "", err
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		return "", err
	}
	if !info.Mode().IsRegular() {
		return "", fmt.Errorf("描述路径不是普通文件")
	}
	const limit = 1024 * 1024
	data, err := io.ReadAll(io.LimitReader(file, limit+1))
	if err != nil {
		return "", err
	}
	if len(data) > limit {
		return "", fmt.Errorf("描述文件超过 1 MiB")
	}
	if !utf8.Valid(data) {
		return "", fmt.Errorf("描述文件须使用 UTF-8 编码")
	}
	return strings.TrimPrefix(string(data), "\ufeff"), nil
}
