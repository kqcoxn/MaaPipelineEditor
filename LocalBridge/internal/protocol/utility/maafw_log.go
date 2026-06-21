package utility

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/config"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/paths"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/server"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/pkg/models"
)

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
