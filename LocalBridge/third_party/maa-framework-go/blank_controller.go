// Package maa provides the Go binding for MaaFramework.
//
// This file provides BlankController, a pure-Go no-op custom controller
// implementation (via NewCustomController) for testing and development purposes.
//
// NOTE: This is NOT a binding to MaaDbgControllerCreate from the C API.
// MaaDbgControllerCreate is intentionally excluded from the Go binding.
// Do NOT add a NewDbgController or any wrapper for MaaDbgControllerCreate here.
// Use BlankController as a Go-native no-op stub alternative.
// For image-based testing, use the C implementation via MaaDbgControllerCreate.
package maa

import (
	"image"
)

type BlankController struct{}

var _ CustomController = (*BlankController)(nil)

// NewBlankController creates a blank controller that does nothing and always succeeds.
// Use this to test framework features (resource binding, tasker initialization, etc.)
// without any real controller behavior.
func NewBlankController() (*Controller, error) {
	return NewCustomController(&BlankController{})
}

// Click implements CustomController.
func (c *BlankController) Click(x int32, y int32) bool {
	return true
}

// ClickKey implements CustomController.
func (c *BlankController) ClickKey(keycode int32) bool {
	return true
}

// Connect implements CustomController.
func (c *BlankController) Connect() bool {
	return true
}

// Connected implements CustomController.
func (c *BlankController) Connected() bool {
	return true
}

// GetFeature implements CustomController.
func (c *BlankController) GetFeature() ControllerFeature {
	return ControllerFeatureNone
}

// InputText implements CustomController.
func (c *BlankController) InputText(text string) bool {
	return true
}

// KeyDown implements CustomController.
func (c *BlankController) KeyDown(keycode int32) bool {
	return true
}

// KeyUp implements CustomController.
func (c *BlankController) KeyUp(keycode int32) bool {
	return true
}

// RequestUUID implements CustomController.
func (c *BlankController) RequestUUID() (string, bool) {
	return "blank-controller", true
}

// Screencap implements CustomController.
func (c *BlankController) Screencap() (image.Image, bool) {
	return image.NewRGBA(image.Rect(0, 0, 1280, 720)), true
}

// StartApp implements CustomController.
func (c *BlankController) StartApp(intent string) bool {
	return true
}

// StopApp implements CustomController.
func (c *BlankController) StopApp(intent string) bool {
	return true
}

// Swipe implements CustomController.
func (c *BlankController) Swipe(x1 int32, y1 int32, x2 int32, y2 int32, duration int32) bool {
	return true
}

// TouchDown implements CustomController.
func (c *BlankController) TouchDown(contact int32, x int32, y int32, pressure int32) bool {
	return true
}

// TouchMove implements CustomController.
func (c *BlankController) TouchMove(contact int32, x int32, y int32, pressure int32) bool {
	return true
}

// TouchUp implements CustomController.
func (c *BlankController) TouchUp(contact int32) bool {
	return true
}

// Scroll implements CustomController.
func (c *BlankController) Scroll(dx int32, dy int32) bool {
	return true
}

// RelativeMove implements CustomController.
func (c *BlankController) RelativeMove(dx int32, dy int32) bool {
	return true
}

// Shell implements CustomController.
func (c *BlankController) Shell(cmd string, timeout int64) (string, bool) {
	return "", true
}

// Inactive implements CustomController.
func (c *BlankController) Inactive() bool {
	return true
}

// GetInfo implements CustomController.
func (c *BlankController) GetInfo() (string, bool) {
	info := map[string]any{
		"type": "blank",
	}
	data, err := marshalJSON(info)
	if err != nil {
		return "", false
	}
	return string(data), true
}
