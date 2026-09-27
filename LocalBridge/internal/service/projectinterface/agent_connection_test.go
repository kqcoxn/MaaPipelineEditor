package projectinterface

import (
	"context"
	"errors"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestAgentStartupWait(t *testing.T) {
	t.Run("waits for readiness instead of treating initial unavailability as failure", func(t *testing.T) {
		var ready atomic.Bool
		observed := make(chan struct{}, 1)
		done := make(chan error, 1)
		go func() {
			done <- waitForAgentReady(context.Background(), func() bool {
				select {
				case observed <- struct{}{}:
				default:
				}
				return ready.Load()
			}, func() error { return nil }, time.Second, time.Millisecond)
		}()
		<-observed
		select {
		case err := <-done:
			t.Fatalf("returned before ready: %v", err)
		default:
		}
		ready.Store(true)
		if err := <-done; err != nil {
			t.Fatal(err)
		}
	})
	t.Run("process failure wins over readiness", func(t *testing.T) {
		exitErr := errors.New("process exited with code 7")
		if err := waitForAgentReady(context.Background(), func() bool { return true }, func() error { return exitErr }, time.Second, time.Millisecond); !errors.Is(err, exitErr) {
			t.Fatal(err)
		}
	})
	t.Run("cancel interrupts a long startup", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		observed := make(chan struct{})
		done := make(chan error, 1)
		go func() {
			done <- waitForAgentReady(ctx, func() bool {
				select {
				case <-observed:
				default:
					close(observed)
				}
				return false
			}, func() error { return nil }, AgentStartupTimeout, time.Millisecond)
		}()
		<-observed
		cancel()
		select {
		case err := <-done:
			if !errors.Is(err, context.Canceled) {
				t.Fatal(err)
			}
		case <-time.After(time.Second):
			t.Fatal("cancel did not interrupt startup")
		}
	})
	t.Run("bounded startup", func(t *testing.T) {
		err := waitForAgentReady(context.Background(), func() bool { return false }, func() error { return nil }, 10*time.Millisecond, time.Millisecond)
		if err == nil || !strings.Contains(err.Error(), "启动准备超时") {
			t.Fatal(err)
		}
	})
}
