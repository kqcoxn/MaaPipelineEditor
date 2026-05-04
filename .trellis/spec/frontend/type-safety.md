# Type Safety

> Type safety patterns in this project.

---

## Overview

The frontend is TypeScript-first and runs with strict compiler settings from
`tsconfig.app.json`, including `strict`, `noUnusedLocals`,
`noUnusedParameters`, and `noFallthroughCasesInSwitch`.

The codebase is mostly strongly typed, but it still contains a few pragmatic
`any` escape hatches around legacy or highly dynamic pipeline payloads. Treat
those as compatibility boundaries to shrink over time, not as examples to copy.

---

## Type Organization

Current organization rules:

- Put domain contracts near the owning domain.
  Examples: `src/stores/flow/types.ts`, `src/features/debug/types.ts`,
  `src/wiki/types.ts`, `src/core/fields/types.ts`.
- Keep component-local prop interfaces in the component file when they are not
  shared elsewhere.
- Re-export types from boundary modules when consumers should not reach deep
  internal files directly.
  Examples: `src/stores/flow/index.ts`,
  `src/components/panels/main/node-list/index.ts`.
- Prefer named interfaces/types with domain meaning over anonymous object
  literals repeated across files.

---

## Validation

This repo does not currently use Zod, Yup, or io-ts. Runtime validation is
manual and localized.

Patterns in the existing code:

- normalize unknown persisted data with `typeof`, `Array.isArray`, and set
  membership checks
  Example: `src/stores/debugModalMemoryStore.ts`
- sanitize imported config payloads before merging them into state
  Example: `replaceConfig(...)` in `src/stores/configStore.ts`
- use schema-like `Record<string, ...>` maps for editable field definitions
  Example: `src/core/fields/recognition/schema.ts`

When a payload enters from storage, URL, websocket, or external protocol,
narrow it before storing or rendering it.

---

## Common Patterns

Common repo patterns:

- `Record<...>` maps for registries and schema tables
- literal unions for modes, panels, statuses, and categories
- `ReturnType<typeof ...>` to share controller contracts
  Example: `DebugModalController`
- generic store setters keyed by `keyof`
  Example: `setConfig` / `setStatus` in `configStore.ts`
- `as const` used sparingly when a React Flow or config literal must keep its
  exact type

Prefer `unknown` at the boundary and narrow it, rather than asserting a shape
immediately.

---

## Forbidden Patterns

Avoid these patterns in new code:

- new broad `any` usage unless the payload is genuinely open-ended and the
  boundary is documented
- `as SomeType` assertions used to bypass missing validation
- duplicating types that already exist in `src/stores`, `src/features`, or
  `src/core`
- widening unions to `string`/`number` when the repo already has a constrained
  mode/status type

Legacy `any` in files such as `src/stores/flow/types.ts` reflects existing
dynamic pipeline data. Do not spread that style into new feature code unless
you are working at the same dynamic boundary.

---

## Scenario: Debug Resource Health Contract

### 1. Scope / Trigger
- Trigger: debug-vNext adds a dedicated `/mpe/debug/resource/health` route plus frontend request/result state for the Resource Health panel.
- Why this needs code-spec depth: this is a cross-layer protocol and async state contract between `LocalBridge/internal/debug/protocol/types.go`, `src/features/debug/types.ts`, `DebugProtocolClient`, `debugSessionStore`, and the DebugModal hooks/panels.

### 2. Signatures
- Backend route:
  - request: `"/mpe/debug/resource/health"`
  - response: `"/lte/debug/resource_health"`
- Backend payloads:
  - `type ResourceHealthRequest struct { requestId, resourcePaths, graphSnapshot, resolverSnapshot, target }`
  - `type ResourceHealthResult struct { requestId, resourcePaths, status, hash, checkedAt, durationMs, diagnostics }`
- Frontend payloads:
  - `interface DebugResourceHealthRequest`
  - `interface DebugResourceHealthResult`
- Frontend state:
  - `DebugResourceHealthState { status, requestId, requestKey, result, error }`

