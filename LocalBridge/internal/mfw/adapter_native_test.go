package mfw

import (
	"image"
	"os"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"

	maa "github.com/MaaXYZ/maa-framework-go/v4"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
)

type autoUpProbeController struct {
	maa.BlankController
	keys, touches, captures atomic.Int32
	pressed                 chan struct{}
}

func (c *autoUpProbeController) KeyDown(int32) bool {
	c.pressed <- struct{}{}
	return true
}
func (c *autoUpProbeController) KeyUp(int32) bool   { c.keys.Add(1); return true }
func (c *autoUpProbeController) TouchUp(int32) bool { c.touches.Add(1); return true }
func (c *autoUpProbeController) Screencap() (image.Image, bool) {
	c.captures.Add(1)
	return c.BlankController.Screencap()
}

// Opt-in native smoke test: no real device or user input is touched.
// MPE_MFW_TEST_LIB_DIR must point to the installed MaaFramework bin directory.
func TestNativeDirectHitAutoUp(t *testing.T) {
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
	t.Cleanup(func() { _ = maa.Release() })
	t.Logf("loaded %s from %s", maa.Version(), lib)
	probe := &autoUpProbeController{pressed: make(chan struct{}, 10)}
	controller, err := maa.NewCustomController(probe)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(controller.Destroy)
	if !controller.PostConnect().Wait().Success() {
		t.Fatal("connect failed")
	}
	resource, err := maa.NewResource()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(resource.Destroy)
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "pipeline"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "pipeline", "main.json"), []byte(`{"Seed":{}}`), 0644); err != nil {
		t.Fatal(err)
	}
	if !resource.PostBundle(root).Wait().Success() {
		t.Fatal("bundle failed")
	}
	adapter := NewMaaFWAdapter()
	adapter.SetController(controller, "Custom", "test")
	adapter.SetBorrowedResource(resource)
	t.Cleanup(adapter.Destroy)
	if err := adapter.InitTasker(); err != nil {
		t.Fatal(err)
	}
	if probe.captures.Load() != 1 {
		t.Fatal("task initialization must prepare one screenshot")
	}
	pipeline := `{"Key":{"recognition":"DirectHit","action":{"type":"KeyDown","param":{"key":65,"auto_up":true}},"post_delay":0,"next":["Touch"]},"Touch":{"recognition":"DirectHit","action":{"type":"TouchDown","param":{"target":[10,20],"auto_up":true}},"post_delay":0}}`
	job, err := adapter.RunTask("Key", pipeline)
	if err != nil || !job.Success() {
		t.Fatalf("task failed: %v", err)
	}
	if probe.keys.Load() != 1 || probe.touches.Load() != 1 {
		t.Fatal("task completion did not release held input")
	}
	if probe.captures.Load() != 1 {
		t.Fatal("DirectHit nodes should reuse initial image bounds without additional screenshots")
	}
	<-probe.pressed
	job, err = adapter.PostTask("StopKey", `{"StopKey":{"recognition":"DirectHit","action":{"type":"KeyDown","param":{"key":66,"auto_up":true}},"post_delay":10000}}`)
	if err != nil {
		t.Fatal(err)
	}
	select {
	case <-probe.pressed:
	case <-time.After(5 * time.Second):
		t.Fatal("key down timed out")
	}
	if err := adapter.PostStop(); err != nil {
		t.Fatal(err)
	}
	job.Wait()
	if probe.keys.Load() != 2 {
		t.Fatal("stopping task did not release held key")
	}
	if err := resource.OverridePipeline(pipeline); err != nil {
		t.Fatal(err)
	}
	node, err := resource.GetNode("Key")
	if err != nil {
		t.Fatal(err)
	}
	if !node.Action.Param.(*maa.KeyDownParam).AutoUp {
		t.Fatal("binding lost auto_up during node readback")
	}
}
