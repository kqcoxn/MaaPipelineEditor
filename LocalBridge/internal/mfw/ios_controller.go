package mfw

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	maa "github.com/MaaXYZ/maa-framework-go/v4"
	"github.com/MaaXYZ/maa-framework-go/v4/controller/ios"
	"github.com/google/uuid"
)

type IOSControllerOptions struct {
	UDID             string   `json:"udid"`
	Connection       string   `json:"connection"`
	ScreencapMethods []string `json:"screencap_methods"`
	Config           string   `json:"config"`
}

// Pointers preserve explicit zero, false and empty-string overrides.
type iosConfig struct {
	ServerPort     *uint16 `json:"server_port,omitempty"`
	WiFiAddress    *string `json:"wifi_address,omitempty"`
	WiFiPort       *uint16 `json:"wifi_port,omitempty"`
	SharedControl  *bool   `json:"shared_control,omitempty"`
	MaxBitrate     *uint64 `json:"max_bitrate,omitempty"`
	MaxFPS         *uint16 `json:"max_fps,omitempty"`
	HardwareDecode *bool   `json:"hardware_decode,omitempty"`
}

func parseIOSConnection(value string) (ios.ConnectionMethod, error) {
	switch value {
	case "", "Auto":
		return ios.ConnectionAuto, nil
	case "USB":
		return ios.ConnectionUSB, nil
	case "WiFi":
		return ios.ConnectionWiFi, nil
	default:
		return 0, fmt.Errorf("不支持的 iOS 连接方式: %s", value)
	}
}

func (options IOSControllerOptions) nativeConfig() (string, error) {
	raw := strings.TrimSpace(options.Config)
	if raw == "" {
		raw = "{}"
	}
	if !strings.HasPrefix(raw, "{") || !json.Valid([]byte(raw)) {
		return "", fmt.Errorf("iOS 配置必须是 JSON 对象")
	}
	var fields map[string]json.RawMessage
	_ = json.Unmarshal([]byte(raw), &fields)
	for key, value := range fields {
		if string(value) == "null" {
			return "", fmt.Errorf("iOS 配置字段 %s 不能为 null", key)
		}
	}
	var config iosConfig
	decoder := json.NewDecoder(strings.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&config); err != nil {
		return "", fmt.Errorf("iOS 配置无效: %w", err)
	}
	if config.WiFiPort != nil && *config.WiFiPort == 0 {
		return "", fmt.Errorf("iOS Wi-Fi 端口必须为 1..65535")
	}
	if config.MaxFPS != nil && *config.MaxFPS > 240 {
		return "", fmt.Errorf("iOS 输出帧率必须为 0..240")
	}
	if config.WiFiAddress != nil && strings.ContainsRune(*config.WiFiAddress, 0) {
		return "", fmt.Errorf("iOS Wi-Fi 地址不能包含 NUL")
	}
	return raw, nil
}

func (options IOSControllerOptions) nativeParams() (ios.ScreencapMethod, ios.ConnectionMethod, string, error) {
	if strings.TrimSpace(options.UDID) == "" || strings.ContainsRune(options.UDID, 0) {
		return 0, 0, "", fmt.Errorf("iOS 设备 UDID 不能为空或包含 NUL")
	}
	connection, err := parseIOSConnection(options.Connection)
	if err != nil {
		return 0, 0, "", err
	}
	screencap := ios.ScreencapDefault
	if len(options.ScreencapMethods) > 0 {
		screencap = ios.ScreencapNone
		for _, method := range options.ScreencapMethods {
			switch method {
			case "Stream":
				screencap |= ios.ScreencapStream
			case "ScreenshotService":
				screencap |= ios.ScreencapScreenshotService
			default:
				return 0, 0, "", fmt.Errorf("不支持的 iOS 截图方式: %s", method)
			}
		}
	}
	config, err := options.nativeConfig()
	return screencap, connection, config, err
}

func (cm *ControllerManager) CreateIOSController(options IOSControllerOptions) (string, error) {
	screencap, connection, config, err := options.nativeParams()
	if err != nil {
		return "", NewMFWError(ErrCodeInvalidParameter, err.Error(), nil)
	}
	ctrl, err := maa.NewIOSController(options.UDID, screencap, connection, config)
	if err != nil {
		return "", NewMFWError(ErrCodeControllerCreateFail, "创建 iOS 控制器失败: "+err.Error(), nil)
	}
	id := uuid.NewString()
	cm.mu.Lock()
	cm.controllers[id] = &ControllerInfo{ControllerID: id, Type: "IOS", Controller: ctrl, CreatedAt: time.Now(), LastActiveAt: time.Now()}
	cm.mu.Unlock()
	return id, nil
}

type IOSDeviceInfo struct {
	UDID             string          `json:"udid"`
	Name             string          `json:"name"`
	State            string          `json:"state"`
	Connections      json.RawMessage `json:"connections"`
	ScreencapMethods []string        `json:"screencap_methods"`
}

func (dm *DeviceManager) RefreshIOSDevices(options IOSControllerOptions) ([]IOSDeviceInfo, json.RawMessage, error) {
	connection, err := parseIOSConnection(options.Connection)
	if err != nil {
		return nil, nil, err
	}
	raw, err := options.nativeConfig()
	if err != nil {
		return nil, nil, err
	}
	var config iosConfig
	_ = json.Unmarshal([]byte(raw), &config)
	discovery := map[string]any{"timeout_ms": 3000}
	if config.ServerPort != nil {
		discovery["server_port"] = *config.ServerPort
	}
	discoveryJSON, _ := json.Marshal(discovery)
	result, err := maa.FindIOSDevicesWithOptions(connection, string(discoveryJSON), nil)
	devices := make([]IOSDeviceInfo, 0)
	warnings := json.RawMessage("[]")
	if result != nil {
		if json.Valid([]byte(result.Warnings)) {
			warnings = json.RawMessage(result.Warnings)
		}
		for _, device := range result.Devices {
			methods := []string{}
			if device.ScreencapMethod&ios.ScreencapStream != 0 {
				methods = append(methods, "Stream")
			}
			if device.ScreencapMethod&ios.ScreencapScreenshotService != 0 {
				methods = append(methods, "ScreenshotService")
			}
			connections := json.RawMessage("[]")
			if json.Valid([]byte(device.Connections)) {
				connections = json.RawMessage(device.Connections)
			}
			devices = append(devices, IOSDeviceInfo{UDID: device.UDID, Name: device.Name, State: device.State, Connections: connections, ScreencapMethods: methods})
		}
	}
	return devices, warnings, err
}
