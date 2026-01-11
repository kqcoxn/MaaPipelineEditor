package mfw

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"path/filepath"
	"reflect"
	"runtime"
	"sync"
	"syscall"
	"unsafe"

	maa "github.com/MaaXYZ/maa-framework-go/v3"
	"github.com/ebitengine/purego"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/config"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
)

// RecognitionDetailResult 识别详情结果
type RecognitionDetailResult struct {
	Name       string
	Algorithm  string
	Hit        bool
	Box        [4]int // [x, y, w, h]
	DetailJson string
	RawImage   string   // base64 编码的原始截图
	DrawImages []string // base64 编码的绘制图像
}

// ============================================================================
// Native API 声明（使用 purego 直接调用）
// ============================================================================

var (
	nativeAPIOnce sync.Once
	nativeAPIErr  error
	maaLibHandle  uintptr
)

// Buffer 操作函数
var (
	MaaStringBufferCreate  func() uintptr
	MaaStringBufferDestroy func(handle uintptr)
	MaaStringBufferGet     func(handle uintptr) string

	MaaImageBufferCreate     func() uintptr
	MaaImageBufferDestroy    func(handle uintptr)
	MaaImageBufferIsEmpty    func(handle uintptr) bool
	MaaImageBufferGetRawData func(handle uintptr) unsafe.Pointer
	MaaImageBufferWidth      func(handle uintptr) int32
	MaaImageBufferHeight     func(handle uintptr) int32
	MaaImageBufferChannels   func(handle uintptr) int32

	MaaImageListBufferCreate  func() uintptr
	MaaImageListBufferDestroy func(handle uintptr)
	MaaImageListBufferSize    func(handle uintptr) uint64
	MaaImageListBufferAt      func(handle uintptr, index uint64) uintptr

	MaaRectCreate  func() uintptr
	MaaRectDestroy func(handle uintptr)
	MaaRectGetX    func(handle uintptr) int32
	MaaRectGetY    func(handle uintptr) int32
	MaaRectGetW    func(handle uintptr) int32
	MaaRectGetH    func(handle uintptr) int32
)

// Tasker 操作函数
var (
	MaaTaskerGetRecognitionDetail func(
		tasker uintptr,
		recoId int64,
		nodeName uintptr,
		algorithm uintptr,
		hit *bool,
		box uintptr,
		detailJson uintptr,
		raw uintptr,
		draws uintptr,
	) bool
)

// initNativeAPI 初始化原生 API
func initNativeAPI() error {
	nativeAPIOnce.Do(func() {
		nativeAPIErr = doInitNativeAPI()
	})
	return nativeAPIErr
}

func doInitNativeAPI() error {
	// 获取库路径
	cfg := config.GetGlobal()
	if cfg == nil || cfg.MaaFW.LibDir == "" {
		return fmt.Errorf("MaaFramework 库路径未配置")
	}

	libDir := cfg.MaaFW.LibDir

	// 获取库文件名
	var libName string
	switch runtime.GOOS {
	case "darwin":
		libName = "libMaaFramework.dylib"
	case "linux":
		libName = "libMaaFramework.so"
	case "windows":
		libName = "MaaFramework.dll"
	default:
		return fmt.Errorf("不支持的操作系统: %s", runtime.GOOS)
	}

	libPath := filepath.Join(libDir, libName)

	// 加载库（使用 syscall，适用于所有平台）
	handle, err := syscall.LoadLibrary(libPath)
	if err != nil {
		return fmt.Errorf("加载 MaaFramework 库失败: %v", err)
	}
	maaLibHandle = uintptr(handle)

	// 注册函数
	registerNativeAPI()

	logger.Info("RecoHelper", "✓ 原生 API 初始化成功")
	return nil
}

