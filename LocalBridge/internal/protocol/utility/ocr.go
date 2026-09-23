package utility

import (
	"encoding/json"
	"fmt"
	"os"
	"runtime"

	maa "github.com/MaaXYZ/maa-framework-go/v4"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/config"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/mfw"
)

// 保留显式的零阈值及空 expected，不让 Binding 的 omitempty 改写验证参数。
type ocrRecognitionParams struct {
	maa.OCRParam
	values map[string]interface{}
}

func (p ocrRecognitionParams) MarshalJSON() ([]byte, error) {
	return json.Marshal(p.values)
}

// 执行OCR识别
//
// baseImageB64 为前端固定下来的底图（base64，可带 data URL 前缀）。无论底图来自设备实时截图
// 还是本地上传，识别都严格基于这张图，不再二次截取设备，保证"所见即所得"。
func (h *UtilityHandler) performOCR(baseImageB64, resourceID string, roi [4]int32, params map[string]interface{}) (map[string]interface{}, error) {
	// 解码底图并创建固定图片控制器
	img, decErr := decodeBase64Image(baseImageB64)
	if decErr != nil {
		return nil, mfw.NewMFWError(mfw.ErrCodeInvalidParameter, "底图解码失败: "+decErr.Error(), nil)
	}

	ctrl, ctrlErr := mfw.NewFixedImageController(img)
	if ctrlErr != nil || ctrl == nil {
		return nil, mfw.NewMFWError(mfw.ErrCodeControllerCreateFail, "创建固定图片控制器失败", nil)
	}
	defer ctrl.Destroy()

	if connJob := ctrl.PostConnect(); connJob != nil {
		connJob.Wait()
	}
	logger.Debug("Utility", "固定图片控制器已就绪 (底图 %dx%d)", img.Bounds().Dx(), img.Bounds().Dy())

	// 获取或创建资源
	var res *maa.Resource
	var shouldDestroyRes bool

	if resourceID != "" {
		resourceInfo, err := h.mfwService.ResourceManager().GetResource(resourceID)
		if err != nil {
			logger.Warn("Utility", "获取资源失败,将创建临时资源: %v", err)
		} else if r, ok := resourceInfo.Resource.(*maa.Resource); ok {
			res = r
			logger.Debug("Utility", "使用已有资源 %s 进行OCR识别", resourceInfo.ResourceID)
		}
	}

	// 如果没有可用资源,创建临时资源
	if res == nil {
		// 检查自带 OCR 资源目录
		cfg := config.GetGlobal()
		if cfg == nil {
			logger.Error("Utility", "未加载 OCR 资源配置")
			return nil, mfw.NewMFWError(mfw.ErrCodeOCRResourceNotConfigured, "自带 OCR 资源不可用，请运行 'mpelb deps reinstall ocr' 修复", nil)
		}
		resourcePath := cfg.ResolvedMaaFWResourceDir()
		if resourcePath == "" {
			logger.Error("Utility", "自带 OCR 资源目录缺失")
			return nil, mfw.NewMFWError(mfw.ErrCodeOCRResourceNotConfigured, "自带 OCR 资源不可用，请运行 'mpelb deps reinstall ocr' 修复", nil)
		}

		var resErr error
		res, resErr = maa.NewResource()
		if resErr != nil {
			return nil, mfw.NewMFWError(mfw.ErrCodeResourceLoadFailed, "failed to create resource: "+resErr.Error(), nil)
		}
		shouldDestroyRes = true
		defer func() {
			if shouldDestroyRes && res != nil {
				res.Destroy()
			}
		}()

		// 加载 OCR 资源
		logger.Debug("Utility", "加载 OCR 资源: %s", resourcePath)

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
			logger.Error("Utility", "加载 OCR 资源失败: PostBundle 返回 nil (路径: %s)", actualPath)
			return nil, mfw.NewMFWError(mfw.ErrCodeResourceLoadFailed, "OCR 资源加载失败", map[string]interface{}{
				"reason":       "PostBundle 返回 nil",
				"resource_dir": resourcePath,
				"suggestions": []string{
					"检查 OCR 资源目录是否存在",
					"确认目录结构: <resource_dir>/model/ocr/",
					"确认必需文件: det.onnx, rec.onnx, keys.txt",
					"检查目录访问权限",
					"目录下若有 pipeline 文件，检查格式是否正确",
				},
			})
		}

		resJob.Wait()
		if !resJob.Success() {
			status := resJob.Status()
			logger.Error("Utility", "OCR 资源加载失败: Status=%v, 路径=%s", status, actualPath)
			return nil, mfw.NewMFWError(mfw.ErrCodeResourceLoadFailed, "OCR 资源加载失败", map[string]interface{}{
				"reason":       "资源加载状态异常",
				"status":       fmt.Sprintf("%v", status),
				"resource_dir": resourcePath,
				"suggestions": []string{
					"检查 OCR 资源目录是否存在",
					"确认目录结构: <resource_dir>/model/ocr/",
					"确认必需文件: det.onnx, rec.onnx, keys.txt",
					"检查文件完整性",
					"检查目录访问权限",
					"目录下若有 pipeline 文件，检查格式是否正确",
				},
			})
		}
		logger.Debug("Utility", "OCR 资源加载成功: %s", actualPath)

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
	tasker, taskerErr := maa.NewTasker()
	if taskerErr != nil {
		return nil, mfw.NewMFWError(mfw.ErrCodeTaskSubmitFailed, "failed to create tasker: "+taskerErr.Error(), nil)
	}
	defer tasker.Destroy()

	// 绑定控制器和资源
	if err := tasker.BindController(ctrl); err != nil {
		logger.Error("Utility", "绑定 Controller 失败: %v", err)
		return nil, mfw.NewMFWError(mfw.ErrCodeTaskSubmitFailed, "failed to bind controller: "+err.Error(), nil)
	}

	if err := tasker.BindResource(res); err != nil {
		logger.Error("Utility", "绑定 Resource 失败: %v", err)
		return nil, mfw.NewMFWError(mfw.ErrCodeTaskSubmitFailed, "failed to bind resource: "+err.Error(), nil)
	}

	// 等待 Tasker 初始化完成
	if !tasker.Initialized() {
		// 获取资源目录信息
		resourceDir := ""
		if cfg := config.GetGlobal(); cfg != nil {
			resourceDir = cfg.ResolvedMaaFWResourceDir()
		}

		logger.Error("Utility", "Tasker 未初始化 - 请检查 OCR 资源目录结构")
		logger.Error("Utility", "MaaFramework 期望 OCR 模型在: <resource_dir>/model/ocr/ 目录下")
		logger.Error("Utility", "需要文件: det.onnx, rec.onnx, keys.txt")
		return nil, mfw.NewMFWError(mfw.ErrCodeTaskSubmitFailed, "OCR 初始化失败", map[string]interface{}{
			"reason":       "Tasker 未初始化",
			"resource_dir": resourceDir,
			"suggestions": []string{
				"检查 OCR 资源目录结构是否正确",
				"确认 OCR 模型在: <resource_dir>/model/ocr/ 目录下",
				"确认必需文件存在: det.onnx, rec.onnx, keys.txt",
				"检查文件完整性（可能下载不完整）",
				"目录下若有 pipeline 文件，检查格式是否正确",
			},
		})
	}
	logger.Debug("Utility", "Tasker 初始化成功")

	// 直接提交识别，未命中时也保留候选结果与识别详情。
	param := map[string]interface{}{"roi": roi}
	for key, value := range params {
		param[key] = value
	}

	// 提交 OCR 任务
	logger.Debug("Utility", "提交 OCR 识别任务,ROI: %v", roi)
	taskJob := tasker.PostRecognition(maa.RecognitionTypeOCR, ocrRecognitionParams{values: param}, img)
	if taskJob == nil {
		return nil, mfw.NewMFWError(mfw.ErrCodeTaskSubmitFailed, "failed to post OCR task", nil)
	}

	// 等待识别完成
	status := taskJob.Wait()
	logger.Debug("Utility", "OCR 识别任务完成,状态: %v", status)

	// 获取识别详情
	taskDetail, detailErr := taskJob.GetDetail()
	if detailErr != nil || taskDetail == nil {
		logger.Warn("Utility", "OCR识别完成但无法获取详情")
		return nil, fmt.Errorf("OCR 未返回识别详情，请检查参数、模型和 MaaFramework 日志")
	}

	// 解析识别结果
	return h.parseOCRResult(taskDetail, img, roi)
}
