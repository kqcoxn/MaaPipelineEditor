# brainstorm: debug image inspection operations

## Goal

Improve debug-vNext image inspection so users can zoom, pan, compare, and inspect image artifacts from live screenshots, recognition details, action details, node execution records, and fixed-image recognition results. This task is research/PRD only; implementation starts after review.

## What I Already Know

- Current MPE debug image UI can start/stop screenshot streaming, choose fixed image inputs, list artifacts, request an artifact, and preview the selected artifact.
- Current `DebugArtifactPreview` renders image payloads with `maxWidth/maxHeight` and a single optional box overlay, but has no zoom, pan, fullscreen, multi-overlay, or rich metadata support.
- MaaDebugger documents a stronger image workflow: screenshot stream pan/zoom/fullscreen, recognition raw/draw images, result-list hover highlighting, action coordinate drawing, and asynchronous image reference loading.
- MPE should keep debug-vNext principles: trace-first state, artifact refs, Modal-first UI, MPE node mapping, and no fake backend capabilities.

## Requirements

- Formal PRD is authored at `dev/design/debug-image-inspection-prd.md`.
- P0 should not require LocalBridge protocol changes unless implementation proves existing artifact metadata is insufficient.
- Image loading remains on demand through existing `requestArtifact(ref)`.
- The viewer must be reusable by `ImagesPanel`, node execution details, and artifact selectors.

## Acceptance Criteria

- [x] Research MaaDebugger image operation capabilities from local wiki docs.
- [x] Inspect current MPE debug image/artifact UI and design docs.
- [x] Write a PRD with goal, user stories, acceptance criteria, technical design, rollout phases, risks, and open questions.
- [x] User reviews and confirms scope before implementation.
- [x] Implement P0 reusable image viewer without backend/protocol changes.
- [x] Implement P1 overlay support for recognition/action attempt images from existing data.
- [x] Implement P2 ImagesPanel artifact filtering/check-table improvements from existing refs.
- [x] Revise interaction so inline image preview is a static thumbnail and all operations happen inside a dedicated image modal.
- [x] Research MaaDebugger RecognitionDrawCanvas source and port feasible ROI list/search/selection/focus controls to MPE.
- [x] Parse `detail.best` / `detail.filtered` / `detail.all` from recognition detail payload and expose grouped ROI controls.

## Out of Scope

- No implementation in this task.
- No `yarn dev`, browser test, or build run.
- No edits under `dev/instructions`.

## Technical Notes

- Main PRD: `dev/design/debug-image-inspection-prd.md`
- P0 implementation:
  - `src/features/debug/components/DebugImageViewer.tsx`
  - `src/features/debug/components/DebugImageRoiPanel.tsx`
  - `src/features/debug/components/DebugArtifactPreview.tsx`
  - `src/features/debug/components/DebugArtifactSelector.tsx`
  - `src/features/debug/components/panels/NodeExecutionAttemptFocus.tsx`
  - `src/features/debug/components/panels/ImagesPanel.tsx`
  - `src/features/debug/artifactDetailSummary.ts`
- MaaDebugger docs used:
  - `dev/instructions/.tmp/MaaDebugger-wiki/ScreenshotService.md`
  - `dev/instructions/.tmp/MaaDebugger-wiki/Index View Task Execution Panel.md`
  - `dev/instructions/.tmp/MaaDebugger-wiki/Index View Task Detail Panel.md`
  - `dev/instructions/.tmp/MaaDebugger-wiki/TaskerService  Task Execution.md`
- MPE files inspected:
  - `src/features/debug/components/panels/ImagesPanel.tsx`
  - `src/features/debug/components/DebugArtifactPreview.tsx`
  - `src/features/debug/components/DebugArtifactSelector.tsx`
  - `src/features/debug/artifactDetailSummary.ts`
  - `dev/design/debug-refactor-architecture.md`
  - `dev/design/debug-node-execution-panel-prd.md`
- MaaDebugger source inspected:
  - `web/src/views/Index/taskDetail/RecognitionDrawCanvas.vue`
  - `web/src/views/Index/taskDetail/RecoDetailModal.vue`
  - `web/src/views/Index/taskDetail/RecoDetailItem.vue`
  - `web/src/views/Index/taskDetail/ActionDrawCanvas.vue`
