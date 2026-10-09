package recorder

import (
	"context"
	"fmt"
	"path/filepath"
	"sync"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/mfw"
	resource "github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/service/resource"
)

type Service struct {
	mfw          *mfw.Service
	resources    *resource.Service
	suggestionMu sync.Mutex
}

func NewService(m *mfw.Service, r *resource.Service) *Service { return &Service{mfw: m, resources: r} }
func (s *Service) bundle(path string) (string, error) {
	for _, b := range s.resources.GetBundleList().Bundles {
		if filepath.Clean(b.AbsPath) == filepath.Clean(path) {
			return b.AbsPath, nil
		}
	}
	return "", fmt.Errorf("请选择当前项目中的资源包")
}
func (s *Service) Save(ctx context.Context, req SaveRequest) SaveResult {
	result := SaveResult{RequestID: req.RequestID}
	bundle, err := s.bundle(req.ResourcePath)
	if err == nil {
		var release func()
		release, err = s.mfw.AcquireProjectEdit()
		if err == nil {
			defer release()
			result.Paths, err = saveAssets(ctx, bundle, req)
		}
	}
	result.Success = err == nil
	if err != nil {
		result.Error = err.Error()
	}
	return result
}
func (s *Service) Run(ctx context.Context, req Request) Result {
	result := Result{RequestID: req.RequestID, Boxes: []Box{}}
	err := req.Validate()
	if err != nil {
		result.Error = err.Error()
		return result
	}
	if req.ResourcePath != "" {
		if _, err = s.bundle(req.ResourcePath); err != nil {
			result.Error = err.Error()
			return result
		}
	}
	// Suggestions own a fixed-image controller/resource and never touch a device
	// or user bundle. Do not take the device execution lease while doing OCR.
	if req.Mode == "suggest" {
		if !s.suggestionMu.TryLock() {
			result.Error = "文字候选分析忙"
			return result
		}
		defer s.suggestionMu.Unlock()
		err = s.runNative(ctx, req, &result)
		result.Success = err == nil
		if err != nil {
			result.Error = err.Error()
		}
		return result
	}
	controllerID := ""
	if req.Mode == "execute" {
		controllerID = req.ControllerID
	}
	release, err := s.mfw.AcquireExecution("MPE Recorder", controllerID)
	if err != nil {
		result.Error = err.Error()
		return result
	}
	defer release()
	err = s.runNative(ctx, req, &result)
	result.Success = err == nil
	if err != nil {
		result.Error = err.Error()
	}
	return result
}
