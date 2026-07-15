package mfw

import (
	"image"
	"image/draw"
	"math"

	xdraw "golang.org/x/image/draw"
)

func resizeImageToLongSide(source image.Image, targetLongSide int32) image.Image {
	if source == nil || targetLongSide <= 0 {
		return source
	}

	bounds := source.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()
	longSide := max(width, height)
	if longSide <= int(targetLongSide) {
		return source
	}

	scale := float64(targetLongSide) / float64(longSide)
	targetWidth := max(1, int(math.Round(float64(width)*scale)))
	targetHeight := max(1, int(math.Round(float64(height)*scale)))
	destination := image.NewRGBA(image.Rect(0, 0, targetWidth, targetHeight))
	xdraw.CatmullRom.Scale(
		destination,
		destination.Bounds(),
		source,
		bounds,
		draw.Src,
		nil,
	)
	return destination
}
