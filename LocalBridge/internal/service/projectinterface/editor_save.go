package projectinterface

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

const editorJournalName = ".mpe-pi-transaction.json"

type editorBackup struct {
	Path      string      `json:"path"`
	Before    []byte      `json:"before"`
	AfterHash string      `json:"afterHash"`
	Exists    bool        `json:"exists"`
	Mode      os.FileMode `json:"mode"`
}
type editorJournal struct {
	Files []editorBackup `json:"files"`
}
type EditorConflictError struct{ Path string }

func (e *EditorConflictError) Error() string {
	return "文件已被外部修改，请对比后重新保存: " + e.Path
}

// SetEditorLease shares the native execution gate, including preparation and debug.
func (s *Service) SetEditorLease(acquire func() (func(), error)) { s.editorLease = acquire }

func (s *Service) SaveEditor(req EditorRequest) (*EditorProject, error) {
	release := func() {}
	if s.editorLease != nil {
		var err error
		release, err = s.editorLease()
		if err != nil {
			return nil, err
		}
	}
	defer release()
	result, err := func() (*EditorProject, error) {
		s.refreshMu.Lock()
		defer s.refreshMu.Unlock()
		entry, err := s.editorEntry(req.EntryPath)
		if err != nil {
			return nil, err
		}
		root := filepath.Dir(entry)
		if err = s.recoverEditor(root); err != nil {
			return nil, err
		}
		if len(req.Changes) == 0 {
			return s.readEditor(req)
		}
		project, err := s.readEditor(req)
		if err != nil {
			return nil, err
		}
		// Existing unrelated errors may be repaired incrementally; new errors cannot be introduced.
		baseline, err := s.readEditor(EditorRequest{EntryPath: entry, Paths: req.Paths})
		if err != nil {
			return nil, err
		}
		oldErrors := map[string]int{}
		diagnosticKey := func(d Diagnostic) string { return d.File + "|" + d.Pointer + "|" + d.Message }
		for _, d := range baseline.Diagnostics {
			if d.Severity == "error" {
				oldErrors[diagnosticKey(d)]++
			}
		}
		for _, d := range project.Diagnostics {
			if d.Severity == "error" {
				key := diagnosticKey(d)
				if oldErrors[key] == 0 {
					return nil, fmt.Errorf("保存前请修复: %s", d.Message)
				}
				oldErrors[key]--
			}
		}
		for path, version := range req.Versions {
			resolved, err := editorPath(root, path)
			if err != nil {
				return nil, err
			}
			if err = checkEditorVersion(resolved, version); err != nil {
				return nil, err
			}
		}
		journal := editorJournal{}
		paths := map[string]bool{}
		contents := map[string][]byte{}
		for _, change := range req.Changes {
			path, err := editorPath(root, change.Path)
			if err != nil {
				return nil, err
			}
			if paths[path] {
				return nil, fmt.Errorf("重复提交文件: %s", path)
			}
			paths[path] = true
			if _, err = parseEditorDocument(change.Content); err != nil {
				return nil, fmt.Errorf("%s: %w", path, err)
			}
			before, err := os.ReadFile(path)
			exists := err == nil
			if err != nil && !os.IsNotExist(err) {
				return nil, err
			}
			actualVersion := "missing"
			if exists {
				actualVersion = hashString(string(before))
			}
			if change.Version == "" || actualVersion != change.Version {
				return nil, &EditorConflictError{Path: path}
			}
			mode := os.FileMode(0644)
			if info, err := os.Stat(path); err == nil {
				mode = info.Mode().Perm()
			}
			journal.Files = append(journal.Files, editorBackup{Path: path, Before: before, AfterHash: hashString(change.Content), Exists: exists, Mode: mode})
			contents[path] = []byte(change.Content)
		}
		raw, err := json.Marshal(journal)
		if err != nil {
			return nil, err
		}
		journalPath := filepath.Join(root, editorJournalName)
		if err = writeEditorAtomic(journalPath, raw, 0600); err != nil {
			return nil, err
		}
		for _, backup := range journal.Files {
			version := "missing"
			if backup.Exists {
				version = hashString(string(backup.Before))
			}
			if err = checkEditorVersion(backup.Path, version); err == nil {
				write := writeEditorAtomic
				if s.editorWrite != nil {
					write = s.editorWrite
				}
				err = write(backup.Path, contents[backup.Path], backup.Mode)
			}
			if err != nil {
				if rollbackErr := s.recoverEditor(root); rollbackErr != nil {
					return nil, fmt.Errorf("保存失败: %v；恢复失败: %w", err, rollbackErr)
				}
				return nil, err
			}
		}
		if err = os.Remove(journalPath); err != nil {
			return nil, err
		}
		if err = syncEditorDir(root); err != nil {
			return nil, err
		}
		return s.readEditor(EditorRequest{EntryPath: entry, Paths: req.Paths})
	}()
	s.Refresh()
	return result, err
}
func checkEditorVersion(path, expected string) error {
	raw, err := os.ReadFile(path)
	actual := "missing"
	if err == nil {
		actual = hashString(string(raw))
	} else if !os.IsNotExist(err) {
		return err
	}
	if expected == "" || actual != expected {
		return &EditorConflictError{Path: path}
	}
	return nil
}
func writeEditorAtomic(path string, raw []byte, mode os.FileMode) error {
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	file, err := os.CreateTemp(filepath.Dir(path), ".mpe-pi-*")
	if err != nil {
		return err
	}
	name := file.Name()
	defer os.Remove(name)
	if err = file.Chmod(mode); err == nil {
		_, err = file.Write(raw)
	}
	if err == nil {
		err = file.Sync()
	}
	closeErr := file.Close()
	if err == nil {
		err = closeErr
	}
	if err != nil {
		return err
	}
	if err = os.Rename(name, path); err != nil {
		return err
	}
	return syncEditorDir(filepath.Dir(path))
}
func (s *Service) recoverEditor(root string) error {
	journalPath := filepath.Join(root, editorJournalName)
	raw, err := os.ReadFile(journalPath)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	var journal editorJournal
	if err = json.Unmarshal(raw, &journal); err != nil {
		return fmt.Errorf("PI 保存恢复记录损坏: %w", err)
	}
	// Check all paths before restoring any, avoiding overwriting edits made after a crash.
	for _, backup := range journal.Files {
		path, err := editorPath(root, backup.Path)
		if err != nil || path != backup.Path {
			return fmt.Errorf("PI 恢复路径无效: %s", backup.Path)
		}
		current, err := os.ReadFile(path)
		if err != nil && !os.IsNotExist(err) {
			return err
		}
		if err == nil && hashString(string(current)) != backup.AfterHash && (!backup.Exists || hashString(string(current)) != hashString(string(backup.Before))) {
			return fmt.Errorf("恢复前检测到外部修改，请保留恢复记录并处理文件: %s", path)
		}
	}
	for _, backup := range journal.Files {
		if backup.Exists {
			err = writeEditorAtomic(backup.Path, backup.Before, backup.Mode)
		} else {
			err = os.Remove(backup.Path)
			if os.IsNotExist(err) {
				err = nil
			}
		}
		if err != nil {
			return err
		}
	}
	if err = os.Remove(journalPath); err != nil {
		return err
	}
	return syncEditorDir(root)
}
