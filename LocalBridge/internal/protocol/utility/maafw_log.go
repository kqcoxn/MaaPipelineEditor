package utility

import (
	"archive/zip"
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/config"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/paths"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/server"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/pkg/models"
)

var mfwLogImageExtensions = map[string]struct{}{
	".jpg":  {},
	".jpeg": {},
	".png":  {},
	".bmp":  {},
	".gif":  {},
	".webp": {},
}

type mpeLogOpenedFile struct {
	FilePath string `json:"filePath"`
	FileName string `json:"fileName"`
	Current  bool   `json:"current"`
}

type mpeLogExportPayload struct {
	FrontendLogs  map[string]interface{} `json:"frontend_logs"`
	FrontendState map[string]interface{} `json:"frontend_state"`
	OpenedFiles   []mpeLogOpenedFile     `json:"opened_files"`
	Manifest      map[string]interface{} `json:"manifest"`
}

// handleExportLogs 将后端日志目录和前端内存日志汇总为 ZIP。
func (h *UtilityHandler) handleExportLogs(conn *server.Connection, msg models.Message) {
	logDir, _ := resolveMaafwLogPath()
	payload := mpeLogExportPayload{}
	if encoded, err := json.Marshal(msg.Data); err == nil {
		_ = json.Unmarshal(encoded, &payload)
	}
	archive, err := buildMPELogArchive(logDir, h.root, h.version, payload)
	if err != nil {
		logger.Error("Utility", "导出日志失败: %v", err)
		conn.Send(models.Message{Path: "/lte/utility/logs_exported", Data: map[string]interface{}{
			"success": false,
			"message": "日志导出失败: " + err.Error(),
		}})
		return
	}
	conn.Send(models.Message{Path: "/lte/utility/logs_exported", Data: map[string]interface{}{
		"success":  true,
		"filename": fmt.Sprintf("mpe-logs-%s.zip", time.Now().Format("20060102-150405")),
		"content":  base64.StdEncoding.EncodeToString(archive),
		"message":  "日志导出成功",
	}})
}

func buildMPELogArchive(logDir, root, version string, payload mpeLogExportPayload) ([]byte, error) {
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	writeJSON := func(name string, value interface{}) error {
		raw, err := json.MarshalIndent(value, "", "  ")
		if err != nil {
			return err
		}
		writer, err := zw.Create(name)
		if err != nil {
			return err
		}
		_, err = writer.Write(raw)
		return err
	}
	if payload.FrontendLogs != nil {
		if err := writeJSON("mpe/frontend-logs.json", payload.FrontendLogs); err != nil {
			return nil, fmt.Errorf("写入前端日志失败: %w", err)
		}
	}
	if payload.FrontendState != nil {
		if err := writeJSON("mpe/frontend-state.json", payload.FrontendState); err != nil {
			return nil, fmt.Errorf("写入前端状态失败: %w", err)
		}
	}

	openedFileResults := make([]map[string]interface{}, 0, len(payload.OpenedFiles))
	for _, opened := range payload.OpenedFiles {
		result := map[string]interface{}{
			"filePath": opened.FilePath,
			"fileName": opened.FileName,
			"current":  opened.Current,
		}
		archivePath, err := openedFileArchivePath(root, opened.FilePath)
		if err != nil {
			result["error"] = err.Error()
			openedFileResults = append(openedFileResults, result)
			continue
		}
		data, err := os.ReadFile(opened.FilePath)
		if err != nil {
			result["error"] = err.Error()
			openedFileResults = append(openedFileResults, result)
			continue
		}
		writer, err := zw.Create(archivePath)
		if err != nil {
			return nil, fmt.Errorf("创建用户文件条目失败: %w", err)
		}
		if _, err := writer.Write(data); err != nil {
			return nil, fmt.Errorf("写入用户文件失败: %w", err)
		}
		result["archivePath"] = archivePath
		result["size"] = len(data)
		if info, statErr := os.Stat(opened.FilePath); statErr == nil {
			result["modifiedAt"] = info.ModTime().UTC().Format(time.RFC3339Nano)
		}
		openedFileResults = append(openedFileResults, result)
	}

	if err := filepath.WalkDir(logDir, func(path string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			logger.Warn("Utility", "导出日志时跳过 %s: %v", path, walkErr)
			return nil
		}
		if entry.IsDir() {
			if isMPELogExcludedDirectory(entry.Name()) {
				return filepath.SkipDir
			}
			return nil
		}
		data, readErr := os.ReadFile(path)
		if readErr != nil {
			logger.Warn("Utility", "导出日志时跳过 %s: %v", path, readErr)
			return nil
		}
		relativePath, relativeErr := filepath.Rel(logDir, path)
		if relativeErr != nil {
			return nil
		}
		w, createErr := zw.Create(filepath.ToSlash(filepath.Join("localbridge", relativePath)))
		if createErr == nil {
			_, _ = w.Write(data)
		}
		return nil
	}); err != nil && !os.IsNotExist(err) {
		logger.Warn("Utility", "遍历日志目录失败: %v", err)
	}
	manifest := make(map[string]interface{}, len(payload.Manifest)+8)
	for key, value := range payload.Manifest {
		manifest[key] = value
	}
	manifest["exportedAt"] = time.Now().UTC().Format(time.RFC3339Nano)
	manifest["localBridgeVersion"] = version
	manifest["localBridgeProtocolVersion"] = server.ProtocolVersion
	manifest["platform"] = runtime.GOOS + "/" + runtime.GOARCH
	manifest["scanRoot"] = root
	manifest["logDirectory"] = logDir
	manifest["openedFiles"] = openedFileResults
	if err := writeJSON("manifest.json", manifest); err != nil {
		return nil, fmt.Errorf("写入日志清单失败: %w", err)
	}
	if err := zw.Close(); err != nil {
		return nil, fmt.Errorf("完成压缩包失败: %w", err)
	}
	return buf.Bytes(), nil
}

