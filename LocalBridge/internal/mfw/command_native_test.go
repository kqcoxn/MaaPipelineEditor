package mfw

import (
	"context"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	maa "github.com/MaaXYZ/maa-framework-go/v4"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/managed"
)

// Opt-in real DLL + Python regression: each case owns a separate process so
// global stdin replacement and native initialization cannot affect other tests.
func TestNativeCommandRegression(t *testing.T) {
	lib := os.Getenv("MPE_MFW_TEST_LIB_DIR")
	if lib == "" {
		t.Skip("requires MPE_MFW_TEST_LIB_DIR and Python")
	}
	if scenario := os.Getenv("MPE_COMMAND_TEST_CASE"); scenario != "" {
		runCommandChild(t, lib, scenario)
		return
	}
	python, err := exec.LookPath("python")
	if err != nil {
		t.Fatal(err)
	}
	root := t.TempDir()
	venv := filepath.Join(root, "venv")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if out, err := exec.CommandContext(ctx, python, "-m", "venv", "--without-pip", venv).CombinedOutput(); err != nil {
		t.Fatalf("venv: %v %s", err, out)
	}
	python = filepath.Join(venv, "Scripts", "python.exe")
	if _, err := os.Stat(python); err != nil {
		python = filepath.Join(venv, "bin", "python")
	}
	for _, scenario := range []string{"managed-stdin", "stop-pending"} {
		t.Run(scenario, func(t *testing.T) {
			dir := t.TempDir()
			ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
			defer cancel()
			cmd := exec.CommandContext(ctx, os.Args[0], "-test.run=^TestNativeCommandRegression$", "-test.v")
			cmd.Env = append(os.Environ(), "MPE_COMMAND_TEST_CASE="+scenario, "MPE_COMMAND_TEST_DIR="+dir, "MPE_COMMAND_TEST_PYTHON="+python)
			input, err := cmd.StdinPipe()
			if err != nil {
				t.Fatal(err)
			}
			defer input.Close()
			log, err := os.Create(filepath.Join(dir, "child.log"))
			if err != nil {
				t.Fatal(err)
			}
			defer log.Close()
			cmd.Stdout, cmd.Stderr = log, log
			if err := cmd.Start(); err != nil {
				t.Fatal(err)
			}
			done := make(chan error, 1)
			go func() { done <- cmd.Wait() }()
			ticker := time.NewTicker(20 * time.Millisecond)
			defer ticker.Stop()
			for {
				select {
				case err := <-done:
					data, _ := os.ReadFile(filepath.Join(dir, "child.log"))
					if err != nil {
						t.Fatalf("%v\n%s", err, data)
					}
					if _, err := os.Stat(filepath.Join(dir, "completed")); err != nil {
						t.Fatal("native task never completed")
					}
					t.Log(string(data))
					return
				case <-ticker.C:
					// Keep owner alive until the native Command has completed.
					if _, err := os.Stat(filepath.Join(dir, "completed")); err == nil {
						input.Close()
					}
				}
			}
		})
	}
}

func runCommandChild(t *testing.T, lib, scenario string) {
	owner, err := managed.DetachOwnerInput()
	if err != nil {
		t.Fatal(err)
	}
	defer owner.Close()
	dir, python := os.Getenv("MPE_COMMAND_TEST_DIR"), os.Getenv("MPE_COMMAND_TEST_PYTHON")
	if err := logger.Init("ERROR", "", false); err != nil {
		t.Fatal(err)
	}
	if err := maa.Init(maa.WithLibDir(lib), maa.WithLogDir(dir), maa.WithStdoutLevel(maa.LoggingLevelOff)); err != nil {
		t.Fatal(err)
	}
	defer maa.Release()
	t.Logf("loaded %s", maa.Version())
	controller, err := maa.NewCustomController(&maa.BlankController{})
	if err != nil {
		t.Fatal(err)
	}
	defer controller.Destroy()
	if !controller.PostConnect().Wait().Success() {
		t.Fatal("connect")
	}
	resource, err := maa.NewResource()
	if err != nil {
		t.Fatal(err)
	}
	defer resource.Destroy()
	root := filepath.Join(dir, "resource 中文 space")
	if err := os.MkdirAll(filepath.Join(root, "pipeline"), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "pipeline", "main.json"), []byte(`{"Seed":{}}`), 0600); err != nil {
		t.Fatal(err)
	}
	if !resource.PostBundle(root).Wait().Success() {
		t.Fatal("bundle")
	}
	adapter := NewMaaFWAdapter()
	adapter.SetController(controller, "Custom", "test")
	adapter.SetBorrowedResource(resource)
	defer adapter.Destroy()
	if err := adapter.InitTasker(); err != nil {
		t.Fatal(err)
	}
	script := "import sys,json\nassert sys.stdin.read() == ''\nassert json.loads(sys.argv[1]) == [0,0,0,0]\n"
	marker := filepath.Join(dir, "started")
	release := filepath.Join(dir, "release")
	if scenario == "stop-pending" {
		script = "import pathlib,time,sys\npathlib.Path(sys.argv[2]).write_text('started')\nwhile not pathlib.Path(sys.argv[3]).exists(): time.sleep(0.01)\n"
	}
	// A completion marker verifies the Python body, because MFW Command does
	// not turn a nonzero process exit code into an action failure.
	script += "import pathlib\npathlib.Path(sys.argv[4]).write_text('done')\n"
	if err := os.WriteFile(filepath.Join(root, "probe.py"), []byte(script), 0600); err != nil {
		t.Fatal(err)
	}
	pipeline := map[string]any{"Probe": map[string]any{"recognition": "DirectHit", "action": map[string]any{"type": "Command", "param": map[string]any{"exec": python, "args": []string{"{RESOURCE_DIR}/probe.py", "{BOX}", marker, release, filepath.Join(dir, "python-done")}, "detach": false}}, "pre_delay": 0, "post_delay": 0}}
	job, err := adapter.PostTask("Probe", pipeline)
	if err != nil {
		t.Fatal(err)
	}
	if scenario == "stop-pending" {
		deadline := time.Now().Add(5 * time.Second)
		for {
			if _, err := os.Stat(marker); err == nil {
				break
			}
			if time.Now().After(deadline) {
				t.Fatal("Python never started")
			}
			time.Sleep(10 * time.Millisecond)
		}
		defer os.WriteFile(release, []byte("release"), 0600)
		start := time.Now()
		stop, err := adapter.RequestStop()
		if err != nil {
			t.Fatal(err)
		}
		if time.Since(start) > time.Second {
			t.Fatal("stop request blocked")
		}
		if job.Done() || stop.Done() {
			t.Fatal("reported completion while Python still running")
		}
		if err := os.WriteFile(release, []byte("release"), 0600); err != nil {
			t.Fatal(err)
		}
		if !stop.Wait().Success() {
			t.Fatal("stop did not complete after Python exit")
		}
	}
	job.Wait()
	if _, err := os.Stat(filepath.Join(dir, "python-done")); err != nil {
		t.Fatal("Python did not reach end")
	}
	if err := os.WriteFile(filepath.Join(dir, "completed"), []byte("done"), 0600); err != nil {
		t.Fatal(err)
	}
	// Owner EOF must still be observable after native children finish.
	if _, err := io.Copy(io.Discard, owner); err != nil {
		t.Fatal(err)
	}
}
