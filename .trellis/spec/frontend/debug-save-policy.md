# Debug Save Policy Contract

## 1. Scope / Trigger

- Trigger: Debug run start changed the cross-layer contract between frontend request building and LocalBridge runtime loading.
- Applies when touching:
  - `src/stores/debugRunProfileStore.ts`
  - `src/features/debug/snapshot.ts`
  - `src/features/debug/hooks/useDebugModalController.ts`
  - `LocalBridge/internal/debug/protocol/types.go`
  - `LocalBridge/internal/debug/runtime/runtime.go`

## 2. Signatures

- Frontend target type:
  - `DebugNodeTarget { fileId: string; nodeId: string; runtimeName: string; sourcePath?: string }`
- Backend target type:
  - `protocol.NodeTarget { fileId, nodeId, runtimeName, sourcePath? }`
- Run start entrypoint:
  - `useDebugModalController.startRun(mode, nodeId?, input?)`
- Runtime override resolver:
  - `runtime.PipelineOverride(root string, req protocol.RunRequest) (map[string]interface{}, error)`

## 3. Contracts

- `savePolicy: "sandbox"`
  - Use the selected file snapshot from `graphSnapshot.files`.
  - Must not flatten every opened file into one runtime override.
  - If the selected file is not in the snapshot and `sourcePath` exists, disk fallback is allowed.
- `savePolicy: "save-open-files"`
  - Frontend must save opened local files before sending the debug run request.
  - Backend must load the selected target file from disk after the save step.
- `savePolicy: "use-disk"`
  - Frontend must not auto-save.
  - Backend must load the selected target file from disk.
- `sourcePath`
  - Optional on stored targets, but should be populated when a resolver node has a disk-backed source path.
  - Backend should prefer `target.sourcePath`, then `profile.entry.sourcePath`, then `graphSnapshot.files[*].path`.

## 4. Validation & Error Matrix

- Missing `profile.resourcePaths` -> reject run request.
- Unsupported `savePolicy` -> reject run request.
- `save-open-files` or `use-disk` without a resolvable disk path -> runtime start must fail with a clear disk-path error.
- `sandbox` without a matching file snapshot and without fallback `sourcePath` -> runtime start must fail with a clear snapshot error.
- Selected file snapshot found -> only that file's pipeline may enter the runtime override map.

## 5. Good / Base / Bad Cases

- Good:
  - User selects a node in `shop.json`, keeps `sandbox`, and runtime override contains only `shop.json` pipeline content.
- Base:
  - User selects `save-open-files`, opened files are saved first, and LocalBridge reloads the selected target from disk.
- Bad:
  - Backend flattens all opened files from `graphSnapshot.files` into one override map and lets unrelated files overwrite the current target.

## 6. Tests Required

- Go unit tests for `runtime.PipelineOverride(...)`
  - Assert `sandbox` uses only the selected snapshot file.
  - Assert `use-disk` prefers disk content over stale snapshot content.
- Frontend verification
  - Targeted eslint on touched debug files.
  - If `fileStore.ts` is included in the lint command, report existing baseline lint failures separately from this task's diff.

## 7. Wrong vs Correct

### Wrong

- Build one override map from every opened file and ignore `savePolicy` except for request validation.

### Correct

- Resolve the active target file first.
- Apply `savePolicy` before choosing the pipeline source.
- Load only the selected file's pipeline into the runtime override map.

## Scenario: Debug Runtime Override Draft

### 1. Scope / Trigger
- Trigger: debug overview now accepts a temporary JSON override draft that participates in the cross-layer run request contract.
- Applies when touching:
  - `src/features/debug/components/panels/OverviewPanel.tsx`
  - `src/features/debug/pipelineOverride.ts`
  - `src/stores/debugOverrideStore.ts`
  - `src/stores/debugRunProfileStore.ts`
  - `src/features/debug/hooks/useDebugModalController.ts`
  - `src/components/flow/nodes/nodeContextMenu.tsx`
  - `LocalBridge/internal/debug/protocol/types.go`
  - `LocalBridge/internal/debug/runtime/runtime.go`

### 2. Signatures
- Frontend draft parser:
  - `parseDebugPipelineOverrideDraft(draft: string) -> { error?: string; overrides?: DebugPipelineOverride[] }`
- Frontend request field:
  - `DebugRunRequest { overrides?: DebugPipelineOverride[] }`
- Backend request field:
  - `protocol.RunRequest { Overrides []PipelineOverride }`
- Backend merge entrypoint:
  - `runtime.PipelineOverride(root string, req protocol.RunRequest) (map[string]interface{}, error)`

### 3. Contracts
- Draft shape:
  - The UI draft must use MaaFW-compatible partial pipeline JSON: `{ "<RuntimeName>": { ...partial pipeline... } }`.
  - Root value must be a JSON object.
  - Each key becomes one `DebugPipelineOverride.runtimeName`.
  - Each value must be an object; arrays and primitives are invalid.
- Lifetime:
  - Override draft is page-lifecycle state only.
  - Do not persist it to localStorage / memory store.
  - Do not write it back into graph nodes, source JSON, or exported pipeline files.
- Merge order:
  - Backend must resolve the base pipeline first using `savePolicy`.
  - Request overrides then deep-merge onto that base.
  - For conflicting fields, request override wins.
  - Nested objects merge recursively; arrays and scalar values replace the base value directly.
- Entry paths:
  - Overview run buttons and node context-menu debug start must both consult the same parsed draft result before starting a run.

