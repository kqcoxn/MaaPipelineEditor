package projectinterface

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

func harnessPathKey(path string) string {
	path = filepath.Clean(path)
	if runtime.GOOS == "windows" {
		path = strings.ToLower(path)
	}
	return path
}

func readHarnessNodes(out *HarnessReply, req HarnessRequest) error {
	drafts := map[string]EditorChange{}
	for _, d := range req.PipelineDrafts {
		drafts[harnessPathKey(d.Path)] = d
	}
	seenDrafts := map[string]bool{}
	for layer, bundle := range out.ResourcePaths {
		root, err := filepath.EvalSymlinks(filepath.Join(bundle, "pipeline"))
		if os.IsNotExist(err) {
			continue
		}
		if err != nil {
			return err
		}
		err = filepath.WalkDir(root, func(path string, entry os.DirEntry, err error) error {
			if err != nil {
				return err
			}
			if path != root && strings.HasPrefix(entry.Name(), ".") {
				if entry.IsDir() {
					return filepath.SkipDir
				}
				return nil
			}
			if entry.IsDir() {
				return nil
			}
			ext := strings.ToLower(filepath.Ext(path))
			if ext != ".json" && ext != ".jsonc" {
				return nil
			}
			real, err := filepath.EvalSymlinks(path)
			if err != nil {
				return err
			}
			if !isWithin(root, real) {
				return fmt.Errorf("资源符号链接越界")
			}
			raw, err := os.ReadFile(real)
			if err != nil {
				return err
			}
			version := hashString(string(raw))
			out.Versions[real] = version
			draft, hasDraft := drafts[harnessPathKey(real)]
			if hasDraft {
				seenDrafts[harnessPathKey(real)] = true
				if draft.Version != "" && draft.Version != version {
					return fmt.Errorf("Pipeline 来源已变化: %s", real)
				}
				raw = []byte(draft.Content)
				out.IncludedDrafts = append(out.IncludedDrafts, real)
			}
			data, err := parseEditorDocument(string(raw))
			if err != nil {
				return fmt.Errorf("Pipeline %s: %w", real, err)
			}
			for name, value := range data {
				if strings.HasPrefix(name, "$") || len(req.Names) > 0 && !containsString(req.Names, name) {
					continue
				}
				node := objectMap(value)
				if node != nil {
					out.Nodes = append(out.Nodes, HarnessNode{Name: name, File: real, Pointer: "/" + escapePointer(name), Version: version, Layer: layer, Value: node, Draft: hasDraft})
				}
			}
			return nil
		})
		if err != nil {
			return err
		}
	}
	for path := range drafts {
		if !seenDrafts[path] {
			return fmt.Errorf("草稿文件未包含在资源快照中: %s", path)
		}
	}
	return nil
}
