package runtime

import (
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	maa "github.com/MaaXYZ/maa-framework-go/v4"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/mfw"
)

// Uses the real native queue: PostStop clears the original job's completion
// state while its callback is still running. No device or user input is used.
func TestNativeRuntimeStopDrainsCallbacks(t *testing.T) {
	lib := os.Getenv("MPE_MFW_TEST_LIB_DIR")
	if lib == "" {
		t.Skip("requires MPE_MFW_TEST_LIB_DIR")
	}
	if err := logger.Init("ERROR", "", false); err != nil {
		t.Fatal(err)
	}
	if err := maa.Init(maa.WithLibDir(lib), maa.WithLogDir(t.TempDir()), maa.WithStdoutLevel(maa.LoggingLevelOff)); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := maa.Release(); err != nil {
			t.Errorf("release: %v", err)
		}
	})
	t.Logf("loaded %s", maa.Version())

	controller, err := maa.NewCustomController(&maa.BlankController{})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := controller.Destroy(); err != nil {
			t.Errorf("destroy: %v", err)
		}
	})
	if !controller.PostConnect().Wait().Success() {
		t.Fatal("connect failed")
	}
	resource, err := maa.NewResource()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := resource.Destroy(); err != nil {
			t.Errorf("destroy: %v", err)
		}
	})
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "pipeline"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "pipeline", "main.json"), []byte(`{"Seed":{"recognition":"DirectHit","action":"DoNothing","post_delay":0}}`), 0644); err != nil {
		t.Fatal(err)
	}
	if !resource.PostBundle(root).Wait().Success() {
		t.Fatal("bundle failed")
	}

	newRuntime := func(t *testing.T) *Runtime {
		t.Helper()
		adapter := mfw.NewMaaFWAdapter()
		adapter.SetController(controller, "Custom", "test")
		adapter.SetBorrowedResource(resource)
		if err := adapter.InitTasker(); err != nil {
			t.Fatal(err)
		}
		r := &Runtime{adapter: adapter}
		t.Cleanup(r.Destroy)
		return r
	}
	for _, operation := range []string{"wait", "destroy", "late-stop"} {
		t.Run(operation, func(t *testing.T) {
			r := newRuntime(t)
			tasker := r.adapter.GetTasker()
			entered, release := make(chan struct{}), make(chan struct{})
			stopEntered, stopRelease := make(chan struct{}), make(chan struct{})
			var releaseOnce, stopReleaseOnce sync.Once
			unblock := func() { releaseOnce.Do(func() { close(release) }) }
			unblockStop := func() { stopReleaseOnce.Do(func() { close(stopRelease) }) }
			r.taskerSinkID = tasker.OnTaskerTask(func(event maa.EventStatus, detail maa.TaskerTaskDetail) {
				if event != maa.EventStatusStarting {
					return
				}
				if detail.Entry == "MaaTaskerPostStop" {
					close(stopEntered)
					<-stopRelease
				} else {
					close(entered)
					<-release
				}
			})
			t.Cleanup(func() {
				unblock()
				unblockStop()
				// Also keep a failing regression run safe on the old implementation.
				if r.adapter != nil {
					for tasker.Running() {
						time.Sleep(time.Millisecond)
					}
					r.Destroy()
				}
			})
			r.taskJob, err = r.adapter.PostTask("Seed")
			if err != nil {
				t.Fatal(err)
			}
			awaitNativeSignal(t, entered)
			if operation == "late-stop" {
				unblock()
				if result := r.Wait(); !result.OK || result.Status != "success" || result.Err != nil {
					t.Fatalf("natural completion lost its result: %+v", result)
				}
			}
			stopped := make(chan struct{})
			go func() {
				if err := r.Stop(); err != nil {
					t.Error(err)
				}
				close(stopped)
			}()
			awaitNativeSignal(t, stopped) // Stop must acknowledge without waiting for callbacks.
			finished := make(chan struct{})
			go func() {
				if operation == "wait" {
					r.Wait()
				} else {
					r.Destroy()
				}
				close(finished)
			}()
			if operation != "late-stop" {
				assertNativePending(t, finished, "active task callback")
			}
			unblock()
			awaitNativeSignal(t, stopEntered)
			// A second stop must not clear the queued stop barrier or submit another
			// stop task (which would invoke the callback a second time).
			if err := r.Stop(); err != nil {
				t.Fatal(err)
			}
			assertNativePending(t, finished, "stop task callback")
			unblockStop()
			awaitNativeSignal(t, finished)
			r.Destroy()
			if err := r.Stop(); err != nil {
				t.Fatal(err)
			}
		})
	}
	t.Run("failure", func(t *testing.T) {
		r := newRuntime(t)
		r.taskJob, err = r.adapter.PostTask("Seed", `{"Seed":{"action":{"type":"Custom","param":{"custom_action":"Unregistered"}}}}`)
		if err != nil {
			t.Fatal(err)
		}
		if result := r.Wait(); result.OK || result.Status != "failure" {
			t.Fatalf("task failure lost its result: %+v", result)
		}
	})
}

func awaitNativeSignal(t *testing.T, signal <-chan struct{}) {
	t.Helper()
	select {
	case <-signal:
	case <-time.After(5 * time.Second):
		t.Fatal("native lifecycle operation timed out")
	}
}

func assertNativePending(t *testing.T, signal <-chan struct{}, stage string) {
	t.Helper()
	select {
	case <-signal:
		t.Errorf("runtime released before %s returned", stage)
	case <-time.After(100 * time.Millisecond):
	}
}
