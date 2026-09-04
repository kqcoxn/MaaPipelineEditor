package mfw

import (
	"strconv"
	"strings"
	"testing"
)

func TestParseWindowHandle(t *testing.T) {
	tests := []struct {
		name    string
		value   string
		want    uintptr
		wantErr bool
	}{
		{name: "empty", value: "", want: 0},
		{name: "prefixed", value: "0x1234", want: 0x1234},
		{name: "uppercase prefix", value: "0XABCD", want: 0xabcd},
		{name: "plain hexadecimal", value: "7f", want: 0x7f},
		{name: "trimmed", value: "  0x42  ", want: 0x42},
		{name: "invalid", value: "not-a-handle", wantErr: true},
		{name: "empty hexadecimal", value: "0x", wantErr: true},
		{name: "overflow", value: strings.Repeat("f", strconv.IntSize/4+1), wantErr: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, err := parseWindowHandle(test.value)
			if (err != nil) != test.wantErr {
				t.Fatalf("parseWindowHandle(%q) error = %v, wantErr %t", test.value, err, test.wantErr)
			}
			if err == nil && uintptr(got) != test.want {
				t.Fatalf("parseWindowHandle(%q) = %#x, want %#x", test.value, uintptr(got), test.want)
			}
		})
	}
}

func TestParseMacOSWindowID(t *testing.T) {
	tests := []struct {
		name    string
		value   string
		want    uint64
		wantErr bool
	}{
		{name: "decimal", value: "12345", want: 12345},
		{name: "decimal with leading zeros", value: "00123", want: 123},
		{name: "hexadecimal", value: "0x2a", want: 42},
		{name: "trimmed", value: "  99  ", want: 99},
		{name: "empty", value: "", wantErr: true},
		{name: "invalid", value: "not-a-window", wantErr: true},
		{name: "overflow", value: "4294967296", wantErr: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, err := parseMacOSWindowID(test.value)
			if (err != nil) != test.wantErr {
				t.Fatalf("parseMacOSWindowID(%q) error = %v, wantErr %t", test.value, err, test.wantErr)
			}
			if err == nil && got != test.want {
				t.Fatalf("parseMacOSWindowID(%q) = %d, want %d", test.value, got, test.want)
			}
		})
	}
}
