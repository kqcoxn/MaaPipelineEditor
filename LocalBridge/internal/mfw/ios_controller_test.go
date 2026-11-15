package mfw

import (
	"testing"

	"github.com/MaaXYZ/maa-framework-go/v4/controller/ios"
)

func TestIOSControllerParams(t *testing.T) {
	raw := `{"server_port":0,"wifi_address":"","wifi_port":49152,"shared_control":false,"max_bitrate":18446744073709551615,"max_fps":0,"hardware_decode":false}`
	options := IOSControllerOptions{UDID: "iphone", Connection: "WiFi", ScreencapMethods: []string{"Stream", "ScreenshotService"}, Config: raw}
	capture, connection, config, err := options.nativeParams()
	if err != nil || capture != ios.ScreencapStream|ios.ScreencapScreenshotService || connection != ios.ConnectionWiFi || config != raw {
		t.Fatalf("lost capture flags, transport or explicit config values: %d %d %s %v", capture, connection, config, err)
	}
	options = IOSControllerOptions{UDID: "ipad"}
	capture, connection, config, err = options.nativeParams()
	if err != nil || capture != ios.ScreencapDefault || connection != ios.ConnectionAuto || config != "{}" {
		t.Fatalf("invalid defaults: %d %d %s %v", capture, connection, config, err)
	}
	options.ScreencapMethods = []string{"ScreenshotService"}
	capture, _, _, err = options.nativeParams()
	if err != nil || capture != ios.ScreencapScreenshotService {
		t.Fatalf("lossless-only capture started a video stream: %d %v", capture, err)
	}
}

func TestIOSControllerRejectsInvalidParams(t *testing.T) {
	for _, config := range []string{
		`null`, `[]`, `{"max_fps":241}`, `{"max_fps":-1}`, `{"max_fps":1.5}`,
		`{"server_port":65536}`, `{"wifi_port":0}`, `{"shared_control":"false"}`,
		`{"wifi_address":"\u0000"}`, `{"max_bitrate":18446744073709551616}`,
		`{"max_bitrate":-1}`, `{"hardware_decode":null}`, `{"unknown":true}`, `{} {}`,
	} {
		t.Run(config, func(t *testing.T) {
			_, _, _, err := (IOSControllerOptions{UDID: "iphone", Config: config}).nativeParams()
			if err == nil {
				t.Fatalf("accepted invalid config: %s", config)
			}
		})
	}
	for _, options := range []IOSControllerOptions{
		{}, {UDID: " "}, {UDID: "phone\x00"}, {UDID: "phone", Connection: "Bluetooth"},
		{UDID: "phone", ScreencapMethods: []string{"Encode"}},
	} {
		if _, _, _, err := options.nativeParams(); err == nil {
			t.Fatalf("accepted invalid controller options: %#v", options)
		}
	}
}
