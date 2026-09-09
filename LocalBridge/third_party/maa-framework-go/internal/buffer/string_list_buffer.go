package buffer

import (
	"github.com/MaaXYZ/maa-framework-go/v4/internal/native"
)

type StringListBuffer struct {
	handle uintptr
}

func NewStringListBuffer() *StringListBuffer {
	handle := native.MaaStringListBufferCreate()
	if handle == 0 {
		return nil
	}
	return &StringListBuffer{
		handle: handle,
	}
}

func NewStringListBufferByHandle(handle uintptr) *StringListBuffer {
	return &StringListBuffer{
		handle: handle,
	}
}

func (sl *StringListBuffer) Destroy() {
	native.MaaStringListBufferDestroy(sl.handle)
}

func (sl *StringListBuffer) Handle() uintptr {
	return sl.handle
}

func (sl *StringListBuffer) IsEmpty() bool {
	return native.MaaStringListBufferIsEmpty(sl.handle)
}

func (sl *StringListBuffer) Clear() bool {
	return native.MaaStringListBufferClear(sl.handle)
}

func (sl *StringListBuffer) Size() uint64 {
	return native.MaaStringListBufferSize(sl.handle)
}

func (sl *StringListBuffer) Get(index uint64) string {
	handle := native.MaaStringListBufferAt(sl.handle, index)
	str := &StringBuffer{handle: handle}
	return str.Get()
}

func (sl *StringListBuffer) GetAll() []string {
	size := sl.Size()
	strings := make([]string, size)
	for i := uint64(0); i < size; i++ {
		strings[i] = sl.Get(i)
	}
	return strings
}

func (sl *StringListBuffer) Append(value *StringBuffer) bool {
	return native.MaaStringListBufferAppend(sl.handle, value.handle)
}

func (sl *StringListBuffer) Remove(index uint64) bool {
	return native.MaaStringListBufferRemove(sl.handle, index)
}
