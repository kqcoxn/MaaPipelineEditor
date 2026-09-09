package win32

import (
	"fmt"
	"strconv"
	"strings"
)

// Win32ScreencapMethod
//
// No bitwise OR, just set it.
type ScreencapMethod uint64

// Win32InputMethod
//
// No bitwise OR, just set it.
type InputMethod uint64

const (
	ScreencapNone                 ScreencapMethod = 0
	ScreencapGDI                  ScreencapMethod = 1
	ScreencapFramePool            ScreencapMethod = 1 << 1
	ScreencapDXGIDesktopDup       ScreencapMethod = 1 << 2
	ScreencapDXGIDesktopDupWindow ScreencapMethod = 1 << 3
	ScreencapPrintWindow          ScreencapMethod = 1 << 4
	ScreencapScreenDC             ScreencapMethod = 1 << 5

	ScreencapAll        ScreencapMethod = ^ScreencapNone
	ScreencapForeground ScreencapMethod = ScreencapDXGIDesktopDupWindow | ScreencapScreenDC
	ScreencapBackground ScreencapMethod = ScreencapFramePool | ScreencapPrintWindow

	InputNone                     InputMethod = 0
	InputSeize                    InputMethod = 1
	InputSendMessage              InputMethod = 1 << 1
	InputPostMessage              InputMethod = 1 << 2
	InputLegacyEvent              InputMethod = 1 << 3
	InputPostThreadMessage        InputMethod = 1 << 4
	InputSendMessageWithCursorPos InputMethod = 1 << 5
	InputPostMessageWithCursorPos InputMethod = 1 << 6
	InputSendMessageWithWindowPos InputMethod = 1 << 7
	InputPostMessageWithWindowPos InputMethod = 1 << 8
	InputInterception             InputMethod = 1 << 9
)

const (
	screencapNoneStr                 = ""
	screencapGDIStr                  = "GDI"
	screencapFramePoolStr            = "FramePool"
	screencapDXGIDesktopDupStr       = "DXGIDesktopDup"
	screencapDXGIDesktopDupWindowStr = "DXGIDesktopDupWindow"
	screencapPrintWindowStr          = "PrintWindow"
	screencapScreenDCStr             = "ScreenDC"

	screencapAllStr        = "All"
	screencapForegroundStr = "Foreground"
	screencapBackgroundStr = "Background"

	inputNoneStr                     = ""
	inputSeizeStr                    = "Seize"
	inputSendMessageStr              = "SendMessage"
	inputPostMessageStr              = "PostMessage"
	inputLegacyEventStr              = "LegacyEvent"
	inputPostThreadMessageStr        = "PostThreadMessage"
	inputSendMessageWithCursorPosStr = "SendMessageWithCursorPos"
	inputPostMessageWithCursorPosStr = "PostMessageWithCursorPos"
	inputSendMessageWithWindowPosStr = "SendMessageWithWindowPos"
	inputPostMessageWithWindowPosStr = "PostMessageWithWindowPos"
	inputInterceptionStr             = "Interception"
)

func (m ScreencapMethod) String() string {
	switch m {
	case ScreencapNone:
		return screencapNoneStr
	case ScreencapGDI:
		return screencapGDIStr
	case ScreencapFramePool:
		return screencapFramePoolStr
	case ScreencapDXGIDesktopDup:
		return screencapDXGIDesktopDupStr
	case ScreencapDXGIDesktopDupWindow:
		return screencapDXGIDesktopDupWindowStr
	case ScreencapPrintWindow:
		return screencapPrintWindowStr
	case ScreencapScreenDC:
		return screencapScreenDCStr
	case ScreencapAll:
		return screencapAllStr
	case ScreencapForeground:
		return screencapForegroundStr
	case ScreencapBackground:
		return screencapBackgroundStr
	}
	return strconv.FormatUint(uint64(m), 10)
}

func (m InputMethod) String() string {
	switch m {
	case InputNone:
		return inputNoneStr
	case InputSeize:
		return inputSeizeStr
	case InputSendMessage:
		return inputSendMessageStr
	case InputPostMessage:
		return inputPostMessageStr
	case InputLegacyEvent:
		return inputLegacyEventStr
	case InputPostThreadMessage:
		return inputPostThreadMessageStr
	case InputSendMessageWithCursorPos:
		return inputSendMessageWithCursorPosStr
	case InputPostMessageWithCursorPos:
		return inputPostMessageWithCursorPosStr
	case InputSendMessageWithWindowPos:
		return inputSendMessageWithWindowPosStr
	case InputPostMessageWithWindowPos:
		return inputPostMessageWithWindowPosStr
	case InputInterception:
		return inputInterceptionStr
	}
	return strconv.FormatUint(uint64(m), 10)
}

func ParseScreencapMethod(s string) (ScreencapMethod, error) {
	s = strings.ToLower(strings.TrimSpace(s))
	switch {
	case strings.EqualFold(screencapNoneStr, s):
		return ScreencapNone, nil
	case strings.EqualFold(screencapGDIStr, s):
		return ScreencapGDI, nil
	case strings.EqualFold(screencapFramePoolStr, s):
		return ScreencapFramePool, nil
	case strings.EqualFold(screencapDXGIDesktopDupStr, s):
		return ScreencapDXGIDesktopDup, nil
	case strings.EqualFold(screencapDXGIDesktopDupWindowStr, s):
		return ScreencapDXGIDesktopDupWindow, nil
	case strings.EqualFold(screencapPrintWindowStr, s):
		return ScreencapPrintWindow, nil
	case strings.EqualFold(screencapScreenDCStr, s):
		return ScreencapScreenDC, nil
	case strings.EqualFold(screencapAllStr, s):
		return ScreencapAll, nil
	case strings.EqualFold(screencapForegroundStr, s):
		return ScreencapForeground, nil
	case strings.EqualFold(screencapBackgroundStr, s):
		return ScreencapBackground, nil
	default:
		i, err := strconv.ParseUint(s, 10, 64)
		if err != nil {
			return ScreencapNone, fmt.Errorf("invalid screencap method: %s", s)
		}
		return ScreencapMethod(i), nil
	}
}

func ParseInputMethod(s string) (InputMethod, error) {
	s = strings.ToLower(strings.TrimSpace(s))
	switch {
	case strings.EqualFold(inputNoneStr, s):
		return InputNone, nil
	case strings.EqualFold(inputSeizeStr, s):
		return InputSeize, nil
	case strings.EqualFold(inputSendMessageStr, s):
		return InputSendMessage, nil
	case strings.EqualFold(inputPostMessageStr, s):
		return InputPostMessage, nil
	case strings.EqualFold(inputLegacyEventStr, s):
		return InputLegacyEvent, nil
	case strings.EqualFold(inputPostThreadMessageStr, s):
		return InputPostThreadMessage, nil
	case strings.EqualFold(inputSendMessageWithCursorPosStr, s):
		return InputSendMessageWithCursorPos, nil
	case strings.EqualFold(inputPostMessageWithCursorPosStr, s):
		return InputPostMessageWithCursorPos, nil
	case strings.EqualFold(inputSendMessageWithWindowPosStr, s):
		return InputSendMessageWithWindowPos, nil
	case strings.EqualFold(inputPostMessageWithWindowPosStr, s):
		return InputPostMessageWithWindowPos, nil
	case strings.EqualFold(inputInterceptionStr, s):
		return InputInterception, nil
	default:
		i, err := strconv.ParseUint(s, 10, 64)
		if err != nil {
			return InputNone, fmt.Errorf("invalid input method: %s", s)
		}
		return InputMethod(i), nil
	}
}
