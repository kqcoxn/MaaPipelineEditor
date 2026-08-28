package screenshot

import (
	"fmt"
	"image"

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

	img, err := s.mfwService.ControllerManager().CaptureImage(controllerID, force)
	if err != nil {
		return protocol.ArtifactRef{}, image.Rectangle{}, err
	}
	ref, err := s.artifacts.AddPNG(sessionID, "screenshot", img)
	if err != nil {
		return protocol.ArtifactRef{}, image.Rectangle{}, err
	}
	return ref, img.Bounds(), nil
}
