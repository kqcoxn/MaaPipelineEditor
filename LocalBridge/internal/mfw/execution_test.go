package mfw

import "testing"

func TestExecutionOwnershipProtectsControllerAndReload(t *testing.T) {
	s := NewService()
	s.initialized = true
	s.controllerManager.controllers["device"] = &ControllerInfo{ControllerID: "device"}
	release, err := s.AcquireExecution("Interface", "device")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = s.AcquireExecution("debug", "device"); err == nil {
		t.Fatal("concurrent owner allowed")
	}
	if err = s.controllerManager.DisconnectController("device"); err == nil {
		t.Fatal("active controller destroyed")
	}
	if err = s.Shutdown(); err == nil {
		t.Fatal("active framework released")
	}
	if _, err = s.AcquireControllerSetup(); err == nil {
		t.Fatal("device creation during execution")
	}
	release()
	release()
	second, err := s.AcquireExecution("debug", "device")
	if err != nil {
		t.Fatal(err)
	}
	second()
}
func TestPreparationCannotOverlapDeviceConnection(t *testing.T) {
	s := NewService()
	s.initialized = true
	finish, err := s.AcquireControllerSetup()
	if err != nil {
		t.Fatal(err)
	}
	if _, err = s.AcquireExecution("prepare", ""); err == nil {
		t.Fatal("preparation overlaps controller creation")
	}
	finish()
	release, err := s.AcquireExecution("prepare", "")
	if err != nil {
		t.Fatal(err)
	}
	release()
}

func TestProjectEditWorksWithoutNativeRuntimeAndExcludesExecution(t *testing.T) {
	s := NewService()
	release, err := s.AcquireProjectEdit()
	if err != nil {
		t.Fatal(err)
	}
	s.initialized = true
	if _, err = s.AcquireExecution("Interface", ""); err == nil {
		t.Fatal("execution overlaps PI save")
	}
	if _, err = s.AcquireControllerSetup(); err == nil {
		t.Fatal("preparation/connection overlaps PI save")
	}
	release()
	run, err := s.AcquireExecution("Interface", "")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = s.AcquireProjectEdit(); err == nil {
		t.Fatal("PI save overlaps execution")
	}
	run()
}
