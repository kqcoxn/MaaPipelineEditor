package mfw

import (
	"image"

	maa "github.com/MaaXYZ/maa-framework-go/v4"
)

// FixedImageController 是一个固定图片控制器：截图始终返回构造时传入的同一张图片，
// 所有输入操作均为空实现（直接返回成功）。
//
// 用于"快速工具"在不依赖真实设备实时截图的情况下，对一张已固定的底图运行识别
// （OCR / 模板匹配等），保证"所见即所得"——识别结果严格基于前端当前展示的那张图，
// 不会因窗口刷新导致画面不一致。
//
// 通过内嵌 maa.BlankController 复用其全部空实现，仅重写 Screencap 与 RequestUUID。
type FixedImageController struct {
	maa.BlankController
	img image.Image
}

// NewFixedImageController 用一张固定底图创建自定义控制器。
func NewFixedImageController(img image.Image) (*maa.Controller, error) {
	return maa.NewCustomController(&FixedImageController{img: img})
}

// Screencap 始终返回固定底图。
func (c *FixedImageController) Screencap() (image.Image, bool) {
	if c.img == nil {
		return nil, false
	}
	return c.img, true
}

// RequestUUID 返回固定标识。
func (c *FixedImageController) RequestUUID() (string, bool) {
	return "fixed-image-controller", true
}
