package macos

// ScreencapMethod defines the macOS screencap method.
//
// Select ONE method only.
type ScreencapMethod uint64

// InputMethod defines the macOS input method.
//
// Select ONE method only.
type InputMethod uint64

const (
	ScreencapNone             ScreencapMethod = 0
	ScreencapScreenCaptureKit ScreencapMethod = 1

	InputNone        InputMethod = 0
	InputGlobalEvent InputMethod = 1
	InputPostToPid   InputMethod = 1 << 1
)
