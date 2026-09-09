package maa

import (
	"errors"
	"github.com/MaaXYZ/maa-framework-go/v4/internal/native"
)

// NewLinuxController creates the unified MaaFramework Linux controller.
// configJSON follows MaaLinuxControllerCreate; requires MaaFramework 5.13.
func NewLinuxController(configJSON string) (*Controller, error) {
	handle := native.MaaLinuxControllerCreate(configJSON)
	if handle == 0 {
		return nil, errors.New("failed to create Linux controller")
	}
	initControllerStore(handle)
	return &Controller{handle: handle}, nil
}