func registerNativeAPI() {
	// String Buffer
	purego.RegisterLibFunc(&MaaStringBufferCreate, maaLibHandle, "MaaStringBufferCreate")
	purego.RegisterLibFunc(&MaaStringBufferDestroy, maaLibHandle, "MaaStringBufferDestroy")
	purego.RegisterLibFunc(&MaaStringBufferGet, maaLibHandle, "MaaStringBufferGet")

	// Image Buffer
	purego.RegisterLibFunc(&MaaImageBufferCreate, maaLibHandle, "MaaImageBufferCreate")
	purego.RegisterLibFunc(&MaaImageBufferDestroy, maaLibHandle, "MaaImageBufferDestroy")
	purego.RegisterLibFunc(&MaaImageBufferIsEmpty, maaLibHandle, "MaaImageBufferIsEmpty")
	purego.RegisterLibFunc(&MaaImageBufferGetRawData, maaLibHandle, "MaaImageBufferGetRawData")
	purego.RegisterLibFunc(&MaaImageBufferWidth, maaLibHandle, "MaaImageBufferWidth")
	purego.RegisterLibFunc(&MaaImageBufferHeight, maaLibHandle, "MaaImageBufferHeight")
	purego.RegisterLibFunc(&MaaImageBufferChannels, maaLibHandle, "MaaImageBufferChannels")

	// Image List Buffer
	purego.RegisterLibFunc(&MaaImageListBufferCreate, maaLibHandle, "MaaImageListBufferCreate")
	purego.RegisterLibFunc(&MaaImageListBufferDestroy, maaLibHandle, "MaaImageListBufferDestroy")
	purego.RegisterLibFunc(&MaaImageListBufferSize, maaLibHandle, "MaaImageListBufferSize")
	purego.RegisterLibFunc(&MaaImageListBufferAt, maaLibHandle, "MaaImageListBufferAt")

	// Rect
	purego.RegisterLibFunc(&MaaRectCreate, maaLibHandle, "MaaRectCreate")
	purego.RegisterLibFunc(&MaaRectDestroy, maaLibHandle, "MaaRectDestroy")
	purego.RegisterLibFunc(&MaaRectGetX, maaLibHandle, "MaaRectGetX")
	purego.RegisterLibFunc(&MaaRectGetY, maaLibHandle, "MaaRectGetY")
	purego.RegisterLibFunc(&MaaRectGetW, maaLibHandle, "MaaRectGetW")
	purego.RegisterLibFunc(&MaaRectGetH, maaLibHandle, "MaaRectGetH")

	// Tasker
	purego.RegisterLibFunc(&MaaTaskerGetRecognitionDetail, maaLibHandle, "MaaTaskerGetRecognitionDetail")
}

// ============================================================================
// 公开 API
// ============================================================================

