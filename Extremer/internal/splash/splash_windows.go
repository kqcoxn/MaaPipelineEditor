//go:build windows
// +build windows

package splash

import (
	"sync"
	"syscall"
	"unsafe"
)

var (
	user32               = syscall.NewLazyDLL("user32.dll")
	gdi32                = syscall.NewLazyDLL("gdi32.dll")
	kernel32             = syscall.NewLazyDLL("kernel32.dll")
	registerClassExW     = user32.NewProc("RegisterClassExW")
	createWindowExW      = user32.NewProc("CreateWindowExW")
	showWindow           = user32.NewProc("ShowWindow")
	updateWindow         = user32.NewProc("UpdateWindow")
	destroyWindow        = user32.NewProc("DestroyWindow")
	defWindowProcW       = user32.NewProc("DefWindowProcW")
	getMessage           = user32.NewProc("GetMessageW")
	translateMessage     = user32.NewProc("TranslateMessage")
	dispatchMessage      = user32.NewProc("DispatchMessageW")
	postQuitMessage      = user32.NewProc("PostQuitMessage")
	beginPaint           = user32.NewProc("BeginPaint")
	endPaint             = user32.NewProc("EndPaint")
	getSystemMetrics     = user32.NewProc("GetSystemMetrics")
	invalidateRect       = user32.NewProc("InvalidateRect")
	setTimer             = user32.NewProc("SetTimer")
	killTimer            = user32.NewProc("KillTimer")
	postMessageW         = user32.NewProc("PostMessageW")
	createSolidBrush     = gdi32.NewProc("CreateSolidBrush")
	deleteObject         = gdi32.NewProc("DeleteObject")
	selectObject         = gdi32.NewProc("SelectObject")
	setTextColor         = gdi32.NewProc("SetTextColor")
	setBkMode            = gdi32.NewProc("SetBkMode")
	drawTextW            = user32.NewProc("DrawTextW")
	fillRect             = user32.NewProc("FillRect")
	createFontIndirectW  = gdi32.NewProc("CreateFontIndirectW")
	createRoundRectRgn   = gdi32.NewProc("CreateRoundRectRgn")
	setWindowRgn         = user32.NewProc("SetWindowRgn")
	getModuleHandleW     = kernel32.NewProc("GetModuleHandleW")
	createRectRgn        = gdi32.NewProc("CreateRectRgn")
	roundRect            = gdi32.NewProc("RoundRect")
	createPen            = gdi32.NewProc("CreatePen")
	setLayeredWindowAttr = user32.NewProc("SetLayeredWindowAttributes")
)

const (
	WS_EX_TOPMOST    = 0x00000008
	WS_EX_TOOLWINDOW = 0x00000080
	WS_EX_LAYERED    = 0x00080000
	WS_POPUP         = 0x80000000
	WS_VISIBLE       = 0x10000000
	SW_SHOW          = 5
	CS_HREDRAW       = 0x0002
	CS_VREDRAW       = 0x0001
	WM_DESTROY       = 0x0002
	WM_PAINT         = 0x000F
	WM_TIMER         = 0x0113
	WM_CLOSE         = 0x0010
	SM_CXSCREEN      = 0
	SM_CYSCREEN      = 1
	DT_CENTER        = 0x00000001
	DT_VCENTER       = 0x00000004
	DT_SINGLELINE    = 0x00000020
	TRANSPARENT      = 1
	TIMER_ID         = 1
	TIMER_INTERVAL   = 80 // 更快的动画帧率
	PS_SOLID         = 0
	LWA_ALPHA        = 0x00000002
)

type WNDCLASSEXW struct {
	CbSize        uint32
	Style         uint32
	LpfnWndProc   uintptr
	CbClsExtra    int32
	CbWndExtra    int32
	HInstance     uintptr
	HIcon         uintptr
	HCursor       uintptr
	HbrBackground uintptr
	LpszMenuName  *uint16
	LpszClassName *uint16
	HIconSm       uintptr
}

type MSG struct {
	HWnd    uintptr
	Message uint32
	WParam  uintptr
	LParam  uintptr
	Time    uint32
	Pt      POINT
}

type POINT struct {
	X, Y int32
}

type PAINTSTRUCT struct {
	HDC         uintptr
	FErase      int32
	RcPaint     RECT
	FRestore    int32
	FIncUpdate  int32
	RgbReserved [32]byte
}

type RECT struct {
	Left, Top, Right, Bottom int32
}

type LOGFONTW struct {
	LfHeight         int32
	LfWidth          int32
	LfEscapement     int32
	LfOrientation    int32
	LfWeight         int32
	LfItalic         byte
	LfUnderline      byte
	LfStrikeOut      byte
	LfCharSet        byte
	LfOutPrecision   byte
	LfClipPrecision  byte
	LfQuality        byte
	LfPitchAndFamily byte
	LfFaceName       [32]uint16
}