func openedFileArchivePath(root, filePath string) (string, error) {
	absRoot, err := filepath.Abs(root)
	if err != nil {
		return "", fmt.Errorf("解析扫描根目录失败: %w", err)
	}
	absPath, err := filepath.Abs(filePath)
	if err != nil {
		return "", fmt.Errorf("解析文件路径失败: %w", err)
	}
	relativePath, err := filepath.Rel(absRoot, absPath)
	if err != nil || relativePath == ".." || strings.HasPrefix(relativePath, ".."+string(filepath.Separator)) {
		return "", fmt.Errorf("文件不在 LocalBridge 扫描根目录内")
	}
	return filepath.ToSlash(filepath.Join("mpe", "open-files", "disk", relativePath)), nil
}

func isMPELogExcludedDirectory(name string) bool {
	return strings.EqualFold(name, "vision") || strings.EqualFold(name, "on_error")
}

// handleExportMFWLogs 按 MFAAvalonia 日志包的目录结构导出 MaaFramework 日志和调试图片。
func (h *UtilityHandler) handleExportMFWLogs(conn *server.Connection, _ models.Message) {
	logDir, _ := resolveMaafwLogPath()
	archive, fileCount, err := buildMFWLogArchive(logDir)
	if err != nil {
		logger.Error("Utility", "导出 MFW 日志失败: %v", err)
		conn.Send(models.Message{Path: "/lte/utility/mfw_logs_exported", Data: map[string]interface{}{
			"success": false,
			"message": "MFW 日志导出失败: " + err.Error(),
		}})
		return
	}

	conn.Send(models.Message{Path: "/lte/utility/mfw_logs_exported", Data: map[string]interface{}{
		"success":  true,
		"filename": fmt.Sprintf("log_%s.zip", time.Now().Format("20060102_150405")),
		"content":  base64.StdEncoding.EncodeToString(archive),
		"message":  fmt.Sprintf("已打包 %d 个 MFW 日志及图片文件", fileCount),
	}})
}

