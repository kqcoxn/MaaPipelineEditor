# Directory Structure

> How frontend code is organized in this project.

---

## Overview

The frontend uses a hybrid structure:

- shared editor/runtime foundations live in top-level folders such as
  `src/components`, `src/stores`, `src/core`, and `src/utils`
- product-specific surfaces that have their own UI + orchestration live under
  `src/features/*`
- styles are split between central shared style buckets and feature-local
  module styles

This is not a pure feature-sliced repo. Reusable graph-editor primitives still
live in shared top-level directories.

---

## Directory Layout

```text
src/
├── App.tsx
├── main.tsx
├── components/
│   ├── debug/
│   ├── flow/
│   ├── modals/
│   └── panels/
├── contexts/
├── core/
├── data/
├── features/
│   ├── debug/
│   └── wiki/
├── hooks/
├── services/
├── stores/
│   └── flow/
│       ├── slices/
│       ├── types.ts
│       └── utils/
├── styles/
├── utils/
└── wiki/
```

---

## Module Organization

New work should follow these placement rules:

- Put app-shell composition in `src/App.tsx`; keep new behavior there limited
  to wiring and lifecycle entrypoints.
- Put reusable editor UI in `src/components`.
  Examples: `src/components/Flow.tsx`,
  `src/components/panels/main/FieldPanel.tsx`,
  `src/components/debug/DebugModal.tsx`.
- Put feature-only orchestration under `src/features/<feature>`.
  Examples: `src/features/debug/hooks/useDebugModalController.ts`,
  `src/features/debug/components/panels/*`,
  `src/features/wiki/components/WikiModal.tsx`.
- Put domain logic that should not depend on React in `src/core`.
  Examples: `src/core/parser/*`, `src/core/fields/*`, `src/core/sorting/*`.
- Put service/bridge wrappers in `src/services` or focused utility modules,
  not inside React components.
- Put app/global state in `src/stores`. Large stores should be split by domain
  or slices instead of growing one file forever.
  Example: `src/stores/flow/index.ts` + `src/stores/flow/slices/*`.
- Put generic hooks in `src/hooks`; put feature-specific hooks beside the
  feature.
- Put feature-independent shared styles under `src/styles/*`; colocate
  feature-only `.module.less` files beside the owning component when reuse is
  unlikely.
  Examples: `src/styles/panels/ToolPanel.module.less`,
  `src/features/wiki/components/WikiModal.module.less`.

---

## Naming Conventions

The repo follows these naming patterns:

- React component files use `PascalCase.tsx`.
  Examples: `DebugModal.tsx`, `OverviewPanel.tsx`, `WikiModal.tsx`.
- Custom hooks use `useXxx.ts`.
  Examples: `usePersistedState.ts`, `useEmbedMode.ts`,
  `useDebugModalController.ts`.
- Zustand stores use `*Store.ts`.
  Examples: `configStore.ts`, `debugTraceStore.ts`, `wikiStore.ts`.
- Large store domains may add `types.ts`, `slices/`, and `utils/`.
- Barrel exports via `index.ts` are used at folder boundaries where import
  ergonomics matter.
  Examples: `src/components/panels/exploration/index.ts`,
  `src/stores/flow/index.ts`.
- CSS modules usually mirror the component or panel name.

---

## Examples

Use these as reference layouts:

- App shell composition: `src/App.tsx`
- Shared state domain with slices: `src/stores/flow/index.ts`
- Feature-oriented orchestration: `src/features/debug/`
- Feature with colocated styles and helper modules: `src/features/wiki/`
- Shared panel family with subfolders: `src/components/panels/main/`
