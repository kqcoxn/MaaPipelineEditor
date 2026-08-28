package mfw

import (
	"sync"
	"sync/atomic"
)

type screenshotAcquireMode uint8

const (
	screenshotAcquireRejected screenshotAcquireMode = iota
	screenshotAcquireOwned
	screenshotAcquireTakeover
)

type screenshotOwner uint8

const (
	screenshotOwnerNone screenshotOwner = iota
	screenshotOwnerBackground
	screenshotOwnerActive
)

type screenshotFlight struct {
	done    chan struct{}
	claimed bool
	outcome screenshotCaptureOutcome
}

// screenshotGate gives the first active request ownership of an in-flight
// background frame while keeping active-to-active collisions non-blocking.
type screenshotGate struct {
	operationMu        sync.Mutex
	stateMu            sync.Mutex
	owner              screenshotOwner
	background         *screenshotFlight
	activeReservations atomic.Int32
}

func (g *screenshotGate) beginBackground() (*screenshotFlight, bool) {
	g.stateMu.Lock()
	defer g.stateMu.Unlock()

	if g.activeReservations.Load() > 0 || g.owner != screenshotOwnerNone || !g.operationMu.TryLock() {
		return nil, false
	}
	flight := &screenshotFlight{done: make(chan struct{})}
	g.owner = screenshotOwnerBackground
	g.background = flight
	return flight, true
}

func (g *screenshotGate) beginActive() (screenshotAcquireMode, *screenshotFlight) {
	g.stateMu.Lock()
	defer g.stateMu.Unlock()

	switch g.owner {
	case screenshotOwnerBackground:
		if g.background == nil || g.background.claimed {
			return screenshotAcquireRejected, nil
		}
		g.background.claimed = true
		return screenshotAcquireTakeover, g.background
	case screenshotOwnerActive:
		return screenshotAcquireRejected, nil
	case screenshotOwnerNone:
		if !g.operationMu.TryLock() {
			return screenshotAcquireRejected, nil
		}
		g.owner = screenshotOwnerActive
		return screenshotAcquireOwned, nil
	default:
		return screenshotAcquireRejected, nil
	}
}

func (g *screenshotGate) finishBackground(flight *screenshotFlight, outcome screenshotCaptureOutcome) bool {
	g.stateMu.Lock()
	if g.owner != screenshotOwnerBackground || g.background != flight {
		g.stateMu.Unlock()
		panic("finishing an inactive background screenshot flight")
	}
	flight.outcome = outcome
	claimed := flight.claimed
	g.background = nil
	if claimed {
		// The active claimant keeps the operation lock until it has consumed
		// and encoded this frame, so another active request still sees busy.
		g.owner = screenshotOwnerActive
	} else {
		g.owner = screenshotOwnerNone
	}
	close(flight.done)
	g.stateMu.Unlock()
	if !claimed {
		g.operationMu.Unlock()
	}
	return claimed
}

func (g *screenshotGate) finishActive() {
	g.stateMu.Lock()
	if g.owner != screenshotOwnerActive {
		g.stateMu.Unlock()
		panic("finishing an inactive screenshot operation")
	}
	g.owner = screenshotOwnerNone
	g.stateMu.Unlock()
	g.operationMu.Unlock()
}

func (g *screenshotGate) acquireActiveOperation() {
	g.activeReservations.Add(1)
	g.operationMu.Lock()
	g.stateMu.Lock()
	g.owner = screenshotOwnerActive
	g.stateMu.Unlock()
	g.activeReservations.Add(-1)
}

func (g *screenshotGate) finishActiveOperation() {
	g.finishActive()
}
