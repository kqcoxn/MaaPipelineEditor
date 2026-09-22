package mfw

import (
	"fmt"
	"sync"
)

// AcquireExecution arbitrates native execution, independent of the GUI/debug UI.
// The reserved controller cannot be destroyed until the owner releases it.
func (s *Service) AcquireExecution(owner, controllerID string) (func(), error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.initialized {
		return nil, ErrNotInitialized
	}
	if s.executionOwner != "" {
		return nil, fmt.Errorf("%s 正在使用运行环境，请先停止当前运行", s.executionOwner)
	}
	if s.controllerSetups > 0 {
		return nil, fmt.Errorf("设备正在连接，请等待连接完成")
	}
	cm := s.controllerManager
	cm.mu.Lock()
	if controllerID != "" {
		if cm.controllers[controllerID] == nil {
			cm.mu.Unlock()
			return nil, ErrControllerNotFound
		}
		if cm.reserved == nil {
			cm.reserved = map[string]bool{}
		}
		cm.reserved[controllerID] = true
	}
	cm.mu.Unlock()
	s.executionOwner = owner
	var once sync.Once
	return func() {
		once.Do(func() {
			s.mu.Lock()
			defer s.mu.Unlock()
			cm.mu.Lock()
			delete(cm.reserved, controllerID)
			cm.mu.Unlock()
			s.executionOwner = ""
		})
	}, nil
}

// AcquireControllerSetup keeps controller creation outside project preparation/runs.
func (s *Service) AcquireControllerSetup() (func(), error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.executionOwner != "" {
		return nil, fmt.Errorf("%s 正在使用运行环境，请先停止", s.executionOwner)
	}
	s.controllerSetups++
	var once sync.Once
	return func() { once.Do(func() { s.mu.Lock(); s.controllerSetups--; s.mu.Unlock() }) }, nil
}

// AcquireProjectEdit excludes execution without requiring native libraries to be initialized.
func (s *Service) AcquireProjectEdit() (func(), error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.executionOwner != "" || s.controllerSetups > 0 {
		return nil, fmt.Errorf("运行、准备或设备连接尚未结束，请稍后保存 PI")
	}
	s.executionOwner = "PI 文件保存"
	var once sync.Once
	return func() { once.Do(func() { s.mu.Lock(); s.executionOwner = ""; s.mu.Unlock() }) }, nil
}
