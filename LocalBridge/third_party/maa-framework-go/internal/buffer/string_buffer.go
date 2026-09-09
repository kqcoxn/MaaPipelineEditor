package buffer

import (
	"github.com/MaaXYZ/maa-framework-go/v4/internal/native"
)

type StringBuffer struct {
	handle uintptr
}

func NewStringBuffer() *StringBuffer {
	handle := native.MaaStringBufferCreate()
	if handle == 0 {
		return nil
	}
	return &StringBuffer{
		handle: handle,
	}
}

func NewStringBufferByHandle(handle uintptr) *StringBuffer {
	return &StringBuffer{
		handle: handle,
	}
}

func (s *StringBuffer) Destroy() {
	native.MaaStringBufferDestroy(s.handle)
}

func (s *StringBuffer) Handle() uintptr {
	return s.handle
}

func (s *StringBuffer) IsEmpty() bool {
	return native.MaaStringBufferIsEmpty(s.handle)
}

func (s *StringBuffer) Clear() bool {
	return native.MaaStringBufferClear(s.handle)
}

func (s *StringBuffer) Get() string {
	return native.MaaStringBufferGet(s.handle)
}

func (s *StringBuffer) Size() uint64 {
	return native.MaaStringBufferSize(s.handle)
}

func (s *StringBuffer) Set(str string) bool {
	return native.MaaStringBufferSet(s.handle, str)
}

func (s *StringBuffer) SetWithSize(str string, size uint64) bool {
	return native.MaaStringBufferSetEx(s.handle, str, size)
}
