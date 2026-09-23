package utility

import (
	"image"
	"image/color"
	"image/draw"
	"os"
	"path/filepath"
	"testing"

	maa "github.com/MaaXYZ/maa-framework-go/v4"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/mfw"
	"golang.org/x/image/font"
	"golang.org/x/image/font/basicfont"
	"golang.org/x/image/math/fixed"
)

// 设置 MPE_TEST_MFW_LIB 和 MPE_TEST_OCR_MODEL 后运行真实框架的命中/未命中回归。
func TestOCRRuntimeVerification(t *testing.T) {
	lib, model := os.Getenv("MPE_TEST_MFW_LIB"), os.Getenv("MPE_TEST_OCR_MODEL")
	if lib == "" || model == "" {
		t.Skip("requires local MaaFramework and OCR model")
	}
	root := t.TempDir()
	if err := maa.Init(maa.WithLibDir(lib), maa.WithLogDir(root), maa.WithStdoutLevel(maa.LoggingLevelOff)); err != nil {
		t.Fatal(err)
	}
	defer maa.Release()
	modelDir := filepath.Join(root, "resource", "model", "ocr")
	if err := os.MkdirAll(modelDir, 0755); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"det.onnx", "rec.onnx", "keys.txt"} {
		data, err := os.ReadFile(filepath.Join(model, name))
		if err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(modelDir, name), data, 0644); err != nil {
			t.Fatal(err)
		}
	}
	small := image.NewRGBA(image.Rect(0, 0, 60, 22))
	draw.Draw(small, small.Bounds(), image.NewUniform(color.White), image.Point{}, draw.Src)
	d := font.Drawer{Dst: small, Src: image.NewUniform(color.Black), Face: basicfont.Face7x13, Dot: fixed.P(8, 16)}
	d.DrawString("HELLO")
	img := image.NewRGBA(image.Rect(0, 0, 240, 88))
	for y := 0; y < 88; y++ {
		for x := 0; x < 240; x++ {
			img.Set(x, y, small.At(x/4, y/4))
		}
	}
	ctrl, err := mfw.NewFixedImageController(img)
	if err != nil {
		t.Fatal(err)
	}
	defer ctrl.Destroy()
	ctrl.PostConnect().Wait()
	res, err := maa.NewResource()
	if err != nil {
		t.Fatal(err)
	}
	defer res.Destroy()
	loadJob := res.PostBundle(filepath.Join(root, "resource"))
	loadJob.Wait()
	if !loadJob.Success() {
		t.Fatal("resource load failed")
	}
	tasker, err := maa.NewTasker()
	if err != nil {
		t.Fatal(err)
	}
	defer tasker.Destroy()
	if err := tasker.BindController(ctrl); err != nil {
		t.Fatal(err)
	}
	if err := tasker.BindResource(res); err != nil {
		t.Fatal(err)
	}
	for _, expected := range []string{".*", "^NEVER_MATCH_THIS_TEXT$"} {
		job := tasker.PostRecognition(maa.RecognitionTypeOCR, ocrRecognitionParams{values: map[string]interface{}{
			"roi": [4]int32{0, 0, 0, 0}, "expected": expected, "only_rec": true, "threshold": 0,
		}}, img)
		job.Wait()
		detail, err := job.GetDetail()
		if err != nil {
			t.Fatal(err)
		}
		result, err := (&UtilityHandler{}).parseOCRResult(detail, img, [4]int32{})
		if err != nil {
			t.Fatal(err)
		}
		if result["success"] != true || result["hit"] != (expected == ".*") || result["no_content"] != false {
			t.Fatalf("unexpected verification result: %#v", result)
		}
	}
}
