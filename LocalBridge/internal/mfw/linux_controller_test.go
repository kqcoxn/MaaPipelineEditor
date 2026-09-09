package mfw

import (
	"encoding/json"
	"testing"
)

func TestLinuxControllerConfig(t *testing.T) {
	options := LinuxControllerOptions{ScreencapMethod: "PipeWire", InputMethod: "Libei", PipeWireNodeID: 42, EISSocketPath: "/run/user/1000/gamescope-0-ei"}
	raw, err := options.NativeConfig()
	if err != nil {
		t.Fatal(err)
	}
	var config map[string]any
	if err := json.Unmarshal([]byte(raw), &config); err != nil {
		t.Fatal(err)
	}
	if config["screencap_method"] != 4. || config["input_method"] != 4. || config["pw_node_id"] != 42. {
		t.Fatal(config)
	}
	if _, exists := config["pw_socket_fd"]; exists {
		t.Fatal("must not forward process-local FD")
	}
	options.EISSocketPath = ""
	if _, err := options.NativeConfig(); err == nil {
		t.Fatal("accepted missing EIS socket")
	}
	options.InputMethod = "None"
	options.PipeWireNodeID = 0
	if _, err := options.NativeConfig(); err == nil {
		t.Fatal("accepted missing node")
	}
	options.ScreencapMethod = "Wlr"
	options.SocketPath = "/run/user/1000/wayland-0"
	if _, err := options.NativeConfig(); err != nil {
		t.Fatal(err)
	}
	options.ScreencapMethod = "ExtImage"
	if _, err := options.NativeConfig(); err == nil {
		t.Fatal("accepted unimplemented method")
	}
}
