package mfw

import (
	"fmt"
	"math"

	maa "github.com/MaaXYZ/maa-framework-go/v4"
)

const DefaultScreenshotShortSide int32 = 720

func DefaultScreenshotResolution() ScreenshotResolution {
	return ScreenshotResolution{TargetShortSide: DefaultScreenshotShortSide}
}

func ParseOptionalScreenshotResolution(values map[string]interface{}) (*ScreenshotResolution, error) {
	var expand [2]int32
	_, hasExpand := values["target_expand"]
	if hasExpand {
		items, ok := values["target_expand"].([]interface{})
		if !ok || len(items) != 2 {
			return nil, fmt.Errorf("target_expand 必须是 [width, height]")
		}
		for i, item := range items {
			value, _, err := positiveInt32Option(map[string]interface{}{"target_expand": item}, "target_expand")
			if err != nil {
				return nil, err
			}
			expand[i] = value
		}
	}
	longSide, hasLongSide, err := positiveInt32Option(values, "target_long_side")
	if err != nil {
		return nil, err
	}
	shortSide, hasShortSide, err := positiveInt32Option(values, "target_short_side")
	if err != nil {
		return nil, err
	}
	useRawSize, hasUseRawSize, err := boolOption(values, "use_raw_size")
	if err != nil {
		return nil, err
	}
	hasRawMode := hasUseRawSize && useRawSize

	modeCount := 0
	for _, enabled := range []bool{hasLongSide, hasShortSide, hasRawMode, hasExpand} {
		if enabled {
			modeCount++
		}
	}
	if modeCount > 1 {
		return nil, fmt.Errorf("截图分辨率参数互斥，只能设置一种模式")
	}
	if modeCount == 0 {
		return nil, nil
	}

	return &ScreenshotResolution{
		TargetExpand:    expand,
		TargetLongSide:  longSide,
		TargetShortSide: shortSide,
		UseRawSize:      hasRawMode,
	}, nil
}

func ScreenshotResolutionFromControllerOptions(options map[string]interface{}) (ScreenshotResolution, error) {
	value, exists := options["screenshotResolution"]
	if !exists {
		return DefaultScreenshotResolution(), nil
	}
	values, ok := value.(map[string]interface{})
	if !ok {
		return ScreenshotResolution{}, fmt.Errorf("controller.options.screenshotResolution 格式错误")
	}
	resolution, err := ParseOptionalScreenshotResolution(values)
	if err != nil {
		return ScreenshotResolution{}, err
	}
	if resolution == nil {
		return DefaultScreenshotResolution(), nil
	}
	return *resolution, nil
}

func ApplyScreenshotResolution(controller *maa.Controller, resolution ScreenshotResolution) error {
	if controller == nil {
		return fmt.Errorf("控制器实例不可用")
	}

	switch {
	case resolution.TargetExpand[0] > 0 && resolution.TargetExpand[1] > 0:
		if err := controller.SetScreenshot(maa.WithScreenshotUseRawSize(false)); err != nil {
			return err
		}
		return controller.SetScreenshot(maa.WithScreenshotTargetExpand(resolution.TargetExpand[0], resolution.TargetExpand[1]))
	case resolution.UseRawSize:
		return controller.SetScreenshot(maa.WithScreenshotUseRawSize(true))
	case resolution.TargetLongSide > 0:
		if err := controller.SetScreenshot(maa.WithScreenshotUseRawSize(false)); err != nil {
			return fmt.Errorf("关闭原始截图模式失败: %w", err)
		}
		if err := controller.SetScreenshot(maa.WithScreenshotTargetLongSide(resolution.TargetLongSide)); err != nil {
			return fmt.Errorf("设置截图目标长边失败: %w", err)
		}
		return nil
	case resolution.TargetShortSide > 0:
		if err := controller.SetScreenshot(maa.WithScreenshotUseRawSize(false)); err != nil {
			return fmt.Errorf("关闭原始截图模式失败: %w", err)
		}
		if err := controller.SetScreenshot(maa.WithScreenshotTargetShortSide(resolution.TargetShortSide)); err != nil {
			return fmt.Errorf("设置截图目标短边失败: %w", err)
		}
		return nil
	default:
		return fmt.Errorf("缺少有效的截图分辨率模式")
	}
}

func positiveInt32Option(values map[string]interface{}, key string) (int32, bool, error) {
	value, exists := values[key]
	if !exists {
		return 0, false, nil
	}

	var number float64
	switch typed := value.(type) {
	case float64:
		number = typed
	case float32:
		number = float64(typed)
	case int:
		number = float64(typed)
	case int32:
		number = float64(typed)
	case int64:
		number = float64(typed)
	default:
		return 0, false, fmt.Errorf("%s 必须是正整数", key)
	}
	if number <= 0 || number > math.MaxInt32 || math.Trunc(number) != number {
		return 0, false, fmt.Errorf("%s 必须是有效的正整数", key)
	}
	return int32(number), true, nil
}

func boolOption(values map[string]interface{}, key string) (bool, bool, error) {
	value, exists := values[key]
	if !exists {
		return false, false, nil
	}
	result, ok := value.(bool)
	if !ok {
		return false, false, fmt.Errorf("%s 必须是布尔值", key)
	}
	return result, true, nil
}
