package mfw

import (
	"os"
	"testing"

	maa "github.com/MaaXYZ/maa-framework-go/v4"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
)

// Creates an unconnected controller: no phone, xdb Server or media session is used.
func TestNativeIOSControllerLifecycle(t *testing.T) {
	lib := os.Getenv("MPE_MFW_TEST_LIB_DIR")
	if lib == "" {
		t.Skip("requires MPE_MFW_TEST_LIB_DIR")
	}
	if err := logger.Init("ERROR", "", false); err != nil {
		t.Fatal(err)
	}
	if err := maa.Init(maa.WithLibDir(lib), maa.WithLogDir(t.TempDir()), maa.WithStdoutLevel(maa.LoggingLevelOff)); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := maa.Release(); err != nil {
			t.Error(err)
		}
	})
	cm := NewControllerManager()
	t.Cleanup(cm.DisconnectAll)
	id, err := cm.CreateIOSController(IOSControllerOptions{UDID: "mpe-unconnected-test-device", Connection: "USB", ScreencapMethods: []string{"ScreenshotService"}})
	if err != nil {
		t.Fatal(err)
	}
	info, err := cm.GetController(id)
	if err != nil || info.Type != "IOS" || info.Connected {
		t.Fatalf("unexpected unconnected IOS controller: %#v %v", info, err)
	}
	if err := cm.DisconnectController(id); err != nil {
		t.Fatal(err)
	}
	if len(cm.ListControllers()) != 0 {
		t.Fatal("destroyed IOS controller remains registered")
	}
}
