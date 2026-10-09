package recorder

import (
	"context"
	"encoding/json"
	"fmt"
	"image"

	maa "github.com/MaaXYZ/maa-framework-go/v4"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/config"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/mfw"
)

// Preserve explicit zero thresholds; Binding omitempty must not change the draft.
type ocrParams struct {
	maa.OCRParam
	Values map[string]any
}

func (p ocrParams) MarshalJSON() ([]byte, error) { return json.Marshal(p.Values) }

type templateParams struct {
	maa.TemplateMatchParam
	Values map[string]any
}

func (p templateParams) MarshalJSON() ([]byte, error) { return json.Marshal(p.Values) }

func (s *Service) runNative(ctx context.Context, req Request, result *Result) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	var img image.Image
	var ctrl *maa.Controller
	var err error
	if req.Mode == "execute" {
		info, e := s.mfw.ControllerManager().GetController(req.ControllerID)
		if e != nil {
			return e
		}
		var ok bool
		ctrl, ok = info.Controller.(*maa.Controller)
		if !ok || ctrl == nil {
			return fmt.Errorf("控制器不可用")
		}
		img, err = s.mfw.ControllerManager().CaptureImage(req.ControllerID, true)
	} else {
		img, err = decodeImage(req.Image)
	}
	if err != nil {
		return err
	}
	result.Width = img.Bounds().Dx()
	result.Height = img.Bounds().Dy()
	if req.Mode != "suggest" {
		result.Image, err = encodeImage(img)
		if err != nil {
			return err
		}
	}
	if req.Mode == "execute" && (req.Width != result.Width || req.Height != result.Height) {
		return fmt.Errorf("设备截图尺寸已变化，请重新检查 ROI 和点击目标")
	}
	return runOnImage(ctx, req, img, ctrl, result)
}

func runOnImage(ctx context.Context, req Request, img image.Image, ctrl *maa.Controller, result *Result) error {
	var err error
	if ctrl == nil {
		ctrl, err = mfw.NewFixedImageController(img)
		if err != nil {
			return err
		}
		defer ctrl.Destroy()
		if job := ctrl.PostConnect(); job == nil || !job.Wait().Success() {
			return fmt.Errorf("无法初始化底图控制器")
		}
	}
	res, err := maa.NewResource()
	if err != nil {
		return err
	}
	defer res.Destroy()
	if req.Step.Recognition == "OCR" {
		cfg := config.GetGlobal()
		if cfg == nil || cfg.ResolvedMaaFWResourceDir() == "" {
			return fmt.Errorf("OCR 资源不可用，请修复本地 OCR 依赖")
		}
		if job := res.PostBundle(cfg.ResolvedMaaFWResourceDir()); job == nil || !job.Wait().Success() {
			return fmt.Errorf("加载 OCR 资源失败")
		}
	}
	if req.ResourcePath != "" {
		if job := res.PostBundle(req.ResourcePath); job == nil || !job.Wait().Success() {
			return fmt.Errorf("加载所选资源包失败")
		}
	}
	if req.Step.Recognition == "TemplateMatch" {
		template, e := decodeImage(req.Step.Template)
		if e != nil {
			return e
		}
		if err = res.OverrideImage("recorder-template.png", template); err != nil {
			return err
		}
	}
	tasker, err := maa.NewTasker()
	if err != nil {
		return err
	}
	defer tasker.Destroy()
	if err = tasker.BindResource(res); err != nil {
		return err
	}
	if err = tasker.BindController(ctrl); err != nil {
		return err
	}
	if err = ctx.Err(); err != nil {
		return err
	}
	param := recognitionParam(req)
	job := tasker.PostRecognition(maa.RecognitionType(req.Step.Recognition), param, img)
	if err = waitTask(ctx, tasker, job); err != nil {
		return err
	}
	detail, err := job.GetDetail()
	if err != nil {
		return err
	}
	var reco *maa.RecognitionDetail
	if detail != nil {
		for _, n := range detail.Nodes {
			d, e := n.GetDetail()
			if e == nil && d != nil && d.Recognition != nil {
				reco = d.Recognition
			}
		}
	}
	if reco == nil {
		return fmt.Errorf("未取得识别结果")
	}
	result.Hit = reco.Hit
	parseBoxes(reco, result)
	return executeIfMatched(ctx, req, result, func() (bool, error) {
		target := maa.NewTargetBool(true)
		if req.Step.Target != nil {
			target = maa.NewTargetRect(maa.Rect(*req.Step.Target))
		}
		actionJob := tasker.PostAction(maa.ActionTypeClick, maa.ClickParam{Target: target, TargetOffset: maa.Rect(req.Step.Offset)}, reco.Box, reco)
		if e := waitTask(ctx, tasker, actionJob); e != nil {
			return false, e
		}
		d, e := actionJob.GetDetail()
		if e != nil {
			return false, e
		}
		if d != nil {
			for _, n := range d.Nodes {
				nd, ne := n.GetDetail()
				if ne == nil && nd != nil && nd.Action != nil {
					return actionJob.Success() && nd.Action.Success, nil
				}
			}
		}
		return false, fmt.Errorf("未取得动作结果，设备状态需人工确认")
	})
}
func recognitionParam(req Request) maa.RecognitionParam {
	s := req.Step
	switch s.Recognition {
	case "OCR":
		expected := []string{s.Expected}
		if req.Mode == "extract" || req.Mode == "suggest" {
			expected = []string{}
		}
		return ocrParams{Values: map[string]any{"roi": s.ROI, "expected": expected, "threshold": s.Threshold}}
	case "TemplateMatch":
		return templateParams{Values: map[string]any{"roi": s.ROI, "template": []string{"recorder-template.png"}, "threshold": s.Threshold}}
	default:
		return maa.DirectHitParam{}
	}
}
func executeIfMatched(ctx context.Context, req Request, result *Result, click func() (bool, error)) error {
	if req.Mode != "execute" || !result.Hit || req.Step.Action == "DoNothing" {
		return nil
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	ok, err := click()
	result.ActionSuccess = &ok
	if err != nil {
		return err
	}
	if !ok {
		return fmt.Errorf("点击执行失败，请确认设备状态后重试")
	}
	return nil
}
func waitTask(ctx context.Context, tasker *maa.Tasker, job *maa.TaskJob) error {
	if job == nil {
		return fmt.Errorf("无法提交任务")
	}
	finished := make(chan struct{})
	go func() { job.Wait(); close(finished) }()
	select {
	case <-finished:
		return job.Error()
	case <-ctx.Done():
		if stop := tasker.PostStop(); stop != nil {
			stop.Wait()
		}
		<-finished
		return ctx.Err()
	}
}
func parseBoxes(reco *maa.RecognitionDetail, result *Result) {
	var data struct {
		All []struct {
			Box   [4]int  `json:"box"`
			Score float64 `json:"score"`
			Text  string  `json:"text"`
		} `json:"all"`
	}
	_ = json.Unmarshal([]byte(reco.DetailJson), &data)
	for _, b := range data.All {
		result.Boxes = append(result.Boxes, Box{b.Box[0], b.Box[1], b.Box[2], b.Box[3], b.Score, b.Text})
	}
	if reco.Hit {
		b := reco.Box
		result.Best = &Box{X: b[0], Y: b[1], Width: b[2], Height: b[3]}
		for _, candidate := range result.Boxes {
			if candidate.X == b[0] && candidate.Y == b[1] && candidate.Width == b[2] && candidate.Height == b[3] {
				copy := candidate
				result.Best = &copy
				break
			}
		}
	}
}
