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
