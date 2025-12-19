package utility

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"image"
	"image/png"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	maa "github.com/MaaXYZ/maa-framework-go/v3"
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
}

// 创建Utility协议处理器
func NewUtilityHandler(mfwService *mfw.Service, root string) *UtilityHandler {
	return &UtilityHandler{
		mfwService: mfwService,
		root:       root,
	}
}

// 返回处理的路由前缀
func (h *UtilityHandler) GetRoutePrefix() []string {
	return []string{"/etl/utility/"}
}

// 处理消息
func (h *UtilityHandler) Handle(msg models.Message, conn *server.Connection) *models.Message {
	path := msg.Path
	logger.Info("Utility", "处理Utility消息: %s", path)

	// 根据路由分发到不同的处理器
	switch path {
	case "/etl/utility/ocr_recognize":
		h.handleOCRRecognize(conn, msg)

	case "/etl/utility/resolve_image_path":
		h.handleResolveImagePath(conn, msg)

	default:
		logger.Warn("Utility", "未知的Utility路由: %s", path)
		h.sendError(conn, errors.NewInvalidRequestError("未知的Utility路由: "+path))
	}

	return nil
}

// OCR识别处理方法
func (h *UtilityHandler) handleOCRRecognize(conn *server.Connection, msg models.Message) {
	dataMap, ok := msg.Data.(map[string]interface{})
	if !ok {
		h.sendError(conn, errors.NewInvalidRequestError("请求数据格式错误"))
		return
	}

	controllerID, _ := dataMap["controller_id"].(string)
	resourceID, _ := dataMap["resource_id"].(string)

	// 解析 ROI 区域
	var roi [4]int32
	if roiData, ok := dataMap["roi"].([]interface{}); ok && len(roiData) == 4 {
		for i := 0; i < 4; i++ {
			if val, ok := roiData[i].(float64); ok {
				roi[i] = int32(val)
			}
		}
	} else {
		h.sendUtilityError(conn, "INVALID_ROI", "ROI格式错误", "ROI必须是[x, y, w, h]格式的数组")
		return
	}

	logger.Info("Utility", "执行OCR识别 - ControllerID: %s, ResourceID: %s, ROI: %v", controllerID, resourceID, roi)

	// 执行OCR识别
	result, err := h.performOCR(controllerID, resourceID, roi)
	if err != nil {
		logger.Error("Utility", "OCR识别失败: %v", err)
		// 返回错误
		errorResult := map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		}
		// 附加错误码
		if mfwErr, ok := err.(*mfw.MFWError); ok {
			errorResult["code"] = mfwErr.Code
		}
		conn.Send(models.Message{
			Path: "/lte/utility/ocr_result",
			Data: errorResult,
		})
		return
	}

	// 发送识别结果
	response := models.Message{
		Path: "/lte/utility/ocr_result",
		Data: result,
	}
	conn.Send(response)
}

