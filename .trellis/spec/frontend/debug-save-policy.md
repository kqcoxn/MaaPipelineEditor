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