// windowsSplash Windows 平台启动画面实现
type windowsSplash struct {
	cfg       Config
	hwnd      uintptr
	className *uint16
	message   string
	progress  int // 进度条动画进度 (0-100)
	mu        sync.RWMutex
	closed    bool
	closeChan chan struct{}
}

var globalSplash *windowsSplash

// newPlatformSplash 创建 Windows 平台启动画面
func newPlatformSplash(cfg Config) Splash {
	return &windowsSplash{
		cfg:       cfg,
		message:   cfg.Message,
		progress:  0,
		closeChan: make(chan struct{}),
	}
}

// Show 显示启动画面
func (s *windowsSplash) Show() error {
	globalSplash = s

	// 获取模块句柄
	hInstance, _, _ := getModuleHandleW.Call(0)

	// 注册窗口类
	className := syscall.StringToUTF16Ptr("SplashWindowClass")
	s.className = className

	wc := WNDCLASSEXW{
		CbSize:        uint32(unsafe.Sizeof(WNDCLASSEXW{})),
		Style:         CS_HREDRAW | CS_VREDRAW,
		LpfnWndProc:   syscall.NewCallback(splashWndProc),
		HInstance:     hInstance,
		HbrBackground: 0,
		LpszClassName: className,
	}

	registerClassExW.Call(uintptr(unsafe.Pointer(&wc)))

	// 获取屏幕尺寸
	screenWidth, _, _ := getSystemMetrics.Call(SM_CXSCREEN)
	screenHeight, _, _ := getSystemMetrics.Call(SM_CYSCREEN)

	// 计算窗口位置（居中）
	x := (int(screenWidth) - s.cfg.Width) / 2
	y := (int(screenHeight) - s.cfg.Height) / 2

	// 创建窗口
	title := syscall.StringToUTF16Ptr(s.cfg.Title)
	hwnd, _, _ := createWindowExW.Call(
		WS_EX_TOPMOST|WS_EX_TOOLWINDOW,
		uintptr(unsafe.Pointer(className)),
		uintptr(unsafe.Pointer(title)),
		WS_POPUP|WS_VISIBLE,
		uintptr(x),
		uintptr(y),
		uintptr(s.cfg.Width),
		uintptr(s.cfg.Height),
		0,
		0,
		hInstance,
		0,
	)
	s.hwnd = hwnd

	// 设置圆角区域
	rgn, _, _ := createRoundRectRgn.Call(0, 0, uintptr(s.cfg.Width), uintptr(s.cfg.Height), 20, 20)
	setWindowRgn.Call(hwnd, rgn, 1)

	// 显示窗口
	showWindow.Call(hwnd, SW_SHOW)
	updateWindow.Call(hwnd)

	// 设置定时器用于动画
	setTimer.Call(hwnd, TIMER_ID, TIMER_INTERVAL, 0)

	// 消息循环
	go func() {
		var msg MSG
		for {
			ret, _, _ := getMessage.Call(uintptr(unsafe.Pointer(&msg)), 0, 0, 0)
			if ret == 0 || s.closed {
				break
			}
			translateMessage.Call(uintptr(unsafe.Pointer(&msg)))
			dispatchMessage.Call(uintptr(unsafe.Pointer(&msg)))
		}
	}()

	return nil
}

// Close 关闭启动画面
func (s *windowsSplash) Close() {
	s.mu.Lock()
	if s.closed {
		s.mu.Unlock()
		return
	}
	s.closed = true
	s.mu.Unlock()

	if s.hwnd != 0 {
		killTimer.Call(s.hwnd, TIMER_ID)
		postMessageW.Call(s.hwnd, WM_CLOSE, 0, 0)
	}
}

// SetMessage 设置消息
func (s *windowsSplash) SetMessage(msg string) {
	s.mu.Lock()
	s.message = msg
	s.mu.Unlock()

	if s.hwnd != 0 {
		invalidateRect.Call(s.hwnd, 0, 1)
	}
}

// splashWndProc 窗口过程
func splashWndProc(hwnd uintptr, msg uint32, wParam, lParam uintptr) uintptr {
	switch msg {
	case WM_PAINT:
		if globalSplash != nil {
			globalSplash.onPaint(hwnd)
		}
		return 0
	case WM_TIMER:
		if globalSplash != nil {
			globalSplash.onTimer(hwnd)
		}
		return 0
	case WM_CLOSE:
		destroyWindow.Call(hwnd)
		return 0
	case WM_DESTROY:
		postQuitMessage.Call(0)
		return 0
	}
	ret, _, _ := defWindowProcW.Call(hwnd, uintptr(msg), wParam, lParam)
	return ret
}

