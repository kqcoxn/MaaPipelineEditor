package managed

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func isolateService(t *testing.T) {
	t.Helper()
	dir := t.TempDir()
	t.Setenv("APPDATA", dir)
	t.Setenv("XDG_CONFIG_HOME", dir)
	t.Setenv("HOME", dir)
}
func TestServiceIdentityAndGracefulStop(t *testing.T) {
	isolateService(t)
	s, err := Start("1.2.3", "/project", true)
	if err != nil {
		t.Fatal(err)
	}
	s.Ready("ws://127.0.0.1:9066")
	if other, err := Start("1.2.3", "/other", false); err == nil {
		other.Close()
		t.Fatal("duplicate instance accepted")
	}
	status, err := Query(context.Background())
	if err != nil || status.State != "ready" || status.Version != "1.2.3" {
		t.Fatalf("invalid status: %+v %v", status, err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	if err = Stop(ctx, "wrong-instance", false); err == nil {
		t.Fatal("accepted wrong instance")
	}
	data, _ := os.ReadFile(discoveryPath())
	var d discovery
	_ = json.Unmarshal(data, &d)
	resp, err := http.Get(d.Endpoint + "/status")
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != 403 {
		t.Fatal("accepted unauthenticated control")
	}
	done := make(chan struct{})
	go func() { <-s.Done(); s.Close(); close(done) }()
	if err = Stop(ctx, status.ID, false); err != nil {
		t.Fatal(err)
	}
	<-done
	if _, err = Query(ctx); !errors.Is(err, ErrNotRunning) {
		t.Fatal("stopped service still reported active", err)
	}
}
func TestStaleDiscoveryDoesNotBlockService(t *testing.T) {
	isolateService(t)
	_ = os.MkdirAll(Directory(), 0700)
	_ = os.WriteFile(filepath.Join(Directory(), "service.json"), []byte("stale"), 0600)
	if _, err := Query(context.Background()); !errors.Is(err, ErrNotRunning) {
		t.Fatal(err)
	}
	s, err := Start("test", "/project", false)
	if err != nil {
		t.Fatal(err)
	}
	s.Close()
}

func TestGracefulStopTimeoutRetainsTargetIdentity(t *testing.T) {
	isolateService(t)
	s, err := Start("test", "/project", false)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	status, err := Query(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 150*time.Millisecond)
	defer cancel()
	if err := Stop(ctx, status.ID, false); err == nil {
		t.Fatal("expected timeout while owner has not finished cleanup")
	}
	after, err := Query(context.Background())
	if err != nil || after.ID != status.ID || after.State != "stopping" {
		t.Fatalf("lost target identity after timeout: %+v %v", after, err)
	}
}

func TestServiceCloseCompletesInFlightResponse(t *testing.T) {
	isolateService(t)
	lock, err := Acquire(filepath.Join(Directory(), "service.lock"), false)
	if err != nil {
		t.Fatal(err)
	}
	defer lock.Close()
	entered := make(chan struct{})
	release := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		close(entered)
		<-release
		_ = json.NewEncoder(w).Encode(map[string]bool{"stopping": true})
	}))
	defer server.Close()
	shutdown := make(chan struct{})
	server.Config.RegisterOnShutdown(func() { close(shutdown) })
	s := &Service{lock: lock, server: server.Config, closed: make(chan struct{})}
	result := make(chan error, 1)
	go func() {
		response, err := server.Client().Post(server.URL, "application/json", nil)
		if err == nil {
			defer response.Body.Close()
			var body map[string]bool
			err = json.NewDecoder(response.Body).Decode(&body)
			if err == nil && !body["stopping"] {
				err = errors.New("missing stop acknowledgement")
			}
		}
		result <- err
	}()
	<-entered
	go s.Close()
	select {
	case <-shutdown:
	case <-s.Closed():
		t.Error("service closed before completing its response")
	case <-time.After(time.Second):
		t.Error("service did not begin shutdown")
	}
	close(release)
	if err := <-result; err != nil {
		t.Errorf("in-flight response was interrupted: %v", err)
	}
	<-s.Closed()
}
