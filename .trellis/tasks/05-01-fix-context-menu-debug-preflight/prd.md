# Fix context-menu debug preflight

## Goal

When the DebugModal has not been opened in the current page lifecycle, choosing a node context-menu debug run action should not immediately fail with "资源尚未通过加载检测". The context-menu path must align with DebugModal resource preflight behavior.

## What I Already Know

- User reports that right-clicking a node before opening the debug panel and selecting a debug run action shows the resource-not-ready error directly.
- The context-menu run path is implemented in `src/components/flow/nodes/nodeContextMenu.tsx`.
- DebugModal auto-runs resource preflight while open, using normalized resource paths and the current resource key.
- Existing project guidance says debug starts must require successful resource load and context menus must not bypass modal readiness rules.

## Requirements

- Keep node context-menu debug actions gated by LocalBridge, device/controller, run-mode capability, fixed-image input, and resource readiness.
- If resource preflight has not run for the current resource key, trigger the preflight from the context-menu path and avoid showing the resource-not-ready error as a failure.
- If resource preflight is already checking, show a waiting/in-progress prompt rather than an error.
- If resource preflight explicitly failed, continue surfacing the resource error.
- Keep scope to the frontend context-menu/debug readiness path.

## Acceptance Criteria

- [ ] Selecting a node debug run from the context menu before opening DebugModal starts resource preflight instead of immediately showing "资源尚未通过加载检测".
- [ ] Selecting a node debug run while preflight is checking does not send a debug run request.
- [ ] Selecting a node debug run after successful preflight still starts the requested run.
- [ ] Selecting a node debug run after failed preflight still blocks and reports the resource failure.
- [ ] No backend/API compatibility work is introduced.

## Out Of Scope

- Durable pending-run queues or automatically launching the debug run after async preflight completion.
- Backend LocalBridge changes.
- New generated test scripts or documentation outside this task PRD.

## Technical Notes

- Relevant files inspected: `src/components/flow/nodes/nodeContextMenu.tsx`, `src/features/debug/hooks/useDebugModalController.ts`, `src/features/debug/readiness.ts`, `src/stores/debugSessionStore.ts`, `src/stores/debugRunProfileStore.ts`.
- DebugModal computes resource key with `makeDebugResourceKey(profile.resourcePaths, resourceBundles)`; the context-menu path should use the same default bundle-aware normalization rather than only explicit profile paths.
- Validation should stay lightweight per project instruction: syntax/lint-focused checks, no `yarn dev`, no browser testing.

## Completion Record

- Updated `src/components/flow/nodes/nodeContextMenu.tsx` so context-menu debug starts treat resource `idle` / mismatched state as "request preflight and wait" instead of a hard resource-not-ready error.
- Preserved hard blocking for disconnected LocalBridge/device, unsupported run modes, missing fixed-image input, and explicit resource preflight errors.
- Validation: file-level ESLint and TypeScript `--noEmit` passed via bundled Node runtime.
