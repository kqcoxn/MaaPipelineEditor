package utility

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"image"
	"image/png"

	maa "github.com/MaaXYZ/maa-framework-go/v3"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/errors"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/mfw"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/server"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/pkg/models"
)

// Utility协议处理器
type UtilityHandler struct {
	mfwService *mfw.Service
}

// 创建Utility协议处理器
func NewUtilityHandler(mfwService *mfw.Service) *UtilityHandler {
	return &UtilityHandler{
		mfwService: mfwService,
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
		h.sendUtilityError(conn, "OCR_FAILED", "OCR识别失败", err.Error())
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

	// 获取资源（如果提供了resourceID）
	var res *maa.Resource
	if resourceID != "" {
		resourceInfo, err := h.mfwService.ResourceManager().GetResource(resourceID)
		if err != nil {
			logger.Warn("Utility", "获取资源失败，将使用默认OCR配置: %v", err)
		} else if r, ok := resourceInfo.Resource.(*maa.Resource); ok {
			res = r
			logger.Info("Utility", "使用资源 %s 进行OCR识别", resourceInfo.ResourceID)
		}
	}

	logger.Info("Utility", "使用控制器 %s 进行OCR识别", controllerInfo.ControllerID)

	// 执行截图获取当前屏幕图像
	job := ctrl.PostScreencap()
	if job == nil {
		return nil, mfw.NewMFWError(mfw.ErrCodeOperationFail, "failed to post screencap", nil)
	}
	job.Wait()

	img := ctrl.CacheImage()
	if img == nil {
		return nil, mfw.NewMFWError(mfw.ErrCodeOperationFail, "failed to get screenshot", nil)
	}

	// 创建 Tasker 并绑定控制器和资源
	tasker := maa.NewTasker()
	if tasker == nil {
		return nil, mfw.NewMFWError(mfw.ErrCodeTaskSubmitFailed, "failed to create tasker", nil)
	}
	defer tasker.Destroy()

	if !tasker.BindController(ctrl) {
		return nil, mfw.NewMFWError(mfw.ErrCodeTaskSubmitFailed, "failed to bind controller", nil)
	}

	// 如果没有提供资源，创建一个临时资源
	if res == nil {
		res = maa.NewResource()
		if res == nil {
			return nil, mfw.NewMFWError(mfw.ErrCodeResourceLoadFailed, "failed to create resource", nil)
		}
		defer res.Destroy()
	}

	if !tasker.BindResource(res) {
		return nil, mfw.NewMFWError(mfw.ErrCodeTaskSubmitFailed, "failed to bind resource", nil)
	}

	// 构造 OCR 识别节点的 override 配置
	ocrNodeName := "_OCR_TEMP_NODE_"
	ocrConfig := map[string]interface{}{
		ocrNodeName: map[string]interface{}{
			"recognition": "OCR",
			"roi":         []int32{roi[0], roi[1], roi[2], roi[3]},
			"action":      "DoNothing",
		},
	}

	// 提交 OCR 任务
	taskJob := tasker.PostTask(ocrNodeName, ocrConfig)
	if taskJob == nil {
		return nil, mfw.NewMFWError(mfw.ErrCodeTaskSubmitFailed, "failed to post OCR task", nil)
	}
	taskJob.Wait()

	// 获取任务详情
	taskDetail := taskJob.GetDetail()
	if taskDetail == nil {
		logger.Warn("Utility", "OCR任务执行完成但无法获取详情")
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

	return map[string]interface{}{
		"success": true,
		"text":    "",
		"boxes":   []map[string]interface{}{},
		"image":   imageData,
		"roi":     []int32{roi[0], roi[1], roi[2], roi[3]},
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

	return map[string]interface{}{
		"success": true,
		"text":    allText,
		"boxes":   boxes,
		"image":   imageData,
		"roi":     []int32{roi[0], roi[1], roi[2], roi[3]},
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
