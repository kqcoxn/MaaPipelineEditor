package recorder

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"image"
	_ "image/jpeg"
	"image/png"
	"strings"
)

func decodeImage(value string) (image.Image, error) {
	if len(value) > 48*1024*1024 {
		return nil, fmt.Errorf("图片过大")
	}
	if strings.HasPrefix(value, "data:") {
		_, value, _ = strings.Cut(value, ",")
	}
	raw, err := base64.StdEncoding.DecodeString(value)
	if err != nil {
		return nil, fmt.Errorf("图片编码无效: %w", err)
	}
	cfg, _, err := image.DecodeConfig(bytes.NewReader(raw))
	if err != nil {
		return nil, err
	}
	if cfg.Width <= 0 || cfg.Height <= 0 || int64(cfg.Width)*int64(cfg.Height) > 32*1024*1024 {
		return nil, fmt.Errorf("图片尺寸过大")
	}
	img, _, err := image.Decode(bytes.NewReader(raw))
	return img, err
}
func encodeImage(img image.Image) (string, error) {
	var b bytes.Buffer
	if err := png.Encode(&b, img); err != nil {
		return "", err
	}
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(b.Bytes()), nil
}
