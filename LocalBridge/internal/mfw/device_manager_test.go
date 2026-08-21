package mfw

import (
	"reflect"
	"testing"

	"github.com/MaaXYZ/maa-framework-go/v4/controller/adb"
)

func TestAdbInputMethodNamesPreservesToolkitSelection(t *testing.T) {
	methods := adb.InputMaatouch | adb.InputAdbShell
	want := []string{"AdbShell", "Maatouch"}
	if got := adbInputMethodNames(methods); !reflect.DeepEqual(got, want) {
		t.Fatalf("adbInputMethodNames() = %v, want %v", got, want)
	}
}

func TestAdbScreencapMethodNamesPreservesToolkitSelection(t *testing.T) {
	methods := adb.ScreencapEncode | adb.ScreencapEmulatorExtras
	want := []string{"Encode", "EmulatorExtras"}
	if got := adbScreencapMethodNames(methods); !reflect.DeepEqual(got, want) {
		t.Fatalf("adbScreencapMethodNames() = %v, want %v", got, want)
	}
}

func TestAdbAgentRequirements(t *testing.T) {
	tests := []struct {
		name             string
		methods          []string
		requiresAgent    bool
		hasAgentlessPath bool
	}{
		{name: "maatouch only", methods: []string{"Maatouch"}, requiresAgent: true},
		{name: "maatouch with adb fallback", methods: []string{"Maatouch", "AdbShell"}, requiresAgent: true, hasAgentlessPath: true},
		{name: "emulator extras", methods: []string{"EmulatorExtras"}, hasAgentlessPath: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := requiresAdbAgent(tt.methods); got != tt.requiresAgent {
				t.Fatalf("requiresAdbAgent() = %v, want %v", got, tt.requiresAgent)
			}
			if got := hasAgentlessAdbFallback(tt.methods); got != tt.hasAgentlessPath {
				t.Fatalf("hasAgentlessAdbFallback() = %v, want %v", got, tt.hasAgentlessPath)
			}
		})
	}
}
