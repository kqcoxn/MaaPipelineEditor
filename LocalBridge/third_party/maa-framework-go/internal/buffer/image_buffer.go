package buffer

import (
	"image"
	"image/draw"
	"unsafe"

	"github.com/MaaXYZ/maa-framework-go/v4/internal/native"
)

type ImageBuffer struct {
	handle uintptr
}

const (
	cvType8UC3   int32 = 16
	bytesPerBGR        = 3
	bytesPerRGBA       = 4
	opaqueAlpha  byte  = 0xff
)

func NewImageBuffer() *ImageBuffer {
	handle := native.MaaImageBufferCreate()
	if handle == 0 {
		return nil
	}
	return &ImageBuffer{
		handle: handle,
	}
}

func NewImageBufferByHandle(handle uintptr) *ImageBuffer {
	return &ImageBuffer{
		handle: handle,
	}
}

func (i *ImageBuffer) Destroy() {
	native.MaaImageBufferDestroy(i.handle)
}

func (i *ImageBuffer) Handle() uintptr {
	return i.handle
}

func (i *ImageBuffer) IsEmpty() bool {
	return native.MaaImageBufferIsEmpty(i.handle)
}

func (i *ImageBuffer) Clear() bool {
	return native.MaaImageBufferClear(i.handle)
}

// Get retrieves the image from raw data stored in the buffer.
func (i *ImageBuffer) Get() image.Image {
	return i.GetInto(nil)
}

// GetInto retrieves the image from raw data stored in the buffer and writes into dst when possible.
// If dst is nil or size mismatched, a new *image.RGBA is allocated and returned.
func (i *ImageBuffer) GetInto(dst *image.RGBA) *image.RGBA {
	rawData := i.getRawData()
	if rawData == nil {
		return nil
	}
	width := int(i.getWidth())
	height := int(i.getHeight())

	dst = ensureRGBA(dst, width, height)
	raw := unsafe.Slice((*byte)(rawData), width*height*bytesPerBGR)
	decodeBGRToRGBA(raw, dst, width, height)
	return dst
}

func ensureRGBA(dst *image.RGBA, width, height int) *image.RGBA {
	if dst == nil || dst.Rect.Dx() != width || dst.Rect.Dy() != height {
		return image.NewRGBA(image.Rect(0, 0, width, height))
	}
	return dst
}

func decodeBGRToRGBA(src []byte, dst *image.RGBA, width, height int) {
	srcRowBytes := width * bytesPerBGR
	dstRowBytes := width * bytesPerRGBA

	if dst.Stride == dstRowBytes {
		decodeBGRRowToRGBA(dst.Pix[:dstRowBytes*height], src)
		return
	}

	for y := 0; y < height; y++ {
		srcStart := y * srcRowBytes
		dstStart := y * dst.Stride
		decodeBGRRowToRGBA(dst.Pix[dstStart:dstStart+dstRowBytes], src[srcStart:srcStart+srcRowBytes])
	}
}

func decodeBGRRowToRGBA(dst, src []byte) {
	for srcIdx, dstIdx := 0, 0; srcIdx < len(src); srcIdx, dstIdx = srcIdx+bytesPerBGR, dstIdx+bytesPerRGBA {
		// Native buffer stores pixels as BGR, convert to RGBA (alpha fixed to 255).
		dst[dstIdx] = src[srcIdx+2]
		dst[dstIdx+1] = src[srcIdx+1]
		dst[dstIdx+2] = src[srcIdx]
		dst[dstIdx+3] = opaqueAlpha
	}
}

// Set converts an image.Image to raw data and sets it in the buffer.
func (i *ImageBuffer) Set(img image.Image) bool {
	bounds := img.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()

	if width == 0 || height == 0 {
		return i.Clear()
	}

	rawData := make([]byte, width*height*bytesPerBGR)
	encodeImageToBGR(img, bounds, width, height, rawData)
	return i.setRawData(unsafe.Pointer(&rawData[0]), int32(width), int32(height), cvType8UC3)
}

func encodeImageToBGR(img image.Image, bounds image.Rectangle, width, height int, dst []byte) {
	switch sourceImg := img.(type) {
	case *image.NRGBA:
		encodeNRGBAToBGR(sourceImg, dst, width, height)
	case *image.RGBA:
		encodeRGBAToBGR(sourceImg, dst, width, height)
	default:
		nrgbaImg := image.NewNRGBA(image.Rect(0, 0, width, height))
		draw.Draw(nrgbaImg, nrgbaImg.Bounds(), img, bounds.Min, draw.Src)
		encodeNRGBAToBGR(nrgbaImg, dst, width, height)
	}
}

func encodeNRGBAToBGR(src *image.NRGBA, dst []byte, width, height int) {
	encodeRGBABytesToBGR(src.Pix, src.Stride, dst, width, height)
}

func encodeRGBABytesToBGR(srcPix []byte, srcStride int, dst []byte, width, height int) {
	if width == 0 || height == 0 {
		return
	}

	srcRowBytes := width * bytesPerRGBA
	dstRowBytes := width * bytesPerBGR

	if srcStride == srcRowBytes {
		encodeRGBARowToBGR(srcPix[:srcRowBytes*height], dst)
		return
	}

	for y := 0; y < height; y++ {
		srcStart := y * srcStride
		dstStart := y * dstRowBytes
		encodeRGBARowToBGR(srcPix[srcStart:srcStart+srcRowBytes], dst[dstStart:dstStart+dstRowBytes])
	}
}

