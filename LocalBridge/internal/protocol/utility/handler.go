package utility

import (
	"bytes"
	"encoding/base64"
	"image"
	_ "image/jpeg" // 注册 JPEG 解码器（本地上传底图可能为 JPEG）
	"image/png"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/config"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/errors"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/mfw"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/server"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/pkg/models"
)

// Utility协议处理器
type UtilityHandler struct {
	mfwService *mfw.Service
	root       string // 根目录路径
	version    string
}

// 创建Utility协议处理器
func NewUtilityHandler(mfwService *mfw.Service, root string, version string) *UtilityHandler {
	return &UtilityHandler{
		mfwService: mfwService,
		root:       root,
		version:    version,
	}
}

// 返回处理的路由前缀
func (h *UtilityHandler) GetRoutePrefix() []string {
	return []string{"/etl/utility/"}
}

// 处理消息
func (h *UtilityHandler) Handle(msg models.Message, conn *server.Connection) *models.Message {
	path := msg.Path
	logger.Debug("Utility", "处理Utility消息: %s", path)

	// 根据路由分发到不同的处理器
	switch path {
	case "/etl/utility/ocr_recognize":
		h.handleOCRRecognize(conn, msg)

	case "/etl/utility/template_match":
		h.handleTemplateMatch(conn, msg)

	case "/etl/utility/resolve_image_path":
		h.handleResolveImagePath(conn, msg)

	case "/etl/utility/open_log":
		h.handleOpenLog(conn, msg)

	case "/etl/utility/read_maafw_log":
		h.handleReadMaafwLog(conn, msg)

	case "/etl/utility/open_maafw_log_dir":
		h.handleOpenMaafwLogDir(conn, msg)

	case "/etl/utility/export_logs":
		h.handleExportLogs(conn, msg)

	case "/etl/utility/export_mfw_logs":
		h.handleExportMFWLogs(conn, msg)

	default:
		logger.Warn("Utility", "未知的Utility路由: %s", path)
		h.sendError(conn, errors.NewInvalidRequestError("未知的Utility路由: "+path))
	}

	return nil
}

// 将图像编码为 Base64
func (h *UtilityHandler) encodeImageToBase64(img image.Image) (string, error) {
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return "", mfw.NewMFWError(mfw.ErrCodeOperationFail, "failed to encode image", nil)
	}
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(buf.Bytes()), nil
}

// decodeBase64Image 将 base64 图片（可带 data URL 前缀，如 "data:image/png;base64,xxxx"）
// 解码为 image.Image。支持 PNG / JPEG。
func decodeBase64Image(b64 string) (image.Image, error) {
	if idx := strings.Index(b64, ","); strings.HasPrefix(b64, "data:") && idx >= 0 {
		b64 = b64[idx+1:]
	}
	raw, err := base64.StdEncoding.DecodeString(strings.TrimSpace(b64))
	if err != nil {
		return nil, err
	}
	img, _, err := image.Decode(bytes.NewReader(raw))
	if err != nil {
		return nil, err
	}
	return img, nil
}

// 辅助方法
func (h *UtilityHandler) sendError(conn *server.Connection, err *errors.LBError) {
	errorMsg := models.Message{
		Path: "/error",
		Data: err.ToErrorData(),
	}
	conn.Send(errorMsg)
}

func (h *UtilityHandler) sendUtilityError(conn *server.Connection, code, message string, detail interface{}) {
	errorMsg := models.Message{
		Path: "/error",
		Data: map[string]interface{}{
			"code":    code,
			"message": message,
			"detail":  detail,
		},
	}
	conn.Send(errorMsg)
}

// 处理解析图片路径请求
func (h *UtilityHandler) handleResolveImagePath(conn *server.Connection, msg models.Message) {
	// 解析请求
	dataMap, ok := msg.Data.(map[string]interface{})
	if !ok {
		h.sendError(conn, errors.NewInvalidRequestError("请求数据格式错误"))
		return
	}

	fileName, _ := dataMap["file_name"].(string)
	if fileName == "" {
		h.sendUtilityError(conn, "INVALID_REQUEST", "文件名不能为空", nil)
		return
	}

	logger.Debug("Utility", "解析图片路径 - 文件名: %s", fileName)

	// 在根目录下搜索所有 image 目录中的文件
	result, imageDir, err := h.searchFileInAllImageDirs(h.root, fileName)
	if err != nil {
		logger.Error("Utility", "搜索文件失败: %v", err)
		conn.Send(models.Message{
			Path: "/lte/utility/image_path_resolved",
			Data: models.ResolveImagePathResponse{
				Success: false,
				Message: err.Error(),
			},
		})
		return
	}

	if result == nil {
		logger.Warn("Utility", "未找到文件: %s", fileName)
		conn.Send(models.Message{
			Path: "/lte/utility/image_path_resolved",
			Data: models.ResolveImagePathResponse{
				Success: false,
				Message: "未找到文件，请手动输入路径",
			},
		})
		return
	}

	// 计算相对路径
	relPath, err := filepath.Rel(imageDir, result.AbsPath)
	if err != nil {
		relPath = result.Name
	}
	// 统一使用正斜杠
	relPath = strings.ReplaceAll(relPath, "\\", "/")

	logger.Debug("Utility", "找到文件 - image目录: %s, 相对路径: %s, 绝对路径: %s", imageDir, relPath, result.AbsPath)

	conn.Send(models.Message{
		Path: "/lte/utility/image_path_resolved",
		Data: models.ResolveImagePathResponse{
			Success:      true,
			RelativePath: relPath,
			AbsolutePath: result.AbsPath,
			Message:      "ok",
		},
	})
}

