package diagnostics

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/server"
)

var DesktopFiles = []string{"launcher.log", "launcher.previous.log", "mpelb.log", "mpelb.previous.log", "desktop.txt"}

type archiveWriter struct {
	zip      *zip.Writer
	warnings []string
	names    map[string]bool
	excluded []os.FileInfo
}

func (w *archiveWriter) writeJSON(name string, value interface{}) error {
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	f, err := w.zip.Create(name)
	if err != nil {
		return err
	}
	_, err = f.Write(data)
	return err
}

// Snapshot each file's length so a running service cannot make export run forever.
func (w *archiveWriter) file(root, path, name string) error {
	if w.names[name] {
		return nil
	}
	if err := withinRoot(root, path); err != nil {
		w.warnings = append(w.warnings, path+": "+err.Error())
		return nil
	}
	f, err := os.Open(path)
	if err != nil {
		w.warnings = append(w.warnings, path+": "+err.Error())
		return nil
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil {
		return err
	}
	if !info.Mode().IsRegular() {
		return nil
	}
	for _, excluded := range w.excluded {
		if os.SameFile(info, excluded) {
			return nil
		}
	}
	entry, err := w.zip.Create(name)
	if err != nil {
		return err
	}
	w.names[name] = true
	_, err = io.CopyN(entry, f, info.Size())
	if err == io.EOF {
		w.warnings = append(w.warnings, path+": 导出期间文件被截断")
		return nil
	}
	return err
}

func (w *archiveWriter) directory(root string, name func(string) string) error {
	if root == "" {
		w.warnings = append(w.warnings, "未记录日志目录")
		return nil
	}
	return filepath.WalkDir(root, func(path string, entry os.DirEntry, err error) error {
		if err != nil {
			w.warnings = append(w.warnings, path+": "+err.Error())
			return nil
		}
		if entry.IsDir() {
			// Skip recognition intermediates and error screenshots in diagnostic exports.
			if path != root && (strings.EqualFold(entry.Name(), "vision") || strings.EqualFold(entry.Name(), "on_error")) {
				return filepath.SkipDir
			}
			return nil
		}
		rel, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		return w.file(root, path, name(filepath.ToSlash(rel)))
	})
}

func withinRoot(root, path string) error {
	if root == "" {
		return fmt.Errorf("未记录项目根目录")
	}
	lexical, err := filepath.Rel(root, path)
	if err != nil || lexical == ".." || strings.HasPrefix(lexical, ".."+string(filepath.Separator)) {
		return fmt.Errorf("文件不在收集目录内")
	}
	realRoot, err := filepath.EvalSymlinks(root)
	if err != nil {
		return err
	}
	realPath, err := filepath.EvalSymlinks(path)
	if err != nil {
		return err
	}
	rel, err := filepath.Rel(realRoot, realPath)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return fmt.Errorf("文件不在收集目录内")
	}
	return nil
}

func isFrameworkFile(name string) bool {
	lower := strings.ToLower(filepath.Base(name))
	ext := strings.ToLower(filepath.Ext(name))
	return strings.HasPrefix(lower, "maafw.log") || strings.HasPrefix(lower, "maa.log") || strings.HasPrefix(lower, "custom.log") ||
		strings.Contains("|.png|.jpg|.jpeg|.bmp|.gif|.webp|", "|"+ext+"|")
}

// Write streams a complete ZIP to the destination without buffering the archive.
func Write(destination io.Writer, snapshot Snapshot, excludePaths ...string) error {
	w := &archiveWriter{zip: zip.NewWriter(destination), names: map[string]bool{}, warnings: []string{}}
	if named, ok := destination.(interface{ Name() string }); ok {
		excludePaths = append(excludePaths, named.Name())
	}
	for _, path := range excludePaths {
		if info, err := os.Stat(path); err == nil {
			w.excluded = append(w.excluded, info)
		}
	}
	w.warnings = append(w.warnings, snapshot.Warnings...)
	payload := snapshot.Payload
	if payload.FrontendState == nil {
		w.warnings = append(w.warnings, "未取得前端状态快照（编辑器尚未连接或未成功保存）")
	}
	if payload.FrontendLogs != nil {
		if err := w.writeJSON("mpe/frontend-logs.json", payload.FrontendLogs); err != nil {
			return err
		}
	}
	if payload.FrontendState != nil {
		if err := w.writeJSON("mpe/frontend-state.json", payload.FrontendState); err != nil {
			return err
		}
	}
	for _, file := range payload.OpenedFiles {
		if err := withinRoot(snapshot.Root, file.FilePath); err != nil {
			w.warnings = append(w.warnings, file.FilePath+": "+err.Error())
			continue
		}
		rel, err := filepath.Rel(snapshot.Root, file.FilePath)
		if err != nil {
			return err
		}
		if err := w.file(snapshot.Root, file.FilePath, "mpe/open-files/disk/"+filepath.ToSlash(rel)); err != nil {
			return err
		}
	}
	// Keep the MaaLogAnalyzer/MFAA debug layout for the remaining files.
	archiveName := func(rel string) string {
		if isFrameworkFile(rel) {
			return "debug/" + rel
		}
		if filepath.Clean(snapshot.LogDir) != filepath.Clean(snapshot.MFWDir) {
			return "localbridge/default/" + rel
		}
		return "localbridge/" + rel
	}
	if err := w.directory(snapshot.MFWDir, archiveName); err != nil {
		return err
	}
	if filepath.Clean(snapshot.LogDir) != filepath.Clean(snapshot.MFWDir) {
		if err := w.directory(snapshot.LogDir, func(rel string) string { return "localbridge/" + rel }); err != nil {
			return err
		}
	}
	if !w.names["debug/maafw.log"] {
		w.warnings = append(w.warnings, "未找到 maafw.log")
	}
	if snapshot.DesktopDir != "" {
		for _, name := range DesktopFiles {
			path := filepath.Join(snapshot.DesktopDir, name)
			if _, err := os.Stat(path); os.IsNotExist(err) {
				continue
			}
			if err := w.file(snapshot.DesktopDir, path, "desktop/"+name); err != nil {
				return err
			}
		}
	}
	manifest := map[string]interface{}{}
	for k, v := range payload.Manifest {
		manifest[k] = v
	}
	manifest["exportedAt"] = time.Now().UTC().Format(time.RFC3339Nano)
	manifest["frontendCapturedAt"] = snapshot.CapturedAt
	manifest["localBridgeVersion"] = snapshot.Version
	manifest["localBridgeProtocolVersion"] = server.ProtocolVersion
	manifest["platform"] = runtime.GOOS + "/" + runtime.GOARCH
	manifest["scanRoot"] = snapshot.Root
	manifest["logDirectory"] = snapshot.LogDir
	manifest["mfwLogDirectory"] = snapshot.MFWDir
	manifest["openedFiles"] = payload.OpenedFiles
	manifest["warnings"] = w.warnings
	if err := w.writeJSON("manifest.json", manifest); err != nil {
		return err
	}
	if err := w.zip.Close(); err != nil {
		return err
	}
	return nil
}
