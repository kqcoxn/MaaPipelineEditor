package managed

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
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
