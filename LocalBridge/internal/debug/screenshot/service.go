package screenshot

import (
	"fmt"
	"image"

	maa "github.com/MaaXYZ/maa-framework-go/v4"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/artifact"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/debug/protocol"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/mfw"
)

type Service struct {
	mfwService *mfw.Service
	artifacts  *artifact.Store
}

func NewService(mfwService *mfw.Service, artifacts *artifact.Store) *Service {
	return &Service{
		mfwService: mfwService,
		artifacts:  artifacts,
	}
}

func (s *Service) Capture(sessionID string, controllerID string, force bool) (protocol.ArtifactRef, image.Rectangle, error) {
	if s.mfwService == nil {
		return protocol.ArtifactRef{}, image.Rectangle{}, fmt.Errorf("MaaFramework service 不可用")
	}
	if s.artifacts == nil {
		return protocol.ArtifactRef{}, image.Rectangle{}, fmt.Errorf("artifact store 不可用")
	}
	if controllerID == "" {
		return protocol.ArtifactRef{}, image.Rectangle{}, fmt.Errorf("缺少 controllerId")
	}

	info, err := s.mfwService.ControllerManager().GetController(controllerID)
	if err != nil {
		return protocol.ArtifactRef{}, image.Rectangle{}, err
	}
	if info == nil || !info.Connected {
		return protocol.ArtifactRef{}, image.Rectangle{}, fmt.Errorf("controller 未连接: %s", controllerID)
	}
	ctrl, ok := info.Controller.(*maa.Controller)
	if !ok || ctrl == nil {
		return protocol.ArtifactRef{}, image.Rectangle{}, fmt.Errorf("controller 实例不可用: %s", controllerID)
	}

	img, err := cachedOrFreshImage(ctrl, force)
	if err != nil {
		return protocol.ArtifactRef{}, image.Rectangle{}, err
	}
	ref, err := s.artifacts.AddPNG(sessionID, "screenshot", img)
	if err != nil {
		return protocol.ArtifactRef{}, image.Rectangle{}, err
	}
	return ref, img.Bounds(), nil
}

func cachedOrFreshImage(ctrl *maa.Controller, force bool) (image.Image, error) {
	if !force {
		if img, err := ctrl.CacheImage(); err == nil && img != nil {
			return img, nil
		}
	}
	job := ctrl.PostScreencap()
	if job == nil {
		return nil, fmt.Errorf("发起截图失败")
	}
	job.Wait()
	if !job.Success() {
		return nil, fmt.Errorf("截图失败: %v", job.Status())
	}
	img, err := ctrl.CacheImage()
	if err != nil || img == nil {
		return nil, fmt.Errorf("读取截图缓存失败")
	}
	return img, nil
}
