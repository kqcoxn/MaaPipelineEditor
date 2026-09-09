package buffer

import (
	"image"

	"github.com/MaaXYZ/maa-framework-go/v4/internal/native"
)

type ImageListBuffer struct {
	handle uintptr
}

func NewImageListBuffer() *ImageListBuffer {
	handle := native.MaaImageListBufferCreate()
	if handle == 0 {
		return nil
	}
	return &ImageListBuffer{
		handle: handle,
	}
}

func NewImageListBufferByHandle(handle uintptr) *ImageListBuffer {
	return &ImageListBuffer{
		handle: handle,
	}
}

func (il *ImageListBuffer) Destroy() {
	native.MaaImageListBufferDestroy(il.handle)
}

func (il *ImageListBuffer) Handle() uintptr {
	return il.handle
}

func (il *ImageListBuffer) IsEmpty() bool {
	return native.MaaImageListBufferIsEmpty(il.handle)
}

func (il *ImageListBuffer) Clear() bool {
	return native.MaaImageListBufferClear(il.handle)
}

func (il *ImageListBuffer) Size() uint64 {
	return native.MaaImageListBufferSize(il.handle)
}

func (il *ImageListBuffer) Get(index uint64) image.Image {
	handle := native.MaaImageListBufferAt(il.handle, index)
	img := &ImageBuffer{
		handle: handle,
	}
	return img.Get()
}

func (il *ImageListBuffer) GetAll() []image.Image {
	size := il.Size()
	images := make([]image.Image, size)
	for i := uint64(0); i < size; i++ {
		img := il.Get(i)
		images[i] = img
	}
	return images
}

func (il *ImageListBuffer) Append(value *ImageBuffer) bool {
	return native.MaaImageListBufferAppend(il.handle, value.handle)
}

func (il *ImageListBuffer) Remove(index uint64) bool {
	return native.MaaImageListBufferRemove(il.handle, index)
}