### 3. Contracts
- Request fields:
  - `requestId?: string`
    - generated per outbound check request
    - used only for matching async responses, not for deriving cache identity
  - `resourcePaths: string[]`
    - the current normalized debug resource paths
  - `graphSnapshot: DebugGraphSnapshot`
    - current exported graph snapshot for static health checks
  - `resolverSnapshot: DebugNodeResolverSnapshot`
    - current runtime mapping snapshot for static health checks
  - `target?: DebugNodeTarget`
    - optional current entry/target node to verify target mapping integrity
- Response fields:
  - `status: "ready" | "failed"`
    - `ready` means resource-health scope passed
    - it does **not** mean full debug readiness
  - `hash?: string`
    - only present when MaaFW loading succeeds
  - `diagnostics?: DebugDiagnostic[]`
    - each diagnostic may carry category metadata in `data`
    - MaaFW real load is the authoritative pass/fail signal for resource validity
    - the current first-batch load-failure checklist (`debug.resource.pipeline_json_invalid`, `debug.resource.pipeline_node_name_duplicate`, with optional scan warnings such as `debug.resource.pipeline_file_unreadable`) is emitted only when `debug.resource.load_failed` occurs
    - that checklist scans the resolved resource bundle directories, especially `pipeline/**/*.json` and `pipeline/**/*.jsonc`, and should be categorized under `loading` as failure-narrowing evidence rather than post-success graph checks
    - graph-category diagnostics are reserved for snapshot / resolver / target legality checks
    - repair suggestions are diagnostic metadata, not auto-fix commands
- Store contract:
  - `requestKey` is the snapshot identity for the current draft request
  - `requestId` is the in-flight identity for one dispatched request
  - UI may render draft errors before a request is sent

### 4. Validation & Error Matrix
- missing `resourcePaths` -> health request may still be drafted, but backend returns failed diagnostics for empty resource input
- invalid or stale `graphSnapshot` / `resolverSnapshot` -> backend returns graph-category diagnostics
- response `requestId` does not match current store `requestId` -> frontend must drop the result
- same `requestKey`, new outbound request -> frontend must overwrite `requestId` and treat older responses as stale
- `status === "ready"` with controller/device/agent still broken -> Overview/readiness remains the source of truth; Resource Health panel must not claim overall run readiness

### 5. Good/Base/Bad Cases
- Good:
  - hook drafts a request from current normalized resources + snapshots
  - action generates a fresh `requestId`
  - store enters `checking`
  - matching response arrives and is committed
- Base:
  - request draft exists but contains a draft error
  - panel shows the draft error and does not pretend there is a valid result yet
- Bad:
  - frontend matches responses by `resourcePaths` or `requestKey` alone
  - late response from an older request overwrites the latest panel state

### 6. Tests Required
- Frontend state tests or targeted assertions:
  - stale `requestId` result does not mutate `resourceHealth`
  - matching `requestId` result stores `requestKey`, `status`, `result`, and first error text correctly
- Backend tests:
  - empty graph / duplicate resolver / invalid target produce graph-category diagnostics
  - successful MaaFW load includes `hash`, `checkedAt`, and categorized diagnostics without running the file anomaly checklist
  - MaaFW load failure expands loading-category diagnostics with resource-directory checklist results from resolved bundle roots, especially pipeline JSON/JSONC parse errors and duplicate node names
- Integration-level assertions for future refactors:
  - panel auto-check must only reuse an existing result when `requestKey` matches and the store is not idle

### 7. Wrong vs Correct
#### Wrong
```ts
setResourceHealthResult: (result) =>
  set((state) => ({
    resourceHealth: {
      status: result.status === "ready" ? "ready" : "error",
      requestKey: makeDebugResourceHealthRequestKeyFromResult(result),
      result,
    },
  }));
```

#### Correct
```ts
setResourceHealthResult: (result) =>
  set((state) => {
    const current = state.resourceHealth;
    if (!current.requestId || result.requestId !== current.requestId) {
      return {};
    }
    return {
      resourceHealth: {
        status: result.status === "ready" ? "ready" : "error",
        requestId: result.requestId,
        requestKey: current.requestKey,
        result,
      },
    };
  });
```
