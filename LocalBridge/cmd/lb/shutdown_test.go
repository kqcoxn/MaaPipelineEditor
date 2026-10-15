package main

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/logger"
	"github.com/kqcoxn/MaaPipelineEditor/LocalBridge/internal/managed"
)

func TestShutdownProcessHelper(t *testing.T) {
	dir := os.Getenv("MPE_SHUTDOWN_TEST_DIR")
	if dir == "" {
		return
	}
	if err := logger.Init("ERROR", dir, false); err != nil {
		t.Fatal(err)
	}
	lock, err := managed.Acquire(filepath.Join(dir, "service.lock"), false)
	if err != nil {
		t.Fatal(err)
	}
	defer lock.Close()
	mode := os.Getenv("MPE_SHUTDOWN_TEST_MODE")
	var resultErr error
	if mode == "failed" {
		resultErr = errors.New("server failed")
	}
	shutdown := func() error {
		if mode != "ready" {
			select {} // Simulate a native call that never returns.
		}
		return nil
	}
	if mode == "native" {
		shutdown = blockedNativeShutdown(t, dir)
	}
	shutdownFrameworkForExit(shutdown, resultErr)
	if err := os.WriteFile(filepath.Join(dir, "finalized"), []byte("clean"), 0600); err != nil {
		t.Fatal(err)
	}
}

func TestFrameworkExitDeadlineReleasesProcessAndPreservesFailure(t *testing.T) {
	modes := []string{"ready", "blocked", "failed"}
	if os.Getenv("MPE_MFW_TEST_LIB_DIR") != "" {
		modes = append(modes, "native")
	}
	for _, mode := range modes {
		t.Run(mode, func(t *testing.T) {
			t.Parallel()
			dir := t.TempDir()
			ctx, cancel := context.WithTimeout(context.Background(), 6*time.Second)
			defer cancel()
			cmd := exec.CommandContext(ctx, os.Args[0], "-test.run=^TestShutdownProcessHelper$")
			cmd.Env = append(os.Environ(), "MPE_SHUTDOWN_TEST_DIR="+dir, "MPE_SHUTDOWN_TEST_MODE="+mode)
			started := time.Now()
			output, err := cmd.CombinedOutput()
			elapsed := time.Since(started)
			t.Logf("process exited after %s", elapsed.Round(time.Millisecond))
			if ctx.Err() != nil {
				t.Fatalf("native cleanup still blocked process exit: %s", output)
			}
			if mode == "failed" {
				var exitErr *exec.ExitError
				if !errors.As(err, &exitErr) || exitErr.ExitCode() != 1 {
					t.Fatalf("original failure was not preserved: %v, %s", err, output)
				}
			} else if err != nil {
				t.Fatalf("stop failed: %v, %s", err, output)
			}
			_, finalErr := os.Stat(filepath.Join(dir, "finalized"))
			if mode == "ready" {
				if finalErr != nil || elapsed >= frameworkExitGrace {
					t.Fatalf("completed cleanup did not return immediately: %s, %v", elapsed, finalErr)
				}
			} else if !os.IsNotExist(finalErr) || elapsed < frameworkExitGrace {
				t.Fatalf("deadline continued unsafe finalization or exited too early: %s, %v", elapsed, finalErr)
			}
			// No defer released this lock in the deadline path. The kernel must
			// release it on exit so a replacement LocalBridge can start safely.
			lock, err := managed.Acquire(filepath.Join(dir, "service.lock"), false)
			if err != nil {
				t.Fatalf("exited process retained service identity: %v", err)
			}
			lock.Close()
		})
	}
}