### 4. Validation & Error Matrix
- Draft is invalid JSON -> frontend blocks run start with `debug.override.invalid_json`.
- Draft root is not an object -> frontend blocks run start with a clear format error.
- Any runtimeName is empty after trim -> frontend blocks run start with a clear runtime-name error.
- Any runtime override value is not an object -> frontend blocks run start with a clear node-value error.
- Base pipeline is nil / empty but request override exists -> backend must initialize a safe map and merge without panic.

### 5. Good / Base / Bad Cases
- Good:
  - Draft is `{ "ShopEntry": { "next": ["NodeB"], "timeout": 5000 } }`; runtime starts and `ShopEntry` fields override the base pipeline.
- Base:
  - Draft is `{}`; request may omit `overrides` or send an empty override list, and runtime behavior matches the unmodified base pipeline.
- Bad:
  - Frontend accepts `"[]"` or `{ "ShopEntry": 1 }` and lets the run start, leaving LocalBridge to fail later.

### 6. Tests Required
- Frontend verification:
  - Targeted eslint on touched debug files.
  - Static check that override draft store does not use `localStorage` / persisted memory.
  - Static or test verification that overview and node context-menu paths share the same invalid-draft guard.
- Go unit tests for `runtime.PipelineOverride(...)`:
  - Assert request override deep-merges onto an existing base node.
  - Assert request override can add a new runtime node.
  - Assert nil/empty base pipeline plus request override does not panic.

### 7. Wrong vs Correct

#### Wrong

- Treat the draft as a persisted profile setting or silently allow invalid JSON until runtime.

#### Correct

- Keep the draft in ephemeral page state only.
- Parse and validate before any run start.
- Merge request overrides onto the resolved base pipeline in LocalBridge, with request values winning on conflict.

## Scenario: Debug Resource Bundle Resolution

### 1. Scope / Trigger
- Trigger: resource-path handling changed from "caller must already provide bundle roots" to "LocalBridge resolves user-supplied paths before load".
- Applies when touching:
  - `LocalBridge/internal/debug/api/handler.go`
  - `LocalBridge/internal/debug/diagnostics/service.go`
  - `LocalBridge/internal/debug/runtime/runtime.go`
  - `LocalBridge/internal/debug/runtime/agent_pool.go`
  - `LocalBridge/internal/mfw/adapter.go`
  - `LocalBridge/internal/mfw/resource_manager.go`
  - `LocalBridge/internal/protocol/mfw/handler.go`

### 2. Signatures
- Debug preflight request:
  - `protocol.ResourcePreflightRequest { requestId?: string; resourcePaths: string[] }`
- Debug preflight result:
  - `protocol.ResourcePreflightResult { requestId?, resourcePaths, status, hash?, checkedAt, durationMs?, diagnostics? }`
- Generic MFW load-resource request:
  - `models.LoadResourceRequest { resource_path: string }`
- Generic MFW load-resource response:
  - `/lte/mfw/resource_loaded` with `resource_id`, `resource_hash`, `resource_path`, `input_resource_path`, `resource_resolution`

### 3. Contracts
- Input tolerance:
  - Callers may pass a bundle root, `pipeline/`, `pipeline/*.json`, `image/**`, `model/**`, or `model/ocr/**`.
  - Callers may also pass an ancestor directory when downward search finds exactly one bundle candidate within the resolver search boundary.
- Shared resolver:
  - Debug preflight, debug runtime load, debug agent bind, and generic MFW load-resource must all reuse the same resolver semantics.
  - Do not keep a separate "marker-only" validation path beside the real resolver.
- Resolution metadata:
  - Preflight diagnostics should expose resolved root and strategy so frontend/debug logs can explain what happened.
  - Runtime resource-load events should expose resolution metadata for each path.
  - Generic `/lte/mfw/resource_loaded` should expose both the original input path and the resolved bundle root.

### 4. Validation & Error Matrix
- Empty `resourcePaths` -> reject as `debug.resource.empty`.
- Path cannot be stat'ed / normalized -> resolver error with path details.
- Input path does not map to a bundle root -> resolver error, not a generic marker warning.
- Downward search finds multiple bundle candidates -> resolver must fail with ambiguity details; do not guess.
- Resolved root exists but MaaFW `PostBundle` fails -> load failure after resolution succeeds.

### 5. Good / Base / Bad Cases
- Good:
  - User passes `D:/Proj/assets/resource/base/pipeline/main.json`; resolver loads `D:/Proj/assets/resource/base`.
- Base:
  - User passes `D:/Proj`; downward search finds one bundle under the allowed depth and loads that bundle root.
- Bad:
  - Debug diagnostics still warn "missing marker" for `pipeline/main.json` even though runtime/preflight load succeeds through resolver.

### 6. Tests Required
- Resolver unit tests:
  - upward resolution from `pipeline/*.json`
  - upward resolution from `image/**` / `model/ocr/**`
  - unique downward candidate
  - ambiguous downward candidates
  - not-found path
- Debug diagnostics tests:
  - startup diagnostics accept resolver-supported inputs
  - ambiguity/not-found surfaces resolver-backed diagnostics instead of legacy marker warnings
- Runtime / protocol verification:
  - resource-load event payload includes resolved-path metadata
  - generic load-resource response includes `input_resource_path` plus resolved `resource_path`

### 7. Wrong vs Correct

#### Wrong

- Validate resource paths with ad hoc "is directory + has marker" checks in one place, then resolve/load differently elsewhere.

#### Correct

- Resolve resource paths once per entrypoint using the shared resolver.
- Reuse resolved results for both diagnostics/keying and actual load when possible.
- Surface resolved root plus strategy in diagnostics and protocol payloads when resolution changes the effective path.
