package dependencies

import (
	"bytes"
	"context"
	"io"
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"strings"
	"testing"
)

func TestDevelopmentReinstallPassesSelectionToScript(t *testing.T) {
	root := t.TempDir()
	configPath := filepath.Join(root, "Editor", "src", "stores", "app", "configStore.ts")
	scriptDir := filepath.Join(root, "scripts", "install")
	for _, dir := range []string{filepath.Dir(configPath), scriptDir} {
		if err := os.MkdirAll(dir, 0755); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.WriteFile(configPath, []byte(`mfwVersion: "5.13.0",`), 0600); err != nil {
		t.Fatal(err)
	}
	// Mock only the installer payload; run the real process and environment handoff.
	ps := "# MPELB_REINSTALL_V1\nWrite-Output ('selected=' + $env:MPELB_REINSTALL + ';version=' + $env:MPELB_MFW_VERSION + ';dir=' + $env:MPELB_REINSTALL_DIR)\n"
	sh := "# MPELB_REINSTALL_V1\nprintf 'selected=%s;version=%s;dir=%s\\n' \"$MPELB_REINSTALL\" \"$MPELB_MFW_VERSION\" \"$MPELB_REINSTALL_DIR\"\n"
	for name, content := range map[string]string{"install.ps1": ps, "install.sh": sh} {
		if err := os.WriteFile(filepath.Join(scriptDir, name), []byte(content), 0600); err != nil {
			t.Fatal(err)
		}
	}
	t.Chdir(root)
	for _, target := range []string{"all", "mfw", "ocr"} {
		if target == "ocr" {
			if err := os.WriteFile(configPath, []byte("invalid MFW config"), 0600); err != nil {
				t.Fatal(err)
			}
		}
		var output bytes.Buffer
		if err := Reinstall(context.Background(), "dev", target, root, &output, &output); err != nil {
			t.Fatalf("%s: %v\n%s", runtime.GOOS, err, output.String())
		}
		version := "v5.13.0"
		if target == "ocr" {
			version = ""
		}
		if !strings.Contains(output.String(), "selected="+target+";version="+version+";dir="+root) {
			t.Fatalf("wrong installer arguments: %s", output.String())
		}
	}
}

func TestReinstallEnvOverridesInheritedSelection(t *testing.T) {
	got := reinstallEnv([]string{"PATH=bin", "MPELB_REINSTALL=ocr", "mpelb_reinstall_dir=old", "MPELB_MFW_VERSION=v1.0.0"}, "mfw", "target", "v5.13.0")
	want := []string{"PATH=bin", "MPELB_REINSTALL=mfw", "MPELB_REINSTALL_DIR=target", "MPELB_MFW_VERSION=v5.13.0"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %v, want %v", got, want)
	}
}

func TestDevelopmentSourceUsesLocalConfig(t *testing.T) {
	root := t.TempDir()
	for _, name := range []string{"Editor/src/stores/app/configStore.ts", "scripts/install/install.ps1"} {
		path := filepath.Join(root, filepath.FromSlash(name))
		if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte(`mfwVersion: "5.13.0",`), 0600); err != nil {
			t.Fatal(err)
		}
	}
	got, err := findSourceRoot(filepath.Join(root, "LocalBridge", "build"))
	if err != nil || got != root {
		t.Fatalf("got %q, %v", got, err)
	}
	matches := versionPattern.FindStringSubmatch(`mfwVersion: "5.13.0",`)
	if len(matches) != 2 || matches[1] != "5.13.0" {
		t.Fatalf("invalid version %v", matches)
	}
}

func TestReinstallRejectsInvalidTargetBeforeNetworkOrExecution(t *testing.T) {
	if err := Reinstall(context.Background(), "2.0.0", "unknown", t.TempDir(), io.Discard, io.Discard); err == nil {
		t.Fatal("expected invalid target error")
	}
}
