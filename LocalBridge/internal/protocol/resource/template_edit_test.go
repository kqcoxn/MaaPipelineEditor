package resource

import (
	"bytes"
	"encoding/base64"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"testing"
)

func templatePNG(t *testing.T, width int) []byte {
	t.Helper()
	img := image.NewNRGBA(image.Rect(0, 0, width, 2))
	img.Set(0, 0, color.NRGBA{G: 255, A: 255})
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func TestReplaceTemplateImage(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "template.png")
	original, edited := templatePNG(t, 4), templatePNG(t, 2)
	encode := base64.StdEncoding.EncodeToString
	if err := os.WriteFile(path, original, 0600); err != nil {
		t.Fatal(err)
	}
	if err := replaceTemplateImage(root, path, encode(original), "data:image/png;base64,"+encode(edited)); err != nil {
		t.Fatal(err)
	}
	actual, err := os.ReadFile(path)
	if err != nil || !bytes.Equal(actual, edited) {
		t.Fatalf("saved bytes differ: %v", err)
	}
	// A second editor still using the original revision must not replace the saved edit.
	if err := replaceTemplateImage(root, path, encode(original), encode(original)); err == nil {
		t.Fatal("stale save accepted")
	}
	actual, _ = os.ReadFile(path)
	if !bytes.Equal(actual, edited) {
		t.Fatal("stale save changed the file")
	}
	files, _ := os.ReadDir(root)
	if len(files) != 1 {
		t.Fatal("temporary files left behind")
	}
}

func TestReplaceTemplateRejectsInvalidTargetsAndData(t *testing.T) {
	root := t.TempDir()
	original := templatePNG(t, 4)
	encoded := base64.StdEncoding.EncodeToString(original)
	for _, tc := range []struct{ name, path, data string }{
		{"outside workspace", filepath.Join(t.TempDir(), "outside.png"), encoded},
		{"wrong format", filepath.Join(root, "template.jpg"), encoded},
		{"corrupt image", filepath.Join(root, "template.png"), base64.StdEncoding.EncodeToString([]byte("invalid"))},
		{"truncated image", filepath.Join(root, "truncated.png"), base64.StdEncoding.EncodeToString(original[:len(original)-12])},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if err := os.WriteFile(tc.path, original, 0600); err != nil {
				t.Fatal(err)
			}
			if err := replaceTemplateImage(root, tc.path, encoded, tc.data); err == nil {
				t.Fatal("invalid save accepted")
			}
			actual, _ := os.ReadFile(tc.path)
			if !bytes.Equal(actual, original) {
				t.Fatal("rejected save changed original")
			}
		})
	}
}
