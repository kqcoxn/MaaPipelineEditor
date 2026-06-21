package utility

import (
	"encoding/json"
	"image"

	maa "github.com/MaaXYZ/maa-framework-go/v4"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/mfw"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/server"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/pkg/models"
)

// 模板匹配快速验证：在前端固定的底图上，用指定模板图跑一次 TemplateMatch 识别，
// 返回完整的识别详情（命中、最佳框、所有候选框+分数），用于"调字段 → 立即验证"的闭环。
//
// 底图与模板图均由前端以 base64 传入，后端用 FixedImageController 作底图源、
// 用 Resource.OverrideImage 注入模板，无需真实设备、无需将模板落盘到资源包。

const (
	templateMatchNode  = "_TEMPLATE_MATCH_TEMP_"
	templateImageName  = "@mpe_template"
	templateMatchRoute = "/lte/utility/template_match_result"
)

// 处理模板匹配请求
func (h *UtilityHandler) handleTemplateMatch(conn *server.Connection, msg models.Message) {
	dataMap, ok := msg.Data.(map[string]interface{})
	if !ok {
		h.sendTemplateMatchError(conn, "INVALID_REQUEST", "请求数据格式错误", nil)
		return
	}

	baseImage, _ := dataMap["base_image"].(string)
	templateImage, _ := dataMap["template_image"].(string)
	if baseImage == "" {
		h.sendTemplateMatchError(conn, "INVALID_REQUEST", "底图不能为空", "base_image 必须是 base64 编码的图片")
		return
	}
	if templateImage == "" {
		h.sendTemplateMatchError(conn, "INVALID_REQUEST", "模板图不能为空", "template_image 必须是 base64 编码的图片")
		return
	}

	// 解析 ROI（可选，默认全屏 [0,0,0,0]）
	var roi [4]int32
	if roiData, ok := dataMap["roi"].([]interface{}); ok && len(roiData) == 4 {
		for i := 0; i < 4; i++ {
			if val, ok := roiData[i].(float64); ok {
				roi[i] = int32(val)
			}
		}
	}

	// 阈值（可选，默认 0.7）
	threshold := 0.7
	if v, ok := dataMap["threshold"].(float64); ok {
		threshold = v
	}

	// 匹配算法（可选，默认 5 = TM_CCOEFF_NORMED）
	method := 5
	if v, ok := dataMap["method"].(float64); ok {
		method = int(v)
	}

	// 绿色掩码（可选，默认 false）
	greenMask := false
	if v, ok := dataMap["green_mask"].(bool); ok {
		greenMask = v
	}

	logger.Debug("Utility", "执行模板匹配 - ROI: %v, threshold: %.3f, method: %d, green_mask: %v",
		roi, threshold, method, greenMask)

	result, err := h.performTemplateMatch(baseImage, templateImage, roi, threshold, method, greenMask)
	if err != nil {
		logger.Error("Utility", "模板匹配失败: %v", err)
		errorResult := map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		}
		if mfwErr, ok := err.(*mfw.MFWError); ok {
			errorResult["code"] = mfwErr.Code
			if mfwErr.Detail != nil {
				errorResult["detail"] = mfwErr.Detail
			}
		}
		conn.Send(models.Message{Path: templateMatchRoute, Data: errorResult})
		return
	}

	conn.Send(models.Message{Path: templateMatchRoute, Data: result})
}

// sendTemplateMatchError 通过结果路由回送一个失败结构（前端在同一回调里处理成功/失败）
func (h *UtilityHandler) sendTemplateMatchError(conn *server.Connection, code, message string, detail interface{}) {
	conn.Send(models.Message{
		Path: templateMatchRoute,
		Data: map[string]interface{}{
			"success": false,
			"code":    code,
			"error":   message,
			"detail":  detail,
		},
	})
}

// PLACEHOLDER_PERFORM

