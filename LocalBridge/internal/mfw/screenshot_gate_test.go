package mfw

import (
	"runtime"
	"testing"
	"time"
)

func TestScreenshotGateActiveCaptureTakesOverBackgroundFrame(t *testing.T) {
	var gate screenshotGate
	flight, ok := gate.beginBackground()
	if !ok {
		t.Fatal("background capture failed to acquire an idle gate")
	}

	mode, claimedFlight := gate.beginActive()
	if mode != screenshotAcquireTakeover || claimedFlight != flight {
		t.Fatalf("active capture mode = %v, want takeover of current background flight", mode)
	}
	if secondMode, _ := gate.beginActive(); secondMode != screenshotAcquireRejected {
		t.Fatalf("second active capture mode = %v, want rejected", secondMode)
	}

	outcome := screenshotCaptureOutcome{failure: "captured"}
	if claimed := gate.finishBackground(flight, outcome); !claimed {
		t.Fatal("background capture was not marked as claimed")
	}
	<-flight.done
	if nextMode, _ := gate.beginActive(); nextMode != screenshotAcquireRejected {
		t.Fatalf("active capture during takeover consumption = %v, want rejected", nextMode)
	}
	if flight.outcome.failure != outcome.failure {
		t.Fatalf("claimed outcome = %q, want %q", flight.outcome.failure, outcome.failure)
	}
	gate.finishActive()
	if nextMode, _ := gate.beginActive(); nextMode != screenshotAcquireOwned {
		t.Fatalf("active capture after takeover completion = %v, want owned", nextMode)
	}
	gate.finishActive()
}

func TestScreenshotGateActiveCapturesDoNotShareEachOther(t *testing.T) {
	var gate screenshotGate
	mode, flight := gate.beginActive()
	if mode != screenshotAcquireOwned || flight != nil {
		t.Fatalf("first active capture mode = %v, want owned", mode)
	}
	if secondMode, _ := gate.beginActive(); secondMode != screenshotAcquireRejected {
		t.Fatalf("second active capture mode = %v, want rejected", secondMode)
	}
	if _, ok := gate.beginBackground(); ok {
		t.Fatal("background capture started while an active capture was running")
	}
	gate.finishActive()
}

func TestScreenshotGateBackgroundDoesNotOvertakeWaitingActiveOperation(t *testing.T) {
	var gate screenshotGate
	flight, ok := gate.beginBackground()
	if !ok {
		t.Fatal("initial background capture failed to acquire an idle gate")
	}

	activeAcquired := make(chan struct{})
	releaseActive := make(chan struct{})
	activeReleased := make(chan struct{})
	go func() {
		gate.acquireActiveOperation()
		close(activeAcquired)
		<-releaseActive
		gate.finishActiveOperation()
		close(activeReleased)
	}()

	deadline := time.After(time.Second)
	for gate.activeReservations.Load() == 0 {
		select {
		case <-deadline:
			t.Fatal("active operation did not reserve the gate")
		default:
			runtime.Gosched()
		}
	}

	if claimed := gate.finishBackground(flight, screenshotCaptureOutcome{}); claimed {
		t.Fatal("unclaimed background capture was marked as claimed")
	}
	if _, ok := gate.beginBackground(); ok {
		t.Fatal("background capture overtook a waiting active operation")
	}

	select {
	case <-activeAcquired:
		close(releaseActive)
	case <-time.After(time.Second):
		t.Fatal("waiting active operation did not acquire the released gate")
	}

	select {
	case <-activeReleased:
	case <-time.After(time.Second):
		t.Fatal("active operation did not release the gate")
	}
}