// GetRecognitionDetailByID 通过识别 ID 获取识别详情
func GetRecognitionDetailByID(tasker *maa.Tasker, recoID int64) *RecognitionDetailResult {
	if tasker == nil {
		logger.Warn("RecoHelper", "Tasker 为空")
		return nil
	}

	// 初始化原生 API
	if err := initNativeAPI(); err != nil {
		logger.Warn("RecoHelper", "初始化原生 API 失败: %v", err)
		return nil
	}

	// 获取 Tasker 的 handle
	taskerHandle := getTaskerHandle(tasker)
	if taskerHandle == 0 {
		logger.Warn("RecoHelper", "无法获取 Tasker handle")
		return nil
	}

	// 创建 Buffer
	nameBuffer := MaaStringBufferCreate()
	defer MaaStringBufferDestroy(nameBuffer)

	algoBuffer := MaaStringBufferCreate()
	defer MaaStringBufferDestroy(algoBuffer)

	var hit bool

	rectBuffer := MaaRectCreate()
	defer MaaRectDestroy(rectBuffer)

	detailBuffer := MaaStringBufferCreate()
	defer MaaStringBufferDestroy(detailBuffer)

	rawBuffer := MaaImageBufferCreate()
	defer MaaImageBufferDestroy(rawBuffer)

	drawsBuffer := MaaImageListBufferCreate()
	defer MaaImageListBufferDestroy(drawsBuffer)

	// 调用原生 API
	got := MaaTaskerGetRecognitionDetail(
		taskerHandle,
		recoID,
		nameBuffer,
		algoBuffer,
		&hit,
		rectBuffer,
		detailBuffer,
		rawBuffer,
		drawsBuffer,
	)

	if !got {
		logger.Debug("RecoHelper", "MaaTaskerGetRecognitionDetail 返回 false, recoID=%d", recoID)
		return nil
	}

	// 构建结果
	result := &RecognitionDetailResult{
		Name:       MaaStringBufferGet(nameBuffer),
		Algorithm:  MaaStringBufferGet(algoBuffer),
		Hit:        hit,
		DetailJson: MaaStringBufferGet(detailBuffer),
		Box: [4]int{
			int(MaaRectGetX(rectBuffer)),
			int(MaaRectGetY(rectBuffer)),
			int(MaaRectGetW(rectBuffer)),
			int(MaaRectGetH(rectBuffer)),
		},
	}

	// 转换原始截图
	if !MaaImageBufferIsEmpty(rawBuffer) {
		if img := imageBufferToImage(rawBuffer); img != nil {
			result.RawImage = imageToBase64(img)
		}
	}

	// 转换绘制图像列表
	drawsSize := MaaImageListBufferSize(drawsBuffer)
	if drawsSize > 0 {
		result.DrawImages = make([]string, 0, drawsSize)
		for i := uint64(0); i < drawsSize; i++ {
			imgBuffer := MaaImageListBufferAt(drawsBuffer, i)
			if imgBuffer != 0 && !MaaImageBufferIsEmpty(imgBuffer) {
				if img := imageBufferToImage(imgBuffer); img != nil {
					b64 := imageToBase64(img)
					if b64 != "" {
						result.DrawImages = append(result.DrawImages, b64)
					}
				}
			}
		}
		logger.Info("RecoHelper", "✓ 通过原生 API 获取到 %d 张绘制图像", len(result.DrawImages))
	}

	return result
}

// ============================================================================
// 辅助函数
// ============================================================================

// getTaskerHandle 通过反射获取 Tasker 的 handle
func getTaskerHandle(tasker *maa.Tasker) uintptr {
	taskerValue := reflect.ValueOf(tasker).Elem()
	handleField := taskerValue.FieldByName("handle")

	if !handleField.IsValid() {
		return 0
	}

	// 使用 unsafe 获取私有字段的值
	handlePtr := unsafe.Pointer(handleField.UnsafeAddr())
	return *(*uintptr)(handlePtr)
}

// imageBufferToImage 将 MaaImageBuffer 转换为 Go image.Image
func imageBufferToImage(buffer uintptr) image.Image {
	width := int(MaaImageBufferWidth(buffer))
	height := int(MaaImageBufferHeight(buffer))
	channels := int(MaaImageBufferChannels(buffer))

	if width <= 0 || height <= 0 || channels < 3 {
		return nil
	}

	rawData := MaaImageBufferGetRawData(buffer)
	if rawData == nil {
		return nil
	}

	// 创建 RGBA 图像
	img := image.NewRGBA(image.Rect(0, 0, width, height))

	// 数据大小
	dataSize := width * height * channels
	data := unsafe.Slice((*byte)(rawData), dataSize)

	// 复制像素数据（MaaFramework 使用 BGR/BGRA 格式）
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			idx := (y*width + x) * channels
			var r, g, b, a byte
			if channels >= 3 {
				b = data[idx]
				g = data[idx+1]
				r = data[idx+2]
			}
			if channels >= 4 {
				a = data[idx+3]
			} else {
				a = 255
			}
			img.SetRGBA(x, y, color.RGBA{R: r, G: g, B: b, A: a})
		}
	}

	return img
}

// imageToBase64 将图像转换为 base64 编码
func imageToBase64(img image.Image) string {
	if img == nil {
		return ""
	}

	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		logger.Warn("RecoHelper", "图像编码失败: %v", err)
		return ""
	}

	return base64.StdEncoding.EncodeToString(buf.Bytes())
}
