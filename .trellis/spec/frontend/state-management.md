# State Management

> How state is managed in this project.

---

## Overview

Zustand is the default global state tool across the frontend. React local state
is still used for narrow, view-local concerns. The repo does not use a generic
server-state cache library; websocket, bridge, and wiki loading state is owned
by dedicated stores plus a few coordinating hooks.

---

## State Categories

Use the following buckets:

- Local component state:
  short-lived UI toggles, search text, and screen-only visibility.
  Examples: `explorationPanelVisible` in `src/App.tsx`,
  `searchText` in `src/features/wiki/components/WikiModal.tsx`.
- Persisted UI memory:
  state that should survive reloads or reopen but still belongs to one product
  surface.
  Examples: `src/stores/debugModalMemoryStore.ts`,
  `src/hooks/usePersistedState.ts`.
- App/domain state:
  editor graph, files, config, wiki, debug traces, artifacts, diagnostics,
  controller readiness.
  Examples: `src/stores/fileStore.ts`, `src/stores/configStore.ts`,
  `src/stores/debugSessionStore.ts`.
- Service-driven state:
  websocket/debug protocol/Wails/embed events are translated into store state,
  not kept as raw component state.
- URL/share state:
  handled through focused helpers such as `src/utils/data/shareHelper.ts` and
  `src/wiki/wikiUrl.ts`.

---

## When to Use Global State

Promote state to a store when one or more of these are true:

- multiple distant components need the same state
- commands must run outside React render trees via `getState()`
- the state is updated by protocol listeners, bridge callbacks, or stores
  talking to other stores
- the state should survive modal close/reopen or page reload

Patterns already in use:

- one store per domain (`configStore`, `wikiStore`, `debugTraceStore`)
- slice-based decomposition for large domains
  (`src/stores/flow/slices/*`)
- selector hooks for render-time reads, `getState()` for event handlers,
  protocol listeners, persistence helpers, and store-to-store coordination

When reading multiple store fields together in React, prefer one selector with
`useShallow(...)` instead of many independent subscriptions.

---

## Server State

Server/bridge state is handled manually.

- `src/services/server` and bridge utilities are the transport boundary.
- Hooks and listener registration modules translate events into stores.
- Stores may keep cached snapshots and derived summaries.
  Examples: `debugTraceStore`, `debugArtifactStore`, `wikiStore`.

Do not introduce a generic fetch/cache framework for one narrow flow unless the
repo has clearly moved in that direction.

---

## Common Mistakes

Common mistakes:

- Promoting temporary input/search/toggle state to a global store too early.
- Storing derived state twice when it can be recomputed in a hook or selector.
  Examples of preferred derived-state usage:
  `controllerDisplayName`, `resourcePreflightStatus`, `displaySessionOptions`.
- Expanding giant stores without carving out slices or a feature-specific store.
- Reading store data in render with `getState()` when a selector hook is the
  safer and more reactive choice.
