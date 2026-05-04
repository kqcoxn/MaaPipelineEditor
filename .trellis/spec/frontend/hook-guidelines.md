# Hook Guidelines

> How hooks are used in this project.

---

## Overview

Custom hooks are the main place for reusable stateful behavior and
feature-level orchestration. This repo does not use React Query or another
server-state hook framework; hooks usually coordinate service clients,
Zustand stores, and local effects directly.

---

## Custom Hook Patterns

Current patterns:

- Small composition hooks expose a cleaned-up view over one store or one
  environment boundary.
  Example: `src/hooks/useEmbedMode.ts`.
- Persistence hooks encapsulate localStorage behavior behind a standard React
  state API.
  Example: `src/hooks/usePersistedState.ts`.
- Complex feature hooks aggregate many stores, subscriptions, memoized derived
  values, and command handlers for one UI surface.
  Example: `src/features/debug/hooks/useDebugModalController.ts`.
- Feature-local hooks should live under `src/features/<feature>/hooks`;
  generic hooks that can be reused across surfaces belong in `src/hooks`.

If a React component is mostly wiring stores, listeners, and command actions,
move that logic into a hook before the JSX becomes unreadable.

---

## Data Fetching

There is no shared query/cache layer. Data and event flow usually work like
this:

- service or bridge client sends/receives messages
- hook or store action translates them into state updates
- components render from Zustand selectors

Examples:

- `useDebugModalController.ts` sends protocol requests, listens for agent test
  results, and invalidates resource preflight state
- `src/App.tsx` registers websocket/Wails/embed listeners and forwards results
  into stores
- `src/features/wiki/components/WikiModal.tsx` triggers `loadModule(...)`
  through the wiki store instead of embedding fetch details in child views

Always clean up subscriptions, DOM listeners, timers, and client callbacks in
the effect cleanup function.

---

## Naming Conventions

Naming and placement rules:

- Hook names must start with `use`.
- Generic hooks use descriptive nouns such as `usePersistedState`,
  `useGlobalShortcuts`, `useCanvasViewport`.
- Feature hooks include the feature name when the scope is not obvious.
  Examples: `useDebugModalController`, `useDebugNodeExecutionController`.
- Plain command helpers that do not need React lifecycle should stay as regular
  functions in `utils/` or feature action modules instead of being turned into
  hooks.
  Examples: `debugModalActions.ts`, `traceReplayActions.ts`.

---

## Common Mistakes

Common mistakes to avoid:

- Keeping protocol or persistence logic in the render component instead of the
  owning hook.
- Selecting many store fields separately when one `useShallow(...)` selector
  would reduce rerenders and keep state access coherent.
  Example: `useDebugModalController.ts`.
- Forgetting to invalidate cached derived state when source inputs change.
  Example reference: resource preflight invalidation in
  `useDebugModalController.ts`.
- Using a hook when a plain helper function is enough and has no React
  dependency.
