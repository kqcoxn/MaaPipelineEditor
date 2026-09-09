package adb

import (
	"fmt"
	"strconv"
	"strings"
)

// AdbScreencapMethod
//
// Use bitwise OR to set the method you need,
// MaaFramework will test their speed and use the fastest one.
type ScreencapMethod uint64

// AdbInputMethod
//
// Use bitwise OR to set the method you need,
// MaaFramework will select the available ones according to priority.
// The priority is: EmulatorExtras > Maatouch > MinitouchAndAdbKey > AdbShell
type InputMethod uint64

const (
	ScreencapNone                ScreencapMethod = 0
	ScreencapEncodeToFileAndPull ScreencapMethod = 1
	ScreencapEncode              ScreencapMethod = 1 << 1
	ScreencapRawWithGzip         ScreencapMethod = 1 << 2
	ScreencapRawByNetcat         ScreencapMethod = 1 << 3
	ScreencapMinicapDirect       ScreencapMethod = 1 << 4
	ScreencapMinicapStream       ScreencapMethod = 1 << 5
	ScreencapEmulatorExtras      ScreencapMethod = 1 << 6
	ScreencapAll                                 = ^ScreencapNone
	ScreencapDefault                             = ScreencapAll &
		(^ScreencapRawByNetcat) &
		(^ScreencapMinicapDirect) &
		(^ScreencapMinicapStream)

	InputNone               InputMethod = 0
	InputAdbShell           InputMethod = 1
	InputMinitouchAndAdbKey InputMethod = 1 << 1
	InputMaatouch           InputMethod = 1 << 2
	InputEmulatorExtras     InputMethod = 1 << 3
	InputAll                            = ^InputNone
	InputDefault                        = InputAll & (^InputEmulatorExtras)
)

const (
	screencapNoneStr                = ""
	screencapEncodeToFileAndPullStr = "EncodeToFileAndPull"
	screencapEncodeStr              = "Encode"
	screencapRawWithGzipStr         = "RawWithGzip"
	screencapRawByNetcatStr         = "RawByNetcat"
	screencapMinicapDirectStr       = "MinicapDirect"
	screencapMinicapStreamStr       = "MinicapStream"
	screencapEmulatorExtrasStr      = "EmulatorExtras"
	screencapAllStr                 = "All"
	screencapDefaultStr             = "Default"

	inputNoneStr               = ""
	inputAdbShellStr           = "AdbShell"
	inputMinitouchAndAdbKeyStr = "MinitouchAndAdbKey"
	inputMaatouchStr           = "Maatouch"
	inputEmulatorExtrasStr     = "EmulatorExtras"
	inputAllStr                = "All"
	inputDefaultStr            = "Default"
)

func (m ScreencapMethod) String() string {
	switch m {
	case ScreencapNone:
		return screencapNoneStr
	case ScreencapEncodeToFileAndPull:
		return screencapEncodeToFileAndPullStr
	case ScreencapEncode:
		return screencapEncodeStr
	case ScreencapRawWithGzip:
		return screencapRawWithGzipStr
	case ScreencapRawByNetcat:
		return screencapRawByNetcatStr
	case ScreencapMinicapDirect:
		return screencapMinicapDirectStr
	case ScreencapMinicapStream:
		return screencapMinicapStreamStr
	case ScreencapEmulatorExtras:
		return screencapEmulatorExtrasStr
	case ScreencapAll:
		return screencapAllStr
	case ScreencapDefault:
		return screencapDefaultStr
	}
	return strconv.FormatUint(uint64(m), 10)
}

func (m InputMethod) String() string {
	switch m {
	case InputNone:
		return inputNoneStr
	case InputAdbShell:
		return inputAdbShellStr
	case InputMinitouchAndAdbKey:
		return inputMinitouchAndAdbKeyStr
	case InputMaatouch:
		return inputMaatouchStr
	case InputEmulatorExtras:
		return inputEmulatorExtrasStr
	case InputAll:
		return inputAllStr
	case InputDefault:
		return inputDefaultStr
	}
	return strconv.FormatUint(uint64(m), 10)
}

func ParseScreencapMethod(s string) (ScreencapMethod, error) {
	s = strings.ToLower(strings.TrimSpace(s))
	switch {
	case strings.EqualFold(screencapNoneStr, s):
		return ScreencapNone, nil
	case strings.EqualFold(screencapEncodeToFileAndPullStr, s):
		return ScreencapEncodeToFileAndPull, nil
	case strings.EqualFold(screencapEncodeStr, s):
		return ScreencapEncode, nil
	case strings.EqualFold(screencapRawWithGzipStr, s):
		return ScreencapRawWithGzip, nil
	case strings.EqualFold(screencapRawByNetcatStr, s):
		return ScreencapRawByNetcat, nil
	case strings.EqualFold(screencapMinicapDirectStr, s):
		return ScreencapMinicapDirect, nil
	case strings.EqualFold(screencapMinicapStreamStr, s):
		return ScreencapMinicapStream, nil
	case strings.EqualFold(screencapEmulatorExtrasStr, s):
		return ScreencapEmulatorExtras, nil
	case strings.EqualFold(screencapAllStr, s):
		return ScreencapAll, nil
	case strings.EqualFold(screencapDefaultStr, s):
		return ScreencapDefault, nil
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
	case strings.EqualFold(inputAdbShellStr, s):
		return InputAdbShell, nil
	case strings.EqualFold(inputMinitouchAndAdbKeyStr, s):
		return InputMinitouchAndAdbKey, nil
	case strings.EqualFold(inputMaatouchStr, s):
		return InputMaatouch, nil
	case strings.EqualFold(inputEmulatorExtrasStr, s):
		return InputEmulatorExtras, nil
	case strings.EqualFold(inputAllStr, s):
		return InputAll, nil
	case strings.EqualFold(inputDefaultStr, s):
		return InputDefault, nil
	default:
		i, err := strconv.ParseUint(s, 10, 64)
		if err != nil {
			return InputNone, fmt.Errorf("invalid input method: %s", s)
		}
		return InputMethod(i), nil
	}
}
