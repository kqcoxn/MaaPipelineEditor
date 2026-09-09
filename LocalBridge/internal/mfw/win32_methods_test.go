package mfw

import (
	"github.com/MaaXYZ/maa-framework-go/v4/controller/win32"
	"testing"
)

func TestAnchoredTouchIsMouseOnly(t *testing.T) {
	method, err := win32.ParseInputMethod("AnchoredTouch")
	if err != nil || method != win32.InputMethod(1024) {
		t.Fatalf("%v %v", method, err)
	}
	if _, err := parseWin32KeyboardMethod("AnchoredTouch"); err == nil {
		t.Fatal("accepted touch as keyboard")
	}
	if method, err := parseWin32KeyboardMethod(""); err != nil || method != win32.InputSendMessage {
		t.Fatal("missing keyboard default")
	}
}