func encodeRGBARowToBGR(src, dst []byte) {
	for srcIdx, dstIdx := 0, 0; dstIdx < len(dst); srcIdx, dstIdx = srcIdx+bytesPerRGBA, dstIdx+bytesPerBGR {
		dst[dstIdx] = src[srcIdx+2]
		dst[dstIdx+1] = src[srcIdx+1]
		dst[dstIdx+2] = src[srcIdx]
	}
}

func encodeRGBAToBGR(src *image.RGBA, dst []byte, width, height int) {
	if width == 0 || height == 0 {
		return
	}

	if rgbaIsOpaque(src, width, height) {
		encodeOpaqueRGBAToBGR(src, dst, width, height)
		return
	}

	encodeUnpremultipliedRGBAToBGR(src, dst, width, height)
}

func rgbaIsOpaque(src *image.RGBA, width, height int) bool {
	return rgbaBytesAreOpaque(src.Pix, src.Stride, width, height)
}

func rgbaBytesAreOpaque(srcPix []byte, srcStride, width, height int) bool {
	srcRowBytes := width * bytesPerRGBA
	if srcStride == srcRowBytes {
		return rgbaRowIsOpaque(srcPix[:srcRowBytes*height])
	}

	for y := 0; y < height; y++ {
		srcStart := y * srcStride
		if !rgbaRowIsOpaque(srcPix[srcStart : srcStart+srcRowBytes]) {
			return false
		}
	}
	return true
}

func rgbaRowIsOpaque(row []byte) bool {
	for alphaIdx := 3; alphaIdx < len(row); alphaIdx += bytesPerRGBA {
		if row[alphaIdx] != opaqueAlpha {
			return false
		}
	}
	return true
}

func encodeOpaqueRGBAToBGR(src *image.RGBA, dst []byte, width, height int) {
	encodeRGBABytesToBGR(src.Pix, src.Stride, dst, width, height)
}

func encodeUnpremultipliedRGBAToBGR(src *image.RGBA, dst []byte, width, height int) {
	encodeUnpremultipliedRGBABytesToBGR(src.Pix, src.Stride, dst, width, height)
}

func encodeUnpremultipliedRGBABytesToBGR(srcPix []byte, srcStride int, dst []byte, width, height int) {
	if width == 0 || height == 0 {
		return
	}

	srcRowBytes := width * bytesPerRGBA
	dstRowBytes := width * bytesPerBGR

	if srcStride == srcRowBytes {
		encodeUnpremultipliedRGBARowToBGR(srcPix[:srcRowBytes*height], dst)
		return
	}

	for y := 0; y < height; y++ {
		srcStart := y * srcStride
		dstStart := y * dstRowBytes
		encodeUnpremultipliedRGBARowToBGR(srcPix[srcStart:srcStart+srcRowBytes], dst[dstStart:dstStart+dstRowBytes])
	}
}

func encodeUnpremultipliedRGBARowToBGR(src, dst []byte) {
	for srcIdx, dstIdx := 0, 0; dstIdx < len(dst); srcIdx, dstIdx = srcIdx+bytesPerRGBA, dstIdx+bytesPerBGR {
		r, g, b := unpremultiplyRGBAExact(src[srcIdx], src[srcIdx+1], src[srcIdx+2], src[srcIdx+3])
		dst[dstIdx] = b
		dst[dstIdx+1] = g
		dst[dstIdx+2] = r
	}
}

func unpremultiplyRGBAExact(r, g, b, a byte) (byte, byte, byte) {
	if a == 0 {
		return 0, 0, 0
	}
	if a == 0xff {
		return r, g, b
	}

	alpha := uint32(a)
	return uint8(((uint32(r) * 0xffff) / alpha) >> 8),
		uint8(((uint32(g) * 0xffff) / alpha) >> 8),
		uint8(((uint32(b) * 0xffff) / alpha) >> 8)
}

// getRawData retrieves the raw image data from the buffer.
// It returns a pointer to the raw image data.
func (i *ImageBuffer) getRawData() unsafe.Pointer {
	return native.MaaImageBufferGetRawData(i.handle)
}

// getWidth retrieves the width of the image stored in the buffer.
// It returns the width as an int32.
func (i *ImageBuffer) getWidth() int32 {
	return native.MaaImageBufferWidth(i.handle)
}

// getHeight retrieves the height of the image stored in the buffer.
// It returns the height as an int32.
func (i *ImageBuffer) getHeight() int32 {
	return native.MaaImageBufferHeight(i.handle)
}

// getType retrieves the type of the image stored in the buffer.
// This corresponds to the cv::Mat.type() in OpenCV.
// It returns the type as an int32.
func (i *ImageBuffer) getType() int32 {
	return native.MaaImageBufferType(i.handle)
}

// setRawData sets the raw image data in the buffer.
// It takes a pointer to the raw image data, the width, height, and type of the image.
// It returns true if the operation was successful, otherwise false.
func (i *ImageBuffer) setRawData(data unsafe.Pointer, width, height, imageType int32) bool {
	return native.MaaImageBufferSetRawData(i.handle, data, width, height, imageType)
}

// Resize resizes the image buffer to the specified width and height.
// It returns true if the operation was successful, otherwise false.
func (i *ImageBuffer) Resize(width, height int32) bool {
	return native.MaaImageBufferResize(i.handle, width, height)
}

// NOTE: GetEncoded and SetEncoded are intentionally NOT implemented in Go binding.
// Go handles image encoding/decoding natively through the standard library (image/png, image/jpeg, etc.).
// Do not add encoded image methods here.