// performTemplateMatch 在固定底图上运行一次 TemplateMatch 识别。
func (h *UtilityHandler) performTemplateMatch(
	baseImageB64, templateImageB64 string,
	roi [4]int32, threshold float64, method int, greenMask bool,
) (map[string]interface{}, error) {
	// 1. 解码底图 + 模板图
	baseImg, err := decodeBase64Image(baseImageB64)
	if err != nil {
		return nil, mfw.NewMFWError(mfw.ErrCodeInvalidParameter, "底图解码失败: "+err.Error(), nil)
	}
	templateImg, err := decodeBase64Image(templateImageB64)
	if err != nil {
		return nil, mfw.NewMFWError(mfw.ErrCodeInvalidParameter, "模板图解码失败: "+err.Error(), nil)
	}

	// 2. 固定图片控制器
	ctrl, ctrlErr := mfw.NewFixedImageController(baseImg)
	if ctrlErr != nil || ctrl == nil {
		return nil, mfw.NewMFWError(mfw.ErrCodeControllerCreateFail, "创建固定图片控制器失败", nil)
	}
	defer ctrl.Destroy()
	if connJob := ctrl.PostConnect(); connJob != nil {
		connJob.Wait()
	}

	// 3. 临时空资源 + 注入模板图
	res, resErr := maa.NewResource()
	if resErr != nil {
		return nil, mfw.NewMFWError(mfw.ErrCodeResourceLoadFailed, "创建资源失败: "+resErr.Error(), nil)
	}
	defer res.Destroy()

	if ovErr := res.OverrideImage(templateImageName, templateImg); ovErr != nil {
		return nil, mfw.NewMFWError(mfw.ErrCodeResourceLoadFailed, "注入模板图失败: "+ovErr.Error(), nil)
	}

	// 4. 临时 Tasker，绑定固定控制器与资源
	tasker, taskerErr := maa.NewTasker()
	if taskerErr != nil {
		return nil, mfw.NewMFWError(mfw.ErrCodeTaskSubmitFailed, "创建 Tasker 失败: "+taskerErr.Error(), nil)
	}
	defer tasker.Destroy()

	if bindErr := tasker.BindController(ctrl); bindErr != nil {
		return nil, mfw.NewMFWError(mfw.ErrCodeTaskSubmitFailed, "绑定控制器失败: "+bindErr.Error(), nil)
	}
	if bindErr := tasker.BindResource(res); bindErr != nil {
		return nil, mfw.NewMFWError(mfw.ErrCodeTaskSubmitFailed, "绑定资源失败: "+bindErr.Error(), nil)
	}
	if !tasker.Initialized() {
		return nil, mfw.NewMFWError(mfw.ErrCodeTaskSubmitFailed, "Tasker 初始化失败", nil)
	}

	// 5. 构造并提交 TemplateMatch 节点（只识别不动作）
	matchConfig := map[string]interface{}{
		templateMatchNode: map[string]interface{}{
			"recognition": "TemplateMatch",
			"template":    templateImageName,
			"roi":         []int32{roi[0], roi[1], roi[2], roi[3]},
			"threshold":   threshold,
			"method":      method,
			"green_mask":  greenMask,
			"action":      "DoNothing",
			"timeout":     0,
		},
	}

	taskJob := tasker.PostTask(templateMatchNode, matchConfig)
	if taskJob == nil {
		return nil, mfw.NewMFWError(mfw.ErrCodeTaskSubmitFailed, "提交模板匹配任务失败", nil)
	}
	taskJob.Wait()

	taskDetail, detailErr := taskJob.GetDetail()
	if detailErr != nil || taskDetail == nil {
		return h.buildEmptyTemplateMatchResult(baseImg, roi)
	}

	return h.parseTemplateMatchResult(taskDetail, baseImg, roi)
}

// PLACEHOLDER_PARSE

// templateMatchItem 单个候选匹配（box + score）
type templateMatchItem struct {
	Box   [4]int32 `json:"box"`
	Score float64  `json:"score"`
}

// buildEmptyTemplateMatchResult 未取得识别详情时的空结果
func (h *UtilityHandler) buildEmptyTemplateMatchResult(img image.Image, roi [4]int32) (map[string]interface{}, error) {
	imageData, err := h.encodeImageToBase64(img)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"success": true,
		"hit":     false,
		"best":    nil,
		"all":     []map[string]interface{}{},
		"image":   imageData,
		"roi":     []int32{roi[0], roi[1], roi[2], roi[3]},
	}, nil
}

// parseTemplateMatchResult 从任务详情解析 TemplateMatch 的识别结果
func (h *UtilityHandler) parseTemplateMatchResult(taskDetail *maa.TaskDetail, img image.Image, roi [4]int32) (map[string]interface{}, error) {
	imageData, err := h.encodeImageToBase64(img)
	if err != nil {
		return nil, err
	}

	hit := false
	var best map[string]interface{}
	all := []map[string]interface{}{}
	rawDetailJson := ""

	for _, node := range taskDetail.Nodes {
		nodeDetail, _ := node.GetDetail()
		if nodeDetail == nil || nodeDetail.Recognition == nil {
			continue
		}
		rec := nodeDetail.Recognition
		if rec.Hit {
			hit = true
		}
		if rec.DetailJson == "" {
			continue
		}
		rawDetailJson = rec.DetailJson

		// DetailJson 形如 {"all":[{box,score}...], "best":{box,score}, "filtered":[...]}
		var parsed struct {
			All  []templateMatchItem `json:"all"`
			Best *templateMatchItem  `json:"best"`
		}
		if err := json.Unmarshal([]byte(rec.DetailJson), &parsed); err != nil {
			continue
		}

		for _, item := range parsed.All {
			all = append(all, templateItemToMap(item))
		}
		if parsed.Best != nil {
			best = templateItemToMap(*parsed.Best)
		}
	}

	return map[string]interface{}{
		"success":     true,
		"hit":         hit,
		"best":        best,
		"all":         all,
		"image":       imageData,
		"roi":         []int32{roi[0], roi[1], roi[2], roi[3]},
		"detail_json": rawDetailJson,
	}, nil
}

func templateItemToMap(item templateMatchItem) map[string]interface{} {
	return map[string]interface{}{
		"x":      item.Box[0],
		"y":      item.Box[1],
		"width":  item.Box[2],
		"height": item.Box[3],
		"score":  item.Score,
	}
}


