package mfw

import (
	"encoding/json"
	"fmt"
	"strings"
)

type LinuxControllerOptions struct {
	SocketPath      string `json:"socket_path"`
	ScreencapMethod string `json:"screencap_method"`
	InputMethod     string `json:"input_method"`
	UseWin32VKCode  bool   `json:"use_win32_vk_code"`
	PipeWireNodeID  uint32 `json:"pw_node_id"`
	EISSocketPath   string `json:"eis_socket_path"`
	UInputPath      string `json:"uinput_path"`
	UInputWidth     int32  `json:"uinput_screen_width"`
	UInputHeight    int32  `json:"uinput_screen_height"`
}

func (options LinuxControllerOptions) NativeConfig() (string, error) {
	screencap, ok := map[string]int{"Wlr": 1, "PipeWire": 4}[options.ScreencapMethod]
	if !ok {
		return "", fmt.Errorf("不支持的 Linux 截图方式: %s", options.ScreencapMethod)
	}
	input, ok := map[string]int{"None": 0, "Wlr": 1, "UInput": 2, "Libei": 4}[options.InputMethod]
	if !ok {
		return "", fmt.Errorf("不支持的 Linux 输入方式: %s", options.InputMethod)
	}
	if (screencap == 1 || input == 1) && strings.TrimSpace(options.SocketPath) == "" {
		return "", fmt.Errorf("Wlr 需要 Wayland socket 路径")
	}
	if screencap == 4 && options.PipeWireNodeID == 0 {
		return "", fmt.Errorf("PipeWire daemon 直连需要有效的节点 ID；不接受其他进程的 portal FD")
	}
	if input == 4 && strings.TrimSpace(options.EISSocketPath) == "" {
		return "", fmt.Errorf("Libei 需要 EIS socket 路径")
	}
	if options.UInputWidth < 0 || options.UInputHeight < 0 {
		return "", fmt.Errorf("UInput 屏幕尺寸不能为负数")
	}
	config := map[string]any{"screencap_method": screencap, "input_method": input, "wlr_socket_path": options.SocketPath, "use_win32_vk_code": options.UseWin32VKCode}
	if screencap == 4 {
		config["pw_node_id"] = options.PipeWireNodeID
	}
	if input == 4 {
		config["eis_socket_path"] = options.EISSocketPath
	}
	if input == 2 {
		if options.UInputPath != "" {
			config["uinput_path"] = options.UInputPath
		}
		if options.UInputWidth > 0 {
			config["uinput_screen_width"] = options.UInputWidth
		}
		if options.UInputHeight > 0 {
			config["uinput_screen_height"] = options.UInputHeight
		}
	}
	raw, err := json.Marshal(config)
	return string(raw), err
}
