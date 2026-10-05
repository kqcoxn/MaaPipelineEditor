package mfw

import (
	"errors"
	"os"
	"testing"
	"time"

	maa "github.com/MaaXYZ/maa-framework-go/v4"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
)

type delayedConnectController struct {
	maa.BlankController
	started chan struct{}
	finish  chan struct{}
}

func (c *delayedConnectController) Connect() bool {
	close(c.started)
	<-c.finish
	return true
}

// 验证 beta.19 拒绝释放被绑定对象时，管理器保留实例，解除绑定后可重试。
func TestNativeBoundObjectsRemainManaged(t *testing.T) {
	lib := os.Getenv("MPE_MFW_TEST_LIB_DIR")
	if lib == "" {
		t.Skip("requires MPE_MFW_TEST_LIB_DIR")
	}
	if err := logger.Init("ERROR", "", false); err != nil {
		t.Fatal(err)
	}
	if err := maa.Init(maa.WithLibDir(lib), maa.WithLogDir(t.TempDir()), maa.WithStdoutLevel(maa.LoggingLevelOff)); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := maa.Release(); err != nil {
			t.Errorf("release: %v", err)
		}
	})
	ctrl, err := maa.NewBlankController()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := ctrl.Destroy(); err != nil {
			t.Error(err)
		}
	})
	res, err := maa.NewResource()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := res.Destroy(); err != nil {
			t.Error(err)
		}
	})
	tasker, err := maa.NewTasker()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := tasker.Destroy(); err != nil {
			t.Error(err)
		}
	})
	if err := tasker.BindController(ctrl); err != nil {
		t.Fatal(err)
	}
	if err := tasker.BindResource(res); err != nil {
		t.Fatal(err)
	}
	cm, rm := NewControllerManager(), NewResourceManager()
	releases := 0
	cm.controllers["ctrl"] = &ControllerInfo{Controller: ctrl, releaseADB: func() { releases++ }}
	rm.resources["res"] = &ResourceInfo{Resource: res}
	if err := cm.DisconnectController("ctrl"); !errors.Is(err, maa.ErrBound) {
		t.Fatalf("disconnect bound controller: %v", err)
	}
	if err := rm.UnloadResource("res"); !errors.Is(err, maa.ErrBound) {
		t.Fatalf("unload bound resource: %v", err)
	}
	cm.DisconnectAll()
	rm.UnloadAll()
	if releases != 0 {
		t.Fatal("released ADB while native controller remained bound")
	}
	if _, err := cm.GetController("ctrl"); err != nil {
		t.Fatalf("lost bound controller: %v", err)
	}
	if _, err := rm.GetResource("res"); err != nil {
		t.Fatalf("lost bound resource: %v", err)
	}
	if err := tasker.Destroy(); err != nil {
		t.Fatal(err)
	}
	if err := cm.DisconnectController("ctrl"); err != nil {
		t.Fatal(err)
	}
	if releases != 1 {
		t.Fatalf("ADB released %d times after destruction", releases)
	}
	if err := rm.UnloadResource("res"); err != nil {
		t.Fatal(err)
	}
	if _, err := cm.GetController("ctrl"); !errors.Is(err, ErrControllerNotFound) {
		t.Fatalf("controller still managed: %v", err)
	}
	if _, err := rm.GetResource("res"); !errors.Is(err, ErrResourceNotFound) {
		t.Fatalf("resource still managed: %v", err)
	}
	t.Run("pending connection cleanup", func(t *testing.T) {
		probe := &delayedConnectController{started: make(chan struct{}), finish: make(chan struct{})}
		ctrl, err := maa.NewCustomController(probe)
		if err != nil {
			t.Fatal(err)
		}
		job := ctrl.PostConnect()
		select {
		case <-probe.started:
		case <-time.After(5 * time.Second):
			close(probe.finish)
			job.Wait()
			_ = ctrl.Destroy()
			t.Fatal("connect callback did not start")
		}
		done := make(chan error, 1)
		go func() { done <- destroyController(&ControllerInfo{Controller: ctrl}) }()
		select {
		case err := <-done:
			close(probe.finish)
			job.Wait()
			_ = ctrl.Destroy()
			t.Fatalf("cleanup returned before connect finished: %v", err)
		case <-time.After(60 * time.Millisecond):
		}
		close(probe.finish)
		select {
		case err := <-done:
			if err != nil {
				t.Fatal(err)
			}
		case <-time.After(5 * time.Second):
			t.Fatal("cleanup did not complete")
		}
	})
}
