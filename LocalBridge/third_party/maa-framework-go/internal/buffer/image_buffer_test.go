package buffer

import (
	"testing"
	"unsafe"

	"github.com/MaaXYZ/maa-framework-go/v4/internal/native"
)

func TestGetEmptyImageReturnsNilInterface(t *testing.T) {
	original := native.MaaImageBufferGetRawData
	t.Cleanup(func() { native.MaaImageBufferGetRawData = original })
	native.MaaImageBufferGetRawData = func(uintptr) unsafe.Pointer { return nil }

	img := NewImageBufferByHandle(1).Get()
	if img != nil {
		t.Fatalf("empty buffer returned a non-nil image interface: %T", img)
	}
}
