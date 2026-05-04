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
