# State Management

> How state is managed in this project.

---

## Overview

<!--
Document your project's state management conventions here.

Questions to answer:
- What state management solution do you use?
- How is local vs global state decided?
- How do you handle server state?
- What are the patterns for derived state?
-->

(To be filled by the team)

---

## State Categories

<!-- Local state, global state, server state, URL state -->

(To be filled by the team)

---

## When to Use Global State

<!-- Criteria for promoting state to global -->

(To be filled by the team)

---

## Server State

<!-- How server data is cached and synchronized -->

(To be filled by the team)

---

## Scenario: Debug Performance Summary Artifact Synchronization

### 1. Scope / Trigger

- Trigger: Debug terminal run events and `performance-summary` artifacts are produced by LocalBridge but drive frontend Zustand state in `debugTraceStore` and `debugArtifactStore`.
- Applies when changing debug event ingestion, artifact loading, or performance summary generation/display.

### 2. Signatures

- Incoming event route: `/lte/debug/event`
- Artifact route: `/lte/debug/artifact`
- Terminal performance event fields:
  - `detailRef: string`
  - `data.performanceSummaryRef: string`
- Artifact payload:
  - `ref.type: "performance-summary"`
  - `data: DebugPerformanceSummary`

### 3. Contracts

- The terminal `session` event for a run must be appended to trace before the backend builds the `performance-summary` artifact, so summary `completedAt`, `status`, and `durationMs` include the terminal state.
- The terminal event sent to the frontend must contain the same artifact id in both `detailRef` and `data.performanceSummaryRef`.
- Frontend event handling must upsert `detailRef` into `debugArtifactStore`, auto-request the artifact when `data.performanceSummaryRef === detailRef`, and set `debugTraceStore.performanceSummary` only after the artifact payload is loaded and type-checked.

### 4. Validation & Error Matrix

- Missing terminal event before summary build -> `durationMs` may remain `0`; fix backend event ordering.
- Missing `detailRef` or mismatched `performanceSummaryRef` -> frontend cannot auto-load the summary artifact.
- Artifact payload missing `DebugPerformanceSummary` shape -> do not update `debugTraceStore.performanceSummary`.

### 5. Good/Base/Bad Cases

- Good: completed/failed/stopped terminal event is stored, summary artifact is generated, terminal event is backfilled with the artifact ref, then the updated event is sent to the frontend.
- Base: artifact generation fails; the terminal event is still sent without a summary ref.
- Bad: summary artifact is generated before the terminal event is stored.

### 6. Tests Required

- Backend trace tests should assert appended events cannot be externally mutated and detail refs can be attached to a stable `sessionId + seq`.
- Backend performance tests or package tests should cover summary construction after terminal events are present.
- Frontend lint should cover panel changes that consume `performanceSummary` or selected artifacts.

### 7. Wrong vs Correct

#### Wrong

```go
performanceRef := storePerformanceSummary(run)
emit(terminalEventWith(performanceRef))
```

#### Correct

```go
terminalEvent := appendTerminalEvent(run)
performanceRef := storePerformanceSummary(run)
updatedEvent := attachDetailRef(terminalEvent, performanceRef)
send(updatedEvent)
```

---

## Common Mistakes

<!-- State management mistakes your team has made -->

(To be filled by the team)
