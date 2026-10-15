package router

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/server"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/pkg/models"
)

type shutdownHandler struct {
	path string
	run  func()
}

func (h *shutdownHandler) GetRoutePrefix() []string { return []string{h.path} }
func (h *shutdownHandler) Handle(models.Message, *server.Connection) *models.Message {
	h.run()
	return nil
}

func TestStopDrainsAcceptedSaveAndRejectsNewRequestsWithoutWaitingForDevice(t *testing.T) {
	if err := logger.Init("ERROR", "", false); err != nil {
		t.Fatal(err)
	}
	r := New()
	path := filepath.Join(t.TempDir(), "pipeline.json")
	writing, finishWrite := make(chan struct{}), make(chan struct{})
	saved := make(chan error, 1)
	r.RegisterHandler(&shutdownHandler{path: "/save", run: func() {
		file, err := os.Create(path)
		if err != nil {
			saved <- err
			close(writing)
			return
		}
		defer file.Close()
		_, err = file.WriteString(`{"Node":`)
		close(writing)
		<-finishWrite
		if err == nil {
			_, err = file.WriteString(`{"action":"DoNothing"}}`)
		}
		saved <- err
	}})
	deviceStarted, finishDevice, deviceDone := make(chan struct{}), make(chan struct{}), make(chan struct{})
	r.RegisterRuntimeHandler(&shutdownHandler{path: "/screenshot", run: func() {
		close(deviceStarted)
		<-finishDevice
	}})
	go r.Route(models.Message{Path: "/save"}, nil)
	go func() {
		r.Route(models.Message{Path: "/screenshot"}, nil)
		close(deviceDone)
	}()
	<-writing
	<-deviceStarted
	t.Cleanup(func() { close(finishDevice); <-deviceDone })
	stopped := make(chan struct{})
	go func() { r.Stop(); close(stopped) }()
	deadline := time.Now().Add(time.Second)
	for {
		r.lifecycleMu.Lock()
		stopping := r.stopping
		r.lifecycleMu.Unlock()
		if stopping {
			break
		}
		if time.Now().After(deadline) {
			close(finishWrite)
			t.Fatal("router did not begin shutdown")
		}
		time.Sleep(time.Millisecond)
	}
	select {
	case <-stopped:
		t.Error("shutdown completed while a file was partially written")
	default:
	}
	// These would reopen/truncate the file or re-enter the blocked device
	// handler if admission were allowed after shutdown began.
	r.Route(models.Message{Path: "/save"}, nil)
	r.Route(models.Message{Path: "/screenshot"}, nil)
	close(finishWrite)
	select {
	case <-stopped:
	case <-time.After(time.Second):
		t.Fatal("shutdown waited for a device request after the save finished")
	}
	if err := <-saved; err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(path)
	if err != nil || string(data) != `{"Node":{"action":"DoNothing"}}` {
		t.Fatalf("saved file was not complete: %q, %v", data, err)
	}
	r.Stop() // Repeated shutdown must remain safe.
}
