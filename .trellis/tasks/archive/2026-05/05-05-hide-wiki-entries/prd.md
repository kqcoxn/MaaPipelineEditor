# Temporarily hide wiki entries for release

## Goal

Temporarily hide all user-facing Wiki entry points for a short-term release, including the main global entry and contextual Wiki triggers, without removing the underlying Wiki implementation.

## What I already know

* The repo already has a global visibility flag at `src/wiki/visibility.ts`.
* `src/components/panels/tools/GlobalPanel.tsx` already uses that flag to show or hide the main Wiki entry.
* `src/features/wiki/components/WikiPonderTrigger.tsx` already uses that flag, so DebugModal and similar ponder triggers are covered.
* `src/features/wiki/components/WikiContextHint.tsx` does not currently use the visibility flag, so panel-level contextual Wiki actions can still appear.
* `src/App.tsx` already guards hash-based Wiki opening and `WikiModal` mounting behind the same visibility flag.

## Assumptions (temporary)

* "各入口临时隐藏，包括主入口" means hiding all in-app user entry points for this release, not deleting Wiki content or data structures.
* Non-entry Wiki implementation files can remain in the repo unchanged.
* No browser/manual validation should be run in this session; only static validation is needed.

## Open Questions

* None currently blocking. Scope is clear enough for a minimal temporary hide.

## Requirements (evolving)

* Hide the main Wiki entry in the global toolbar.
* Hide contextual Wiki entry points that can still open Wiki from panels or notices.
* Keep the implementation minimal and centralized around the existing visibility switch.
* Do not remove the Wiki feature code permanently; this is a temporary release-time hide.

## Acceptance Criteria (evolving)

* [ ] When the Wiki visibility switch is off, the global Wiki entry is not rendered.
* [ ] When the Wiki visibility switch is off, contextual Wiki hint actions are not rendered.
* [ ] Existing guarded Wiki triggers remain hidden through the same switch.
* [ ] Frontend lint passes for the touched code.

## Definition of Done (team quality bar)

* Lint / static checks run for touched frontend code
* No unrelated behavior changes outside temporary Wiki entry visibility
* No browser run or manual UI claim implied in the report

## Out of Scope (explicit)

* Deleting Wiki modules, entries, or content files
* Adding a new runtime config or release toggle source
* Browser-based verification
* Documentation beyond this task record

## Technical Notes

* Files inspected:
  * `src/wiki/visibility.ts`
  * `src/App.tsx`
  * `src/components/panels/tools/GlobalPanel.tsx`
  * `src/features/wiki/components/WikiPonderTrigger.tsx`
  * `src/features/wiki/components/WikiContextHint.tsx`
* Minimal implementation direction:
  * Set the existing visibility flag off for this release
  * Make `WikiContextHint` respect the same flag so all contextual entries disappear consistently