// 文件搜索结果
type fileSearchResult struct {
	AbsPath      string
	Name         string
	LastModified int64
}

// 在所有 image 目录中搜索文件
func (h *UtilityHandler) searchFileInAllImageDirs(root string, fileName string) (*fileSearchResult, string, error) {
	var latestFile *fileSearchResult
	var latestImageDir string

	// 遍历根目录
	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // 跳过错误，继续搜索
		}

		// 如果是目录且名为 "image"
		if info.IsDir() && info.Name() == "image" {
			logger.Debug("Utility", "发现 image 目录: %s", path)

			// 在该 image 目录中搜索文件
			result := h.searchFileInSingleDir(path, fileName)

			// 比较修改时间
			if result != nil {
				if latestFile == nil || result.LastModified > latestFile.LastModified {
					latestFile = result
					latestImageDir = path
					logger.Debug("Utility", "在 %s 中找到更新的文件: %s (修改时间: %d)", path, fileName, result.LastModified)
				}
			}

			// 跳过遍历该 image 目录的子目录
			return filepath.SkipDir
		}

		return nil
	})

	if err != nil {
		return nil, "", err
	}

	return latestFile, latestImageDir, nil
}

// 在单个目录中搜索文件
func (h *UtilityHandler) searchFileInSingleDir(dir string, fileName string) *fileSearchResult {
	var latestFile *fileSearchResult

	// 遍历目录
	filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}

		// 跳过目录
		if info.IsDir() {
			return nil
		}

		// 检查文件名是否匹配
		if info.Name() == fileName {
			// 优先返回最新图片
			if latestFile == nil || info.ModTime().Unix() > latestFile.LastModified {
				latestFile = &fileSearchResult{
					AbsPath:      path,
					Name:         info.Name(),
					LastModified: info.ModTime().Unix(),
				}
			}
		}

		return nil
	})

	return latestFile
}

// 处理打开日志文件请求
func (h *UtilityHandler) handleOpenLog(conn *server.Connection, msg models.Message) {
	// 获取日志目录
	cfg := config.GetGlobal()
	var logDir string
	if cfg != nil && cfg.Log.Dir != "" {
		logDir = cfg.Log.Dir
	} else {
		// 使用默认日志目录
		logDir = filepath.Join(h.root, "debug")
	}

	// 构建 maa.log 路径
	logPath := filepath.Join(logDir, "maa.log")

	logger.Debug("Utility", "尝试打开日志目录: %s", logDir)

	// 检查目录是否存在
	if _, err := os.Stat(logDir); os.IsNotExist(err) {
		logger.Warn("Utility", "日志目录不存在: %s", logDir)
		conn.Send(models.Message{
			Path: "/lte/utility/log_opened",
			Data: map[string]interface{}{
				"success": false,
				"message": "日志目录不存在，可能尚未执行过调试任务",
			},
		})
		return
	}

	// 检查日志文件是否存在
	logFileExists := false
	if _, err := os.Stat(logPath); err == nil {
		logFileExists = true
	}

	// 根据操作系统使用不同的命令打开日志目录
	var cmd *exec.Cmd

	switch runtime.GOOS {
	case "windows":
		// Windows: 使用 explorer 打开目录
		// 如果文件存在，使用 /select 参数选中文件
		if logFileExists {
			cmd = exec.Command("explorer", "/select,", logPath)
			logger.Debug("Utility", "执行命令: explorer /select, %s", logPath)
		} else {
			cmd = exec.Command("explorer", logDir)
			logger.Debug("Utility", "执行命令: explorer %s", logDir)
		}
	case "darwin":
		// macOS: 使用 open 命令打开目录
		// 如果文件存在，使用 -R 参数选中文件
		if logFileExists {
			cmd = exec.Command("open", "-R", logPath)
			logger.Debug("Utility", "执行命令: open -R %s", logPath)
		} else {
			cmd = exec.Command("open", logDir)
			logger.Debug("Utility", "执行命令: open %s", logDir)
		}
	default:
		// Linux: 使用 xdg-open 打开目录
		cmd = exec.Command("xdg-open", logDir)
		logger.Debug("Utility", "执行命令: xdg-open %s", logDir)
	}

	// 执行命令
	if err := cmd.Start(); err != nil {
		logger.Error("Utility", "打开日志目录失败: %v", err)
		conn.Send(models.Message{
			Path: "/lte/utility/log_opened",
			Data: map[string]interface{}{
				"success": false,
				"message": "打开日志目录失败: " + err.Error(),
			},
		})
		return
	}

	logger.Debug("Utility", "日志目录已打开")

	var successMsg string
	if logFileExists {
		successMsg = "已打开日志目录并选中 maa.log"
	} else {
		successMsg = "已打开日志目录（maa.log 文件尚不存在）"
	}

	conn.Send(models.Message{
		Path: "/lte/utility/log_opened",
		Data: map[string]interface{}{
			"success": true,
			"message": successMsg,
			"path":    logPath,
		},
	})
}
