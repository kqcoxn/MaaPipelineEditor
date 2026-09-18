package main

import (
	"os"
	"testing"
	"time"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/managed"
)

func TestOwnerPipeEOFStopsManagedService(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("APPDATA", dir)
	t.Setenv("XDG_CONFIG_HOME", dir)
	t.Setenv("HOME", dir)
	s, err := managed.Start("test", dir, true)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	defer r.Close()
	previous, previousMode := os.Stdin, managedMode
	os.Stdin, managedMode = r, true
	defer func() { os.Stdin, managedMode = previous, previousMode }()
	watchOwner(s)
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	select {
	case <-s.Done():
	case <-time.After(2 * time.Second):
		t.Fatal("lost owner pipe did not request cleanup")
	}
}
