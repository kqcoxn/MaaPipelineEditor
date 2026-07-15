package mfw

import (
	"bytes"
	"encoding/base64"
	"image/png"
	"time"

	maa "github.com/MaaXYZ/maa-framework-go/v4"
)

func (cm *ControllerManager) SetScreenshotResolution(controllerID string, resolution ScreenshotResolution) error {
	cm.mu.RLock()
	info, exists := cm.controllers[controllerID]
	cm.mu.RUnlock()

	if !exists {
		return ErrControllerNotFound
	}
	if !info.Connected {
		return ErrNotConnected
	}
	ctrl, ok := info.Controller.(*maa.Controller)
	if !ok || ctrl == nil {
		return ErrNotConnected
	}

	info.screenshotMu.Lock()
	defer info.screenshotMu.Unlock()
	return ApplyScreenshotResolution(ctrl, resolution)
}

func (cm *ControllerManager) Screencap(req *ScreencapRequest) (*ScreencapResult, error) {
	cm.mu.RLock()
	info, exists := cm.controllers[req.ControllerID]
	cm.mu.RUnlock()

	if !exists {
		return nil, ErrControllerNotFound
	}
	if !info.Connected {
		return nil, ErrNotConnected
	}
	ctrl, ok := info.Controller.(*maa.Controller)
	if !ok || ctrl == nil {
		return nil, ErrNotConnected
	}

	info.screenshotMu.Lock()
	defer info.screenshotMu.Unlock()
	if req.Resolution != nil {
		if err := ApplyScreenshotResolution(ctrl, *req.Resolution); err != nil {
			return nil, err
		}
	}

	if !req.UseCache {
		job := ctrl.PostScreencap()
		if job == nil {
			return nil, NewMFWError(ErrCodeOperationFail, "failed to post screencap", nil)
		}
		job.Wait()
		if !job.Success() {
			return &ScreencapResult{
				ControllerID: req.ControllerID,
				Success:      false,
				Error:        "screencap job failed",
				Timestamp:    time.Now().Format(time.RFC3339),
			}, nil
		}
	}

	img, imgErr := ctrl.CacheImage()
	info.LastActiveAt = time.Now()
	if imgErr != nil || img == nil {
		return &ScreencapResult{
			ControllerID: req.ControllerID,
			Success:      false,
			Error:        "no image captured",
			Timestamp:    time.Now().Format(time.RFC3339),
		}, nil
	}
	img = resizeImageToLongSide(img, req.OutputLongSide)

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
		Timestamp:    time.Now().Format(time.RFC3339),
	}, nil
}
