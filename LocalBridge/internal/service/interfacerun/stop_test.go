package interfacerun

import (
	"context"
	"testing"

	maa "github.com/MaaXYZ/maa-framework-go/v4"
)

type polledJob struct {
	status func() maa.Status
}

func (j *polledJob) Status() maa.Status { return j.status() }
func (j *polledJob) Success() bool      { return j.Status().Success() }

func TestStopWaitsForNativeIdleAfterStopJobCompletes(t *testing.T) {
	checks, posts := 0, 0
	waitForTaskerStop(func() taskJob { posts++; return &fakeJob{maa.StatusSuccess} }, func() bool { checks++; return checks < 4 })
	if checks != 4 || posts != 1 {
		t.Fatalf("released while tasker was busy or posted duplicate stops: %d %d", checks, posts)
	}
}

func TestStopWaitsForPendingStopJobEvenWhenTaskerLooksIdle(t *testing.T) {
	checks, posts := 0, 0
	job := &polledJob{status: func() maa.Status {
		checks++
		if checks < 4 {
			return maa.StatusPending
		}
		return maa.StatusSuccess
	}}
	waitForTaskerStop(func() taskJob { posts++; return job }, func() bool { return false })
	if checks != 4 || posts != 1 {
		t.Fatalf("abandoned pending stop: %d %d", checks, posts)
	}
}

func TestStopRetriesRejectedSubmissionWithoutReleasingRunningTasker(t *testing.T) {
	posts := 0
	waitForTaskerStop(func() taskJob {
		posts++
		if posts == 1 {
			return &fakeJob{maa.StatusInvalid}
		}
		return &fakeJob{maa.StatusSuccess}
	}, func() bool { return posts < 2 })
	if posts != 2 {
		t.Fatalf("expected retry, got %d", posts)
	}
}

func TestStopIsIdempotentAndCannotCancelAnotherRun(t *testing.T) {
	s, _ := queueFixture()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	calls := 0
	s.cancel = func() { calls++; cancel() }
	s.state.RunID, s.state.Status = "run", "running"
	if err := s.Stop("other"); err == nil || ctx.Err() != nil {
		t.Fatal("stale stop canceled current run")
	}
	if err := s.Stop("run"); err != nil {
		t.Fatal(err)
	}
	if err := s.Stop("run"); err != nil || calls != 1 || s.Snapshot().Status != "stopping" {
		t.Fatalf("duplicate stop changed state: calls=%d err=%v", calls, err)
	}
	if len(s.Snapshot().Logs) != 0 {
		t.Fatal("stop status leaked into focus/print output")
	}
}

func TestCanceledExecutionFinishesWithoutInitializingNativeRuntime(t *testing.T) {
	s, plans := queueFixture()
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	done := make(chan struct{})
	released := false
	s.execute(ctx, plans, func() { released = true }, done)
	if !released || s.Snapshot().Status != "stopped" {
		t.Fatal("canceled startup did not finish")
	}
	for _, item := range s.Snapshot().Items {
		if item.Status != "skipped" {
			t.Fatal("pending queue item was not skipped")
		}
	}
	select {
	case <-done:
	default:
		t.Fatal("run lifecycle was not closed")
	}
}