func buildMFWLogArchive(logDir string) ([]byte, int, error) {
	if info, err := os.Stat(logDir); err != nil {
		if os.IsNotExist(err) {
			return nil, 0, fmt.Errorf("日志目录不存在，可能尚未执行过调试任务")
		}
		return nil, 0, fmt.Errorf("读取日志目录失败: %w", err)
	} else if !info.IsDir() {
		return nil, 0, fmt.Errorf("日志路径不是目录")
	}

	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	fileCount := 0
	walkErr := filepath.WalkDir(logDir, func(path string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			logger.Warn("Utility", "导出 MFW 日志时跳过 %s: %v", path, walkErr)
			return nil
		}
		if entry.IsDir() || !isMFWLogPackageFile(entry.Name()) {
			return nil
		}

		data, err := os.ReadFile(path)
		if err != nil {
			logger.Warn("Utility", "导出 MFW 日志时跳过 %s: %v", path, err)
			return nil
		}
		relativePath, err := filepath.Rel(logDir, path)
		if err != nil {
			return nil
		}
		header := &zip.FileHeader{
			Name:   filepath.ToSlash(filepath.Join("debug", relativePath)),
			Method: zip.Deflate,
		}
		if isMFWLogImage(entry.Name()) {
			header.Method = zip.Store
		}
		writer, err := zw.CreateHeader(header)
		if err != nil {
			return fmt.Errorf("创建压缩包条目失败: %w", err)
		}
		if _, err := writer.Write(data); err != nil {
			return fmt.Errorf("写入压缩包条目失败: %w", err)
		}
		fileCount++
		return nil
	})
	if walkErr != nil {
		_ = zw.Close()
		return nil, 0, fmt.Errorf("遍历日志目录失败: %w", walkErr)
	}
	if fileCount == 0 {
		_ = zw.Close()
		return nil, 0, fmt.Errorf("未找到可导出的 MFW 日志或图片")
	}
	if err := zw.Close(); err != nil {
		return nil, 0, fmt.Errorf("完成压缩包失败: %w", err)
	}
	return buf.Bytes(), fileCount, nil
}

func isMFWLogPackageFile(name string) bool {
	lowerName := strings.ToLower(name)
	return strings.HasPrefix(lowerName, "maa.log") ||
		strings.HasPrefix(lowerName, "maafw.log") ||
		strings.HasPrefix(lowerName, "custom.log") ||
		isMFWLogImage(lowerName)
}

func isMFWLogImage(name string) bool {
	_, ok := mfwLogImageExtensions[strings.ToLower(filepath.Ext(name))]
	return ok
}

// maafw.log 文件名
const maafwLogFileName = "maafw.log"

// 读取日志尾部时的最大字节数（约 256KB）
const maafwLogTailLimit int64 = 256 * 1024

// 解析 maafw.log 所在目录与完整路径
func resolveMaafwLogPath() (logDir string, logPath string) {
	cfg := config.GetGlobal()
	if cfg != nil && cfg.Log.Dir != "" {
		logDir = cfg.Log.Dir
	} else {
		logDir = paths.GetLogDir()
	}
	logPath = filepath.Join(logDir, maafwLogFileName)
	return logDir, logPath
}

