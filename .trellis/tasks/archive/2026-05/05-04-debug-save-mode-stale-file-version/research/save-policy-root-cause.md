# Debug Save Policy Root Cause Notes

## Confirmed findings

1. Frontend default drift
   - `src/stores/debugRunProfileStore.ts`
   - `createDefaultProfile()` currently derives `savePolicy` from `configs.saveFilesBeforeDebug`.
   - `src/stores/configStore.ts` sets `saveFilesBeforeDebug: true` by default.
   - Result: a fresh debug profile defaults to `save-open-files`, not `sandbox`.

2. Save policy is not meaningfully enforced in backend runtime
   - `LocalBridge/internal/debug/api/handler.go` validates `savePolicy`.
   - `LocalBridge/internal/debug/runtime/runtime.go` does not branch on `req.Profile.SavePolicy`.
   - `PipelineOverride(req)` always flattens every `graphSnapshot.files[*].pipeline` entry plus `req.Overrides`.

3. Multi-open-file pollution risk
   - `src/features/debug/snapshot.ts` builds `graphSnapshot.files` from all opened files in `useFileStore`.
   - Non-current files contribute cached `file.nodes/file.edges`; current file contributes live `flowStore` nodes/edges.
   - Backend flattening is keyed only by `runtimeName`, so unrelated opened files can overwrite each other.

## Likely failure mode behind the report

When users open multiple files and debug repeatedly, the request can carry a mixed snapshot of current and cached files. Because backend override assembly ignores `savePolicy` and merges all files into a single runtime map, a later-opened or stale file can override the file the user thinks they are running. Re-opening local files refreshes the cached `file.nodes/file.edges`, which explains why the issue temporarily disappears after reopening.

## Fix direction

* Restore frontend default `savePolicy` to `sandbox`.
* Make backend runtime logic actually respect `savePolicy`.
* Limit what gets merged into runtime override for the current run so unrelated opened files cannot hijack execution.