// 执行OCR识别
func (h *UtilityHandler) performOCR(controllerID, resourceID string, roi [4]int32) (map[string]interface{}, error) {
	// 获取控制器
	controllerInfo, err := h.mfwService.ControllerManager().GetController(controllerID)
	if err != nil {
		return nil, err
	}

	ctrl, ok := controllerInfo.Controller.(*maa.Controller)
	if !ok || ctrl == nil {
		return nil, mfw.NewMFWError(mfw.ErrCodeControllerNotConnected, "controller instance not available", nil)
	}

	// 执行截图获取当前屏幕图像
	logger.Info("Utility", "使用控制器 %s 进行截图", controllerInfo.ControllerID)
	job := ctrl.PostScreencap()
	if job == nil {
		return nil, mfw.NewMFWError(mfw.ErrCodeOperationFail, "failed to post screencap", nil)
	}
	job.Wait()

	img := ctrl.CacheImage()
	if img == nil {
		return nil, mfw.NewMFWError(mfw.ErrCodeOperationFail, "failed to get screenshot", nil)
	}
	logger.Info("Utility", "截图获取成功")

	// 获取或创建资源
	var res *maa.Resource
	var shouldDestroyRes bool

	if resourceID != "" {
		resourceInfo, err := h.mfwService.ResourceManager().GetResource(resourceID)
		if err != nil {
			logger.Warn("Utility", "获取资源失败,将创建临时资源: %v", err)
		} else if r, ok := resourceInfo.Resource.(*maa.Resource); ok {
			res = r
			logger.Info("Utility", "使用已有资源 %s 进行OCR识别", resourceInfo.ResourceID)
		}
	}

	// 如果没有可用资源,创建临时资源
	if res == nil {
		// 检查配置中是否有 OCR 资源路径
		cfg := config.GetGlobal()
		if cfg == nil || cfg.MaaFW.ResourceDir == "" {
			logger.Error("Utility", "未配置 OCR 资源路径 (maafw.resource_dir)")
			return nil, mfw.NewMFWError(mfw.ErrCodeOCRResourceNotConfigured, "OCR 资源路径未配置，请在后端运行 'mpelb config set-resource' 进行配置", nil)
		}

		res = maa.NewResource()
		if res == nil {
			return nil, mfw.NewMFWError(mfw.ErrCodeResourceLoadFailed, "failed to create resource", nil)
		}
		shouldDestroyRes = true
		defer func() {
			if shouldDestroyRes && res != nil {
				res.Destroy()
			}
		}()

		// 从配置加载 OCR 资源
		resourcePath := cfg.MaaFW.ResourceDir
		logger.Info("Utility", "从配置加载 OCR 资源: %s", resourcePath)

		// Windows 下处理中文路径
		actualPath := resourcePath
		useWorkDirSwitch := false
		var originalDir string
		if runtime.GOOS == "windows" && mfw.ContainsNonASCII(resourcePath) {
			logger.Debug("Utility", "OCR 资源路径包含非 ASCII 字符，尝试转换为短路径...")
			shortPath, err := mfw.GetShortPathName(resourcePath)
			if err == nil && shortPath != resourcePath && !mfw.ContainsNonASCII(shortPath) {
				logger.Debug("Utility", "OCR 资源路径已转换为短路径: %s", shortPath)
				actualPath = shortPath
			} else {
				// 工作目录切换方案
				logger.Debug("Utility", "短路径无效，使用工作目录切换方案...")
				originalDir, err = os.Getwd()
				if err == nil {
					if err := os.Chdir(resourcePath); err == nil {
						logger.Debug("Utility", "已切换工作目录到: %s", resourcePath)
						actualPath = "."
						useWorkDirSwitch = true
					}
				}
			}
		}

		resJob := res.PostBundle(actualPath)
		if resJob == nil {
			logger.Warn("Utility", "加载 OCR 资源失败")
		} else {
			status := resJob.Wait()
			logger.Info("Utility", "OCR 资源加载状态: %v", status)
		}

		// 恢复工作目录
		if useWorkDirSwitch && originalDir != "" {
			if err := os.Chdir(originalDir); err != nil {
				logger.Warn("Utility", "恢复工作目录失败: %v", err)
			} else {
				logger.Debug("Utility", "已恢复工作目录")
			}
		}
	}

	// 创建临时 Tasker
	tasker := maa.NewTasker()
	if tasker == nil {
		return nil, mfw.NewMFWError(mfw.ErrCodeTaskSubmitFailed, "failed to create tasker", nil)
	}
	defer tasker.Destroy()

	// 绑定控制器和资源
	if !tasker.BindController(ctrl) {
		logger.Error("Utility", "绑定 Controller 失败")
		return nil, mfw.NewMFWError(mfw.ErrCodeTaskSubmitFailed, "failed to bind controller", nil)
	}

	if !tasker.BindResource(res) {
		logger.Error("Utility", "绑定 Resource 失败")
		return nil, mfw.NewMFWError(mfw.ErrCodeTaskSubmitFailed, "failed to bind resource", nil)
	}

	// 等待 Tasker 初始化完成
	if !tasker.Initialized() {
		logger.Error("Utility", "Tasker 未初始化 - 请检查 OCR 资源目录结构")
		logger.Error("Utility", "MaaFramework 期望 OCR 模型在: <resource_dir>/model/ocr/ 目录下")
		logger.Error("Utility", "需要文件: det.onnx, rec.onnx, keys.txt")
		return nil, mfw.NewMFWError(mfw.ErrCodeTaskSubmitFailed, "tasker not initialized - OCR model path may be incorrect, expected: <resource_dir>/model/ocr/", nil)
	}
	logger.Info("Utility", "Tasker 初始化成功")

	// 构造 OCR 识别节点
	ocrNodeName := "_OCR_TEMP_"
	ocrConfig := map[string]interface{}{
		ocrNodeName: map[string]interface{}{
			"recognition": "OCR",
			"roi":         []int32{roi[0], roi[1], roi[2], roi[3]},
			"action":      "DoNothing",
			"timeout":     0,
		},
	}

	// 提交 OCR 任务
	logger.Info("Utility", "提交 OCR 识别任务,ROI: %v", roi)
	taskJob := tasker.PostTask(ocrNodeName, ocrConfig)
	if taskJob == nil {
		return nil, mfw.NewMFWError(mfw.ErrCodeTaskSubmitFailed, "failed to post OCR task", nil)
	}

	// 等待识别完成
	status := taskJob.Wait()
	logger.Info("Utility", "OCR 识别任务完成,状态: %v", status)

	// 获取识别详情
	taskDetail := taskJob.GetDetail()
	if taskDetail == nil {
		logger.Warn("Utility", "OCR识别完成但无法获取详情")
		return h.buildEmptyOCRResult(img, roi)
	}

	// 解析识别结果
	return h.parseOCRResult(taskDetail, img, roi)
}

