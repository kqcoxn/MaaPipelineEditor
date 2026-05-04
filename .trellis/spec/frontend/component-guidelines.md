# Component Guidelines

> How components are built in this project.

---

## Overview

Components are function components built on React 19, Ant Design, and
React Flow. The repo mixes:

- presentational leaf components with small inline prop types
- medium components with explicit `Props` interfaces
- controller/panel pairs where the heavy stateful logic lives in a hook and
  the panel renders from a shared controller object

Prefer extracting orchestration into hooks or helper modules before a panel
becomes another giant coordinator.

---

## Component Structure

Common patterns in the current codebase:

- Keep layout constants as top-level `CSSProperties` objects when a component
  uses many dynamic inline layout styles.
  Examples: `src/components/debug/DebugModal.tsx`,
  `src/features/wiki/components/WikiModal.tsx`,
  `src/features/debug/components/panels/OverviewPanel.tsx`.
- Split repeated UI fragments into local subcomponents inside the same file
  when they are tightly coupled to one screen.
  Examples: `MetaItem` in `OverviewPanel.tsx`, `ActivePanel` in
  `DebugModal.tsx`, `SidePager` and `StepPager` in `WikiModal.tsx`.
- Use `memo(...)` only for hot paths or noisy visual subtrees, not by default.
  Examples: `GlobalListener` in `src/App.tsx`, several flow/node components,
  and JSON viewer internals.
- Keep side effects, protocol calls, and derived controller state out of modal
  body components when they can live in a hook.
  Example: `src/components/debug/DebugModal.tsx` stays mostly declarative while
  `src/features/debug/hooks/useDebugModalController.ts` owns the orchestration.

---

## Props Conventions

Follow these conventions:

- Use an explicit `XxxProps` interface when the prop contract is reused,
  exported, or non-trivial.
  Examples: `WikiContextHintProps`, `ConnectionPanelProps`,
  `DebugImageViewerProps`.
- Inline destructured prop typing is acceptable for tiny local leaf
  components.
  Examples: `MetaItem`, `StatusTag`, `EventMeta`.
- Prefer passing domain/controller objects instead of threading many unrelated
  props through sibling panels.
  Example: every debug workbench panel receives one
  `DebugModalController`.
- Reuse exported domain types from `src/stores`, `src/features/*/types.ts`,
  and `src/core/*/types.ts` instead of redefining ad hoc object shapes.

---

## Styling Patterns

The repo uses two styling modes:

- Less CSS modules for component-local or shared visual styling
- inline `CSSProperties` objects for layout composition, spacing, and
  state-dependent geometry

Use this rule of thumb:

- if the style is shared by multiple panels or flow primitives, put it under
  `src/styles/*`
- if the style is owned by one feature component, colocate the `.module.less`
  beside that component

Examples:

- shared panel styles: `src/styles/panels/ToolPanel.module.less`
- feature-local styles: `src/features/wiki/components/WikiModal.module.less`
- combined approach in one file:
  `src/features/wiki/components/WikiModal.tsx`

---

## Accessibility

Accessibility in this repo is pragmatic and mostly relies on Ant Design
controls. Keep these patterns:

- prefer Ant Design `Button`, `Select`, `Modal`, `Alert`, and `Segmented`
  instead of custom clickable `div`s
- add `aria-label` to icon-only controls
  Example: `SidePager` in `src/features/wiki/components/WikiModal.tsx`
- ignore keyboard shortcuts inside input-like or editor surfaces
  Example: `isReaderHotkeyIgnoredTarget` in `WikiModal.tsx`
- when using raw HTML buttons for cards or panels, set `type="button"`
  explicitly
  Example: home cards in `WikiModal.tsx`

---

## Common Mistakes

Watch for these repo-specific mistakes:

- Adding more orchestration directly to `App.tsx`, `DebugModal.tsx`, or other
  already-large coordinators when the logic belongs in a hook or helper file.
- Creating feature-specific styles in shared `src/styles/*` when they are not
  reused outside that feature.
- Introducing brand-new prop shapes instead of importing the existing domain
  type that already represents the same concept.
- Using compressed chips or fixed-width UI for long metadata that needs to wrap
  for readability.
  Example reference: metadata rendering in
  `src/features/debug/components/panels/OverviewPanel.tsx`.
