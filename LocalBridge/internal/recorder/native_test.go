package recorder

import (
	"context"
	"image"
	"image/color"
	"os"
	"sync/atomic"
	"testing"

	maa "github.com/MaaXYZ/maa-framework-go/v4"
)

type clickProbe struct {
	maa.BlankController
	clicks   atomic.Int32
	captures atomic.Int32
	success  bool
}

func (p *clickProbe) Click(x, y int32) bool { p.clicks.Add(1); return p.success }

func (p *clickProbe) Screencap() (image.Image, bool) {
	p.captures.Add(1)
	return p.BlankController.Screencap()
}

// Uses a custom in-memory controller: never sends input to a physical device.
func TestNativeRecorderRecognitionAndClick(t *testing.T) {
	lib := os.Getenv("MPE_MFW_TEST_LIB_DIR")
	if lib == "" {
		t.Skip("requires MPE_MFW_TEST_LIB_DIR")
	}
	if err := maa.Init(maa.WithLibDir(lib), maa.WithLogDir(t.TempDir()), maa.WithStdoutLevel(maa.LoggingLevelOff)); err != nil {
		t.Fatal(err)
	}
	defer maa.Release()
	probe := &clickProbe{success: false}
	ctrl, err := maa.NewCustomController(probe)
	if err != nil {
		t.Fatal(err)
	}
	defer ctrl.Destroy()
	if !ctrl.PostConnect().Wait().Success() {
		t.Fatal("connect")
	}
	img := image.NewRGBA(image.Rect(0, 0, 64, 64))
	for y := 0; y < 64; y++ {
		for x := 0; x < 64; x++ {
			img.Set(x, y, color.RGBA{uint8(x * 3), uint8(y * 3), uint8(x * y), 255})
		}
	}
	target := [4]int{10, 20, 1, 1}
	req := Request{Mode: "execute", Step: Step{Recognition: "DirectHit", Action: "Click", Target: &target}}
	result := Result{}
	err = runOnImage(context.Background(), req, img, ctrl, &result)
	if err == nil || !result.Hit || result.ActionSuccess == nil || *result.ActionSuccess || probe.clicks.Load() != 1 {
		t.Fatalf("failed action: %+v %v clicks=%d", result, err, probe.clicks.Load())
	}
	probe.success = true
	result = Result{}
	if err = runOnImage(context.Background(), req, img, ctrl, &result); err != nil || !*result.ActionSuccess || probe.clicks.Load() != 2 {
		t.Fatalf("successful click: %+v %v", result, err)
	}
	// Identical non-uniform template must match on the supplied fixed image.
	template, _ := encodeImage(img.SubImage(image.Rect(10, 10, 25, 25)))
	req.Mode = "preview"
	req.Step = Step{Recognition: "TemplateMatch", Action: "Click", Template: template, Threshold: 0.9}
	result = Result{}
	if err = runOnImage(context.Background(), req, img, nil, &result); err != nil || !result.Hit || result.Best == nil || probe.clicks.Load() != 2 {
		t.Fatalf("template preview: %+v %v", result, err)
	}
	// A different full-image template must not click during execute.
	different := image.NewRGBA(image.Rect(0, 0, 64, 64))
	for y := 0; y < 64; y++ {
		for x := 0; x < 64; x++ {
			different.Set(x, y, color.RGBA{uint8(255 - x*3), uint8(255 - y*3), uint8(255 - x*y), 255})
		}
	}
	req.Mode = "execute"
	req.Step.Template, _ = encodeImage(different)
	req.Step.Threshold = 0.999
	result = Result{}
	if err = runOnImage(context.Background(), req, img, ctrl, &result); err != nil || result.Hit || probe.clicks.Load() != 2 {
		t.Fatalf("unmatched recognition clicked: %+v %v", result, err)
	}

	// Live input uses the displayed/cached frame, without taking another screenshot.
	if !ctrl.PostScreencap().Wait().Success() {
		t.Fatal("screenshot")
	}
	cached, e := ctrl.CacheImage()
	if e != nil {
		t.Fatal(e)
	}
	request := ClickRequest{X: 10, Y: 20, Width: cached.Bounds().Dx(), Height: cached.Bounds().Dy()}
	beforeCaptures := probe.captures.Load()
	beforeClicks := probe.clicks.Load()
	if e = clickOnController(context.Background(), ctrl, request); e != nil {
		t.Fatal(e)
	}
	if probe.captures.Load() != beforeCaptures || probe.clicks.Load() != beforeClicks+1 {
		t.Fatal("live click took screenshot or failed to send input")
	}
	request.Width++
	if e = clickOnController(context.Background(), ctrl, request); e == nil || probe.clicks.Load() != beforeClicks+1 {
		t.Fatal("changed coordinate space allowed click")
	}

}
