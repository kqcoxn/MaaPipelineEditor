package mfw

import (
	"fmt"
	"github.com/MaaXYZ/maa-framework-go/v4/controller/win32"
)

func parseWin32KeyboardMethod(name string) (win32.InputMethod, error) {
	if name == "" {
		return win32.InputSendMessage, nil
	}
	method, err := win32.ParseInputMethod(name)
	if err != nil {
		return 0, err
	}
	if method == win32.InputAnchoredTouch {
		return 0, fmt.Errorf("AnchoredTouch 不支持键盘输入，请选择其他键盘方式")
	}
	return method, nil
}
