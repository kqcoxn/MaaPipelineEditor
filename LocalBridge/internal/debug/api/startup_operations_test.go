package api

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestStartupCancellationKeepsSlotUntilCleanup(t *testing.T) {
	var operations startupOperations
	disconnected := make(chan struct{})
	ctx, finish, err := operations.begin("agent", disconnected)
	if err != nil {
		t.Fatal(err)
	}
	close(disconnected)
	select {
	case <-ctx.Done():
	case <-time.After(time.Second):
		t.Fatal("disconnect did not cancel startup")
	}
	if !errors.Is(ctx.Err(), context.Canceled) {
		t.Fatal(ctx.Err())
	}
	if _, _, err := operations.begin("agent", nil); err == nil {
		t.Fatal("retry overlapped unfinished cleanup")
	}
	finish()
	ctx, finish, err = operations.begin("agent", nil)
	if err != nil {
		t.Fatal(err)
	}
	if ctx.Err() != nil {
		t.Fatal("old cancellation affected retry")
	}
	if !operations.cancel("agent", nil) || ctx.Err() == nil {
		t.Fatal("explicit stop did not cancel retry")
	}
	finish()
	operations.close()
	if _, _, err := operations.begin("agent", nil); err == nil {
		t.Fatal("accepted startup during shutdown")
	}
}