// onPaint 绘制处理
func (s *windowsSplash) onPaint(hwnd uintptr) {
	var ps PAINTSTRUCT
	hdc, _, _ := beginPaint.Call(hwnd, uintptr(unsafe.Pointer(&ps)))

	// 背景色 - 深色主题 RGB(30, 30, 35)
	bgColor := uint32(0x0023231E)
	bgBrush, _, _ := createSolidBrush.Call(uintptr(bgColor))

	rect := RECT{0, 0, int32(s.cfg.Width), int32(s.cfg.Height)}
	fillRect.Call(hdc, uintptr(unsafe.Pointer(&rect)), bgBrush)
	deleteObject.Call(bgBrush)

	// 设置文本颜色 - 白色
	setTextColor.Call(hdc, 0x00FFFFFF)
	setBkMode.Call(hdc, TRANSPARENT)

	// 创建标题字体
	titleFont := createFont(26, "Segoe UI Semibold")
	oldFont, _, _ := selectObject.Call(hdc, titleFont)

	// 绘制标题
	titleRect := RECT{0, 45, int32(s.cfg.Width), 85}
	titleText := syscall.StringToUTF16Ptr("MaaPipelineEditor")
	drawTextW.Call(hdc, uintptr(unsafe.Pointer(titleText)), uintptr(len("MaaPipelineEditor")),
		uintptr(unsafe.Pointer(&titleRect)), DT_CENTER|DT_SINGLELINE)

	// 创建消息字体
	msgFont := createFont(14, "Microsoft YaHei UI")
	selectObject.Call(hdc, msgFont)

	// 设置消息文本颜色 - 浅灰
	setTextColor.Call(hdc, 0x00999999)

	// 绘制消息
	s.mu.RLock()
	message := s.message
	progress := s.progress
	s.mu.RUnlock()

	msgRect := RECT{0, 95, int32(s.cfg.Width), 120}
	msgText := syscall.StringToUTF16Ptr(message)
	drawTextW.Call(hdc, uintptr(unsafe.Pointer(msgText)), uintptr(len(message)),
		uintptr(unsafe.Pointer(&msgRect)), DT_CENTER|DT_SINGLELINE)

	// 绘制进度条背景
	progressBgColor := uint32(0x00404040) // RGB(64, 64, 64)
	progressBgBrush, _, _ := createSolidBrush.Call(uintptr(progressBgColor))

	progressBarWidth := int32(s.cfg.Width - 80)
	progressBarHeight := int32(6)
	progressBarX := int32(40)
	progressBarY := int32(145)

	progressBgRect := RECT{progressBarX, progressBarY, progressBarX + progressBarWidth, progressBarY + progressBarHeight}
	fillRect.Call(hdc, uintptr(unsafe.Pointer(&progressBgRect)), progressBgBrush)
	deleteObject.Call(progressBgBrush)

	// 绘制进度条前景（渐变效果使用蓝色）
	// 使用流动动画效果
	progressFgColor := uint32(0x00E6A041) // RGB(65, 160, 230) - 蓝色
	progressFgBrush, _, _ := createSolidBrush.Call(uintptr(progressFgColor))

	// 计算流动进度条位置
	blockWidth := int32(80)
	offset := int32(progress * int(progressBarWidth+blockWidth) / 100)
	startX := progressBarX + offset - blockWidth
	endX := progressBarX + offset

	// 限制在进度条范围内
	if startX < progressBarX {
		startX = progressBarX
	}
	if endX > progressBarX+progressBarWidth {
		endX = progressBarX + progressBarWidth
	}

	if endX > startX {
		progressFgRect := RECT{startX, progressBarY, endX, progressBarY + progressBarHeight}
		fillRect.Call(hdc, uintptr(unsafe.Pointer(&progressFgRect)), progressFgBrush)
	}
	deleteObject.Call(progressFgBrush)

	// 恢复字体
	selectObject.Call(hdc, oldFont)
	deleteObject.Call(titleFont)
	deleteObject.Call(msgFont)

	endPaint.Call(hwnd, uintptr(unsafe.Pointer(&ps)))
}

// onTimer 定时器处理
func (s *windowsSplash) onTimer(hwnd uintptr) {
	s.mu.Lock()
	s.progress += 2
	if s.progress > 100 {
		s.progress = 0
	}
	s.mu.Unlock()

	invalidateRect.Call(hwnd, 0, 0)
}

// createFont 创建字体
func createFont(height int32, fontName string) uintptr {
	var lf LOGFONTW
	lf.LfHeight = -height
	lf.LfWeight = 400
	lf.LfCharSet = 1 // DEFAULT_CHARSET

	// 复制字体名称
	name := syscall.StringToUTF16(fontName)
	for i := 0; i < len(name) && i < 32; i++ {
		lf.LfFaceName[i] = name[i]
	}

	font, _, _ := createFontIndirectW.Call(uintptr(unsafe.Pointer(&lf)))
	return font
}
