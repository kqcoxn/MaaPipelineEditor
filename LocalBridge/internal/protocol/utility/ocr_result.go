package utility

import (
	"encoding/json"
	"fmt"
	"image"
	"strings"

	maa "github.com/MaaXYZ/maa-framework-go/v4"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/mfw"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/server"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/pkg/models"
)

// 请求 ID 随成功和失败结果一起返回，避免旧请求覆盖当前验证。
func (h *UtilityHandler) handleOCRRecognize(conn *server.Connection, msg models.Message) {
	data, _ := msg.Data.(map[string]interface{})
	requestID, _ := data["request_id"].(string)
	send := func(result map[string]interface{}) {
		result["request_id"] = requestID
		conn.Send(models.Message{Path: "/lte/utility/ocr_result", Data: result})
	}
	fail := func(err error) {
		result := map[string]interface{}{"success": false, "error": err.Error()}
		if mfwErr, ok := err.(*mfw.MFWError); ok {
			result["code"], result["detail"] = mfwErr.Code, mfwErr.Detail
		}
		send(result)
	}
	baseImage, _ := data["base_image"].(string)
	resourceID, _ := data["resource_id"].(string)
	if baseImage == "" {
		fail(fmt.Errorf("请提供底图"))
		return
	}
	var roi [4]int32
	encodedROI, err := json.Marshal(data["roi"])
	var coordinates []int32
	if err != nil || json.Unmarshal(encodedROI, &coordinates) != nil || len(coordinates) != 4 {
		fail(fmt.Errorf("ROI 必须是 [x, y, w, h] 整数数组"))
		return
	}
	copy(roi[:], coordinates)
	params, err := parseOCRParams(data["params"])
	if err != nil {
		fail(err)
		return
	}
	result, err := h.performOCR(baseImage, resourceID, roi, params)
	if err != nil {
		fail(err)
		return
	}
	send(result)
}

func parseOCRParams(value interface{}) (map[string]interface{}, error) {
	if value == nil {
		return nil, nil
	}
	params, ok := value.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("OCR 参数必须是对象")
	}
	for key := range params {
		switch key {
		case "expected", "threshold", "replace", "order_by", "index", "only_rec", "model", "roi_offset":
		default:
			return nil, fmt.Errorf("文字识别验证不支持参数 %s；依赖其他节点的识别请使用节点识别测试", key)
		}
	}
	return params, nil
}

type ocrItem struct {
	Box   [4]int32 `json:"box"`
	Text  string   `json:"text"`
	Score float64  `json:"score"`
}

// all 是原始识别结果，filtered/best 是经过阈值、替换、正则及排序后的结果。
func decodeOCRDetail(raw string, hit bool) (map[string]interface{}, error) {
	var detail struct {
		All      []ocrItem `json:"all"`
		Filtered []ocrItem `json:"filtered"`
		Best     *ocrItem  `json:"best"`
	}
	if err := json.Unmarshal([]byte(raw), &detail); err != nil {
		return nil, fmt.Errorf("无法解析 OCR 识别详情: %w", err)
	}
	convert := func(items []ocrItem) []map[string]interface{} {
		result := make([]map[string]interface{}, 0, len(items))
		for _, item := range items {
			result = append(result, ocrItemToMap(item))
		}
		return result
	}
	texts := make([]string, 0, len(detail.All))
	for _, item := range detail.All {
		texts = append(texts, item.Text)
	}
	var best interface{}
	if detail.Best != nil {
		best = ocrItemToMap(*detail.Best)
	}
	all := convert(detail.All)
	return map[string]interface{}{
		"success": true, "hit": hit, "all": all, "boxes": all,
		"filtered": convert(detail.Filtered), "best": best,
		"text": strings.Join(texts, "\n"), "no_content": len(detail.All) == 0,
		"detail_json": raw,
	}, nil
}

func ocrItemToMap(item ocrItem) map[string]interface{} {
	return map[string]interface{}{
		"x": item.Box[0], "y": item.Box[1], "width": item.Box[2], "height": item.Box[3],
		"text": item.Text, "score": item.Score,
	}
}

func (h *UtilityHandler) parseOCRResult(detail *maa.TaskDetail, img image.Image, roi [4]int32) (map[string]interface{}, error) {
	for _, node := range detail.Nodes {
		nd, err := node.GetDetail()
		if err != nil || nd == nil || nd.Recognition == nil || nd.Recognition.DetailJson == "" {
			continue
		}
		result, err := decodeOCRDetail(nd.Recognition.DetailJson, nd.Recognition.Hit)
		if err != nil {
			return nil, err
		}
		result["image"], err = h.encodeImageToBase64(img)
		if err != nil {
			return nil, err
		}
		result["roi"] = roi
		return result, nil
	}
	return nil, fmt.Errorf("OCR 未返回识别详情，请检查参数、模型和 MaaFramework 日志")
}
