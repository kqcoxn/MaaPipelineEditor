package recorder

import (
	"context"
	"fmt"

	maa "github.com/MaaXYZ/maa-framework-go/v4"
)

type ClickRequest struct {
	RequestID    string `json:"request_id"`
	ControllerID string `json:"controller_id"`
	X            int    `json:"x"`
	Y            int    `json:"y"`
	Width        int    `json:"width"`
	Height       int    `json:"height"`
}

func validateClick(req ClickRequest, width, height int) error {
	if req.Width <= 0 || req.Height <= 0 || req.Width != width || req.Height != height {
		return fmt.Errorf("设备画面尺寸已变化，请刷新画面后重新点击")
	}
	if req.X < 0 || req.Y < 0 || req.X >= width || req.Y >= height {
		return fmt.Errorf("点击位置超出画面范围")
	}
	return nil
}

// Click sends user input immediately, without recognition or a new screenshot.
// The shown frame and the cached controller image must use the same coordinate space.
func (s *Service) Click(ctx context.Context, req ClickRequest) Result {
	result := Result{RequestID: req.RequestID, Boxes: []Box{}}
	release, err := s.mfw.AcquireExecution("MPE Recorder", req.ControllerID)
	if err != nil {
		result.Error = err.Error()
		return result
	}
	defer release()
	info, err := s.mfw.ControllerManager().GetController(req.ControllerID)
	if err != nil {
		result.Error = err.Error()
		return result
	}
	ctrl, ok := info.Controller.(*maa.Controller)
	if !ok || ctrl == nil {
		result.Error = "控制器不可用"
		return result
	}
	err = clickOnController(ctx, ctrl, req)
	success := err == nil
	result.Success = success
	result.ActionSuccess = &success
	if err != nil {
		result.Error = err.Error()
	}
	return result
}
func clickOnController(ctx context.Context, ctrl *maa.Controller, req ClickRequest) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	img, err := ctrl.CacheImage()
	if err != nil {
		return err
	}
	if img == nil {
		return fmt.Errorf("请先获取设备画面")
	}
	if err = validateClick(req, img.Bounds().Dx(), img.Bounds().Dy()); err != nil {
		return err
	}
	if err = ctx.Err(); err != nil {
		return err
	}
	job := ctrl.PostClick(int32(req.X), int32(req.Y))
	if job == nil {
		return fmt.Errorf("点击提交失败")
	}
	job.Wait()
	if !job.Success() {
		return fmt.Errorf("点击失败，请检查设备状态")
	}
	return nil
}
