package artifact

import (
	"bytes"
	"encoding/base64"
	"image"
	"image/color"
	"image/png"
	"testing"
)

func TestAddPNGRejectsNilImages(t *testing.T) {
	for _, tc := range []struct {
		name string
		img  image.Image
	}{
		{"nil interface", nil},
		{"nil RGBA", (*image.RGBA)(nil)},
		{"nil NRGBA", (*image.NRGBA)(nil)},
	} {
		t.Run(tc.name, func(t *testing.T) {
			store := NewStore()
			ref, err := store.AddPNG("session", "recognition-raw-image", tc.img)
			if err == nil || ref.ID != "" {
				t.Fatalf("expected an error and no artifact, got ref=%+v err=%v", ref, err)
			}
			if len(store.ListRefs("session")) != 0 {
				t.Fatal("invalid image was stored")
			}
		})
	}
}

func TestAddPNGRoundTrip(t *testing.T) {
	store := NewStore()
	img := image.NewRGBA(image.Rect(0, 0, 2, 1))
	want := color.RGBA{R: 20, G: 80, B: 160, A: 255}
	img.SetRGBA(1, 0, want)
	ref, err := store.AddPNG("session", "recognition-raw-image", img)
	if err != nil {
		t.Fatal(err)
	}
	payload, err := store.Get("session", ref.ID)
	if err != nil {
		t.Fatal(err)
	}
	content, err := base64.StdEncoding.DecodeString(payload.Content)
	if err != nil {
		t.Fatal(err)
	}
	decoded, err := png.Decode(bytes.NewReader(content))
	if err != nil {
		t.Fatal(err)
	}
	if decoded.Bounds() != img.Bounds() || color.RGBAModel.Convert(decoded.At(1, 0)) != want {
		t.Fatal("stored PNG dimensions or pixels changed")
	}
}