// 构建空的 OCR 结果
func (h *UtilityHandler) buildEmptyOCRResult(img image.Image, roi [4]int32) (map[string]interface{}, error) {
	imageData, err := h.encodeImageToBase64(img)
	if err != nil {
		return nil, err
	}

	logger.Info("Utility", "OCR 识别完成，未检测到文字内容")

	return map[string]interface{}{
		"success":    true,
		"text":       "",
		"boxes":      []map[string]interface{}{},
		"image":      imageData,
		"roi":        []int32{roi[0], roi[1], roi[2], roi[3]},
		"no_content": true,
	}, nil
}

// 解析 OCR 任务结果
func (h *UtilityHandler) parseOCRResult(taskDetail *maa.TaskDetail, img image.Image, roi [4]int32) (map[string]interface{}, error) {
	imageData, err := h.encodeImageToBase64(img)
	if err != nil {
		return nil, err
	}

	boxes := []map[string]interface{}{}
	allText := ""

	// 遍历节点详情获取识别结果
	for _, nodeDetail := range taskDetail.NodeDetails {
		if nodeDetail == nil || nodeDetail.Recognition == nil {
			continue
		}

		rec := nodeDetail.Recognition
		// 解析 DetailJson 获取 OCR 文本
		if rec.DetailJson != "" {
			var detail map[string]interface{}
			if err := json.Unmarshal([]byte(rec.DetailJson), &detail); err == nil {
				// 处理 all 数组格式的结果
				if allResults, ok := detail["all"].([]interface{}); ok && len(allResults) > 0 {
					for _, r := range allResults {
						if result, ok := r.(map[string]interface{}); ok {
							text := ""
							score := 0.0

							if t, ok := result["text"].(string); ok {
								text = t
								if allText != "" {
									allText += "\n"
								}
								allText += t
							}
							if s, ok := result["score"].(float64); ok {
								score = s
							}

							// 获取每个结果的 box
							if boxData, ok := result["box"].(map[string]interface{}); ok {
								boxes = append(boxes, map[string]interface{}{
									"x":      safeInt32(boxData["x"]),
									"y":      safeInt32(boxData["y"]),
									"width":  safeInt32(boxData["w"]),
									"height": safeInt32(boxData["h"]),
									"text":   text,
									"score":  score,
								})
							}
						}
					}
				} else if t, ok := detail["text"].(string); ok {
					// 处理单个文本结果
					allText = t
					score := 0.0
					if s, ok := detail["score"].(float64); ok {
						score = s
					}
					if boxData, ok := detail["box"].(map[string]interface{}); ok {
						boxes = append(boxes, map[string]interface{}{
							"x":      safeInt32(boxData["x"]),
							"y":      safeInt32(boxData["y"]),
							"width":  safeInt32(boxData["w"]),
							"height": safeInt32(boxData["h"]),
							"text":   t,
							"score":  score,
						})
					}
				}
			}
		}

		// 如果从 DetailJson 没有解析到 box，尝试使用 rec.Hit 信息
		if len(boxes) == 0 && rec.Hit {
			boxes = append(boxes, map[string]interface{}{
				"x":      roi[0],
				"y":      roi[1],
				"width":  roi[2],
				"height": roi[3],
				"text":   allText,
				"score":  0.0,
			})
		}
	}

	// 检查是否识别到内容
	hasContent := allText != "" || len(boxes) > 0

	if !hasContent {
		logger.Info("Utility", "OCR 识别完成，未检测到文字内容")
	}

	return map[string]interface{}{
		"success":    true,
		"text":       allText,
		"boxes":      boxes,
		"image":      imageData,
		"roi":        []int32{roi[0], roi[1], roi[2], roi[3]},
		"no_content": !hasContent,
	}, nil
}

// 安全转换为 int32
func safeInt32(v interface{}) int32 {
	if v == nil {
		return 0
	}
	if f, ok := v.(float64); ok {
		return int32(f)
	}
	return 0
}

// 将图像编码为 Base64
func (h *UtilityHandler) encodeImageToBase64(img image.Image) (string, error) {
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return "", mfw.NewMFWError(mfw.ErrCodeOperationFail, "failed to encode image", nil)
	}
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(buf.Bytes()), nil
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

	logger.Info("Utility", "解析图片路径 - 文件名: %s", fileName)

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

	logger.Info("Utility", "找到文件 - image目录: %s, 相对路径: %s, 绝对路径: %s", imageDir, relPath, result.AbsPath)

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
			logger.Info("Utility", "发现 image 目录: %s", path)

			// 在该 image 目录中搜索文件
			result := h.searchFileInSingleDir(path, fileName)

			// 比较修改时间
			if result != nil {
				if latestFile == nil || result.LastModified > latestFile.LastModified {
					latestFile = result
					latestImageDir = path
					logger.Info("Utility", "在 %s 中找到更新的文件: %s (修改时间: %d)", path, fileName, result.LastModified)
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
