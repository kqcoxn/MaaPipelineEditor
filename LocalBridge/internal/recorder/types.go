package recorder

import (
	"fmt"
	"math"
	"strings"
)

type Step struct {
	Recognition string  `json:"recognition"`
	Action      string  `json:"action"`
	ROI         [4]int  `json:"roi"`
	Expected    string  `json:"expected"`
	Threshold   float64 `json:"threshold"`
	Template    string  `json:"template_image"`
	Target      *[4]int `json:"target,omitempty"`
	Offset      [4]int  `json:"target_offset"`
}
type Request struct {
	RequestID    string `json:"request_id"`
	Mode         string `json:"mode"`
	ControllerID string `json:"controller_id"`
	ResourcePath string `json:"resource_path"`
	Image        string `json:"base_image"`
	Width        int    `json:"width"`
	Height       int    `json:"height"`
	Step         Step   `json:"step"`
}
type Box struct {
	X      int     `json:"x"`
	Y      int     `json:"y"`
	Width  int     `json:"width"`
	Height int     `json:"height"`
	Score  float64 `json:"score"`
	Text   string  `json:"text"`
}
type Result struct {
	RequestID     string `json:"request_id"`
	Success       bool   `json:"success"`
	Error         string `json:"error,omitempty"`
	Hit           bool   `json:"hit"`
	ActionSuccess *bool  `json:"action_success,omitempty"`
	Best          *Box   `json:"best,omitempty"`
	Boxes         []Box  `json:"boxes"`
	Image         string `json:"image,omitempty"`
	Width         int    `json:"width,omitempty"`
	Height        int    `json:"height,omitempty"`
}

func (r Request) Validate() error {
	if r.Mode != "preview" && r.Mode != "execute" && r.Mode != "extract" && r.Mode != "suggest" {
		return fmt.Errorf("未知的 Recorder 操作")
	}
	if r.Mode == "suggest" && (r.ResourcePath != "" || r.Step.Action != "DoNothing") {
		return fmt.Errorf("自动候选仅允许使用内置 OCR 进行只读识别")
	}
	s := r.Step
	if s.Recognition != "OCR" && s.Recognition != "TemplateMatch" && s.Recognition != "DirectHit" {
		return fmt.Errorf("不支持的识别类型")
	}
	if s.Action != "Click" && s.Action != "DoNothing" {
		return fmt.Errorf("不支持的动作类型")
	}
	if math.IsNaN(s.Threshold) || math.IsInf(s.Threshold, 0) || s.Threshold < 0 || s.Threshold > 1 {
		return fmt.Errorf("阈值必须在 0 到 1 之间")
	}
	if (r.Mode == "extract" || r.Mode == "suggest") && s.Recognition != "OCR" {
		return fmt.Errorf("仅 OCR 支持文字提取")
	}
	if s.Recognition == "OCR" && r.Mode != "extract" && r.Mode != "suggest" && strings.TrimSpace(s.Expected) == "" {
		return fmt.Errorf("请填写 OCR 文字")
	}
	if s.Recognition == "TemplateMatch" && s.Template == "" {
		return fmt.Errorf("请裁剪模板")
	}
	if r.Mode == "execute" && s.Recognition == "DirectHit" && s.Action == "Click" && s.Target == nil {
		return fmt.Errorf("直接点击必须指定固定目标")
	}
	if r.Mode == "execute" && (r.ControllerID == "" || r.Width <= 0 || r.Height <= 0) {
		return fmt.Errorf("请先获取设备截图")
	}
	if r.Mode != "execute" && r.Image == "" {
		return fmt.Errorf("请先获取底图")
	}
	return nil
}
