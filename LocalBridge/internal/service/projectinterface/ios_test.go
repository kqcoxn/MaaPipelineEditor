package projectinterface

import "testing"

func TestIOSControllerSchemaAndHotkey(t *testing.T) {
	schema, err := compileSchema()
	if err != nil {
		t.Fatal(err)
	}
	config := map[string]any{"wifi_address": "", "shared_control": false, "max_fps": 0}
	controller := map[string]any{"name": "phone", "type": "IOS", "ios": map[string]any{"connection": "WiFi", "screencap": "Stream|ScreenshotService", "config": config}}
	document := map[string]any{"interface_version": 2, "name": "ios", "controller": []any{controller}, "resource": []any{map[string]any{"name": "r", "path": []any{"resource"}}}}
	if err := schema.Validate(document); err != nil {
		t.Fatalf("valid IOS config rejected: %v", err)
	}
	config["max_fps"] = 241
	if err := schema.Validate(document); err == nil {
		t.Fatal("accepted out-of-range output FPS")
	}
	config["max_fps"] = 0
	controller["ios"].(map[string]any)["connection"] = "Bluetooth"
	if err := schema.Validate(document); err == nil {
		t.Fatal("accepted invalid transport")
	}
	for key, expected := range map[string]int{"A": 29, "1": 8, "CTRL": 113, "ENTER": 66, "F1": 131} {
		if code, ok := virtualKeyCode("IOS", key); !ok || code != expected {
			t.Fatalf("IOS hotkey %s: %d %v, want Android keycode %d", key, code, ok, expected)
		}
	}
}