// 读取 maafw.log 尾部内容
func (h *UtilityHandler) handleReadMaafwLog(conn *server.Connection, msg models.Message) {
	logDir, logPath := resolveMaafwLogPath()
	logger.Debug("Utility", "读取 maafw.log: %s", logPath)

	info, err := os.Stat(logPath)
	if err != nil {
		if os.IsNotExist(err) {
			conn.Send(models.Message{
				Path: "/lte/utility/maafw_log_content",
				Data: map[string]interface{}{
					"success": false,
					"exists":  false,
					"dir":     logDir,
					"path":    logPath,
					"message": "maafw.log 不存在，可能尚未执行过调试任务",
				},
			})
			return
		}
		conn.Send(models.Message{
			Path: "/lte/utility/maafw_log_content",
			Data: map[string]interface{}{
				"success": false,
				"exists":  false,
				"dir":     logDir,
				"path":    logPath,
				"message": "读取 maafw.log 失败: " + err.Error(),
			},
		})
		return
	}

	file, err := os.Open(logPath)
	if err != nil {
		conn.Send(models.Message{
			Path: "/lte/utility/maafw_log_content",
			Data: map[string]interface{}{
				"success": false,
				"exists":  true,
				"dir":     logDir,
				"path":    logPath,
				"message": "打开 maafw.log 失败: " + err.Error(),
			},
		})
		return
	}
	defer file.Close()

	size := info.Size()
	var offset int64
	truncated := false
	if size > maafwLogTailLimit {
		offset = size - maafwLogTailLimit
		truncated = true
	}

	if offset > 0 {
		if _, err := file.Seek(offset, 0); err != nil {
			conn.Send(models.Message{
				Path: "/lte/utility/maafw_log_content",
				Data: map[string]interface{}{
					"success": false,
					"exists":  true,
					"dir":     logDir,
					"path":    logPath,
					"message": "定位 maafw.log 失败: " + err.Error(),
				},
			})
			return
		}
	}

	buf := make([]byte, size-offset)
	n, err := file.Read(buf)
	if err != nil && n == 0 {
		conn.Send(models.Message{
			Path: "/lte/utility/maafw_log_content",
			Data: map[string]interface{}{
				"success": false,
				"exists":  true,
				"dir":     logDir,
				"path":    logPath,
				"message": "读取 maafw.log 内容失败: " + err.Error(),
			},
		})
		return
	}
	content := string(buf[:n])

	// 截断时去掉首个可能不完整的行
	if truncated {
		for i := 0; i < len(content); i++ {
			if content[i] == '\n' {
				content = content[i+1:]
				break
			}
		}
	}

	conn.Send(models.Message{
		Path: "/lte/utility/maafw_log_content",
		Data: map[string]interface{}{
			"success":   true,
			"exists":    true,
			"dir":       logDir,
			"path":      logPath,
			"content":   content,
			"size":      size,
			"truncated": truncated,
			"modTime":   info.ModTime().Format("2006-01-02 15:04:05"),
		},
	})
}

// 打开 maafw.log 所在文件夹（若文件存在则选中）
func (h *UtilityHandler) handleOpenMaafwLogDir(conn *server.Connection, msg models.Message) {
	logDir, logPath := resolveMaafwLogPath()
	logger.Debug("Utility", "尝试打开 maafw.log 所在目录: %s", logDir)

	if _, err := os.Stat(logDir); os.IsNotExist(err) {
		logger.Warn("Utility", "maafw.log 目录不存在: %s", logDir)
		conn.Send(models.Message{
			Path: "/lte/utility/maafw_log_opened",
			Data: map[string]interface{}{
				"success": false,
				"target":  "dir",
				"path":    logDir,
				"message": "日志目录不存在，可能尚未执行过调试任务",
			},
		})
		return
	}

	logFileExists := false
	if _, err := os.Stat(logPath); err == nil {
		logFileExists = true
	}

	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		if logFileExists {
			cmd = exec.Command("explorer", "/select,", logPath)
		} else {
			cmd = exec.Command("explorer", logDir)
		}
	case "darwin":
		if logFileExists {
			cmd = exec.Command("open", "-R", logPath)
		} else {
			cmd = exec.Command("open", logDir)
		}
	default:
		cmd = exec.Command("xdg-open", logDir)
	}

	if err := cmd.Start(); err != nil {
		logger.Error("Utility", "打开 maafw.log 目录失败: %v", err)
		conn.Send(models.Message{
			Path: "/lte/utility/maafw_log_opened",
			Data: map[string]interface{}{
				"success": false,
				"target":  "dir",
				"path":    logDir,
				"message": "打开日志目录失败: " + err.Error(),
			},
		})
		return
	}

	logger.Debug("Utility", "maafw.log 目录已打开")
	var successMsg string
	if logFileExists {
		successMsg = "已打开日志目录并选中 maafw.log"
	} else {
		successMsg = "已打开日志目录（maafw.log 文件尚不存在）"
	}
	conn.Send(models.Message{
		Path: "/lte/utility/maafw_log_opened",
		Data: map[string]interface{}{
			"success": true,
			"target":  "dir",
			"path":    logDir,
			"message": successMsg,
		},
	})
}
