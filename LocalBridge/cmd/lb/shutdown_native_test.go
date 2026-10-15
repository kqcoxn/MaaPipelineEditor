package main

import (
	"image"
	"os"
	"testing"
	"time"

	maa "github.com/MaaXYZ/maa-framework-go/v4"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/mfw"
)

type blockedExitController struct {
	maa.BlankController
	started chan struct{}
}

func (c *blockedExitController) Screencap() (image.Image, bool) {
	close(c.started)
	select {} // The native controller thread stays inside this callback.
}

// Run only inside the disposable helper process: this exercises the real DLL
// and Go binding with an in-flight screenshot, without connecting any device.
func blockedNativeShutdown(t *testing.T, dir string) func() error {
	t.Helper()
	if err := maa.Init(maa.WithLibDir(os.Getenv("MPE_MFW_TEST_LIB_DIR")), maa.WithLogDir(dir), maa.WithStdoutLevel(maa.LoggingLevelOff)); err != nil {
		t.Fatal(err)
	}
	probe := &blockedExitController{started: make(chan struct{})}
	ctrl, err := maa.NewCustomController(probe)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ctrl.PostScreencap(); err != nil {
		t.Fatal(err)
	}
	select {
	case <-probe.started:
	case <-time.After(2 * time.Second):
		t.Fatal("native screenshot did not start")
	}
	return func() error {
		if err := mfw.DestroyController(ctrl); err != nil {
			return err
		}
		return maa.Release()
	}
}
