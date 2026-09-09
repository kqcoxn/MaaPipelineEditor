package maa

import "github.com/MaaXYZ/maa-framework-go/v4/internal/native"

// Version returns the version of the maa framework.
func Version() string {
	return native.MaaVersion()
}
