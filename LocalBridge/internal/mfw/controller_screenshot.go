package mfw

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"image"
	"image/png"
	"time"

	maa "github.com/MaaXYZ/maa-framework-go/v4"
)

type screenshotCaptureOutcome struct {
	image     image.Image
	failure   string
	err       error
	timestamp string
}

func (cm *ControllerManager) SetScreenshotResolution(controllerID string, resolution ScreenshotResolution) error {
	info, ctrl, err := cm.screenshotController(controllerID)
	if err != nil {
		return err
	}

	info.screenshotGate.acquireActiveOperation()
	defer info.screenshotGate.finishActiveOperation()
	return ApplyScreenshotResolution(ctrl, resolution)
}

func (cm *ControllerManager) Screencap(req *ScreencapRequest) (*ScreencapResult, error) {
	info, ctrl, err := cm.screenshotController(req.ControllerID)
	if err != nil {
		return nil, err
	}

	if req.Background {
		return cm.backgroundScreencap(info, ctrl, req)
	}
	return cm.activeScreencap(info, ctrl, req)
}

func (cm *ControllerManager) backgroundScreencap(
	info *ControllerInfo,
	ctrl *maa.Controller,
	req *ScreencapRequest,
) (*ScreencapResult, error) {
	flight, ok := info.screenshotGate.beginBackground()
	if !ok {
		return nil, ErrScreencapSkipped
	}

	outcome := executeScreencap(ctrl, req)
	info.LastActiveAt = time.Now()
	if claimed := info.screenshotGate.finishBackground(flight, outcome); claimed {
		return nil, ErrScreencapSkipped
	}
	return buildScreencapResult(req, outcome)
}

func (cm *ControllerManager) activeScreencap(
	info *ControllerInfo,
	ctrl *maa.Controller,
	req *ScreencapRequest,
) (*ScreencapResult, error) {
	mode, flight := info.screenshotGate.beginActive()
	switch mode {
	case screenshotAcquireRejected:
		return nil, ErrScreencapBusy
	case screenshotAcquireTakeover:
		<-flight.done
		defer info.screenshotGate.finishActive()
		return buildScreencapResult(req, flight.outcome)
	case screenshotAcquireOwned:
		outcome := executeScreencap(ctrl, req)
		info.LastActiveAt = time.Now()
		info.screenshotGate.finishActive()
		return buildScreencapResult(req, outcome)
	default:
		return nil, ErrScreencapBusy
	}
}

// CaptureImage serves active screenshot consumers that need the decoded image.
func (cm *ControllerManager) CaptureImage(controllerID string, force bool) (image.Image, error) {
	info, ctrl, err := cm.screenshotController(controllerID)
	if err != nil {
		return nil, err
	}

	mode, flight := info.screenshotGate.beginActive()
	switch mode {
	case screenshotAcquireRejected:
		return nil, ErrScreencapBusy
	case screenshotAcquireTakeover:
		<-flight.done
		defer info.screenshotGate.finishActive()
		return imageFromScreencapOutcome(flight.outcome)
	case screenshotAcquireOwned:
		outcome := cachedOrFreshScreenshot(ctrl, force)
		info.LastActiveAt = time.Now()
		info.screenshotGate.finishActive()
		return imageFromScreencapOutcome(outcome)
	default:
		return nil, ErrScreencapBusy
	}
}

func (cm *ControllerManager) screenshotController(controllerID string) (*ControllerInfo, *maa.Controller, error) {
	cm.mu.RLock()
	info, exists := cm.controllers[controllerID]
	cm.mu.RUnlock()

	if !exists {
		return nil, nil, ErrControllerNotFound
	}
	if !info.Connected {
		return nil, nil, ErrNotConnected
	}
	ctrl, ok := info.Controller.(*maa.Controller)
	if !ok || ctrl == nil {
		return nil, nil, ErrNotConnected
	}
	return info, ctrl, nil
}

func executeScreencap(ctrl *maa.Controller, req *ScreencapRequest) screenshotCaptureOutcome {
	if req.Resolution != nil {
		if err := ApplyScreenshotResolution(ctrl, *req.Resolution); err != nil {
			return screenshotCaptureOutcome{err: err, timestamp: time.Now().Format(time.RFC3339)}
		}
	}
	return captureControllerImage(ctrl, !req.UseCache)
}

func cachedOrFreshScreenshot(ctrl *maa.Controller, force bool) screenshotCaptureOutcome {
	if !force {
		if outcome := captureControllerImage(ctrl, false); outcome.image != nil {
			return outcome
		}
	}
	return captureControllerImage(ctrl, true)
}

func captureControllerImage(ctrl *maa.Controller, refresh bool) screenshotCaptureOutcome {
	if refresh {
		job := ctrl.PostScreencap()
		if job == nil {
			return screenshotCaptureOutcome{
				err:       NewMFWError(ErrCodeOperationFail, "failed to post screencap", nil),
				timestamp: time.Now().Format(time.RFC3339),
			}
		}
		job.Wait()
		if !job.Success() {
			return screenshotCaptureOutcome{
				failure:   "screencap job failed",
				timestamp: time.Now().Format(time.RFC3339),
			}
		}
	}

	img, err := ctrl.CacheImage()
	if err != nil || img == nil {
		return screenshotCaptureOutcome{
			failure:   "no image captured",
			timestamp: time.Now().Format(time.RFC3339),
		}
	}
	return screenshotCaptureOutcome{
		image:     img,
		timestamp: time.Now().Format(time.RFC3339),
	}
}

func buildScreencapResult(req *ScreencapRequest, outcome screenshotCaptureOutcome) (*ScreencapResult, error) {
	if outcome.err != nil {
		return nil, outcome.err
	}
	if outcome.failure != "" {
		return &ScreencapResult{
			ControllerID: req.ControllerID,
			Success:      false,
			Error:        outcome.failure,
			Timestamp:    outcome.timestamp,
		}, nil
	}

	img := resizeImageToLongSide(outcome.image, req.OutputLongSide)
	var buffer bytes.Buffer
	if err := png.Encode(&buffer, img); err != nil {
		return nil, NewMFWError(ErrCodeOperationFail, "failed to encode image", nil)
	}

	bounds := img.Bounds()
	return &ScreencapResult{
		ControllerID: req.ControllerID,
		Success:      true,
		ImageData:    "data:image/png;base64," + base64.StdEncoding.EncodeToString(buffer.Bytes()),
		Width:        bounds.Dx(),
		Height:       bounds.Dy(),
		Timestamp:    outcome.timestamp,
	}, nil
}

func imageFromScreencapOutcome(outcome screenshotCaptureOutcome) (image.Image, error) {
	if outcome.err != nil {
		return nil, outcome.err
	}
	switch outcome.failure {
	case "screencap job failed":
		return nil, fmt.Errorf("截图失败")
	case "no image captured":
		return nil, fmt.Errorf("读取截图缓存失败")
	case "":
		return outcome.image, nil
	default:
		return nil, fmt.Errorf("%s", outcome.failure)
	}
}
