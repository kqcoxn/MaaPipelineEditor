# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

The main automated quality gate for frontend work is `yarn lint` plus
TypeScript compile-time strictness. As of the current repo state, there is no
meaningful colocated frontend test suite in `src`, so quality work is usually:

- targeted static checks
- careful diff review
- narrow manual validation by the developer

Document what was actually validated. Do not imply a build, browser run, or
test pass that did not happen.

---

## Forbidden Patterns

Avoid these repo-specific failure modes:

- Reintroducing parallel legacy/new flows when a refactor explicitly removes
  the old behavior.
- Adding new helpers, constants, or config values without first searching for
  the existing definition or call path.
- Leaving protocol listeners, DOM listeners, timers, or subscriptions without
  cleanup.
- Scattering raw localStorage persistence across components when a dedicated
  hook/store already exists.
- Silently touching unrelated dirty files in the worktree.

---

## Required Patterns

Expected patterns:

- Reuse existing stores, actions, and helpers before creating new ones.
- Keep feature orchestration in hooks or feature modules instead of bloating
  JSX files.
- Narrow external or persisted payloads before merging them into app state.
- Use `useShallow(...)` when selecting many store fields together.
- Run `yarn lint` for touched frontend work when the task scope allows it; if
  a task intentionally skips broader validation, state that clearly.

---

## Testing Requirements

Reality today:

- `vitest` is installed, but the main frontend does not currently have a
  routine test suite under `src`.
- AI sessions for this repo normally avoid `yarn dev` and browser automation
  unless the developer explicitly asks for them.
- Validation is usually targeted linting, static reasoning, grep/diff checks,
  and developer-run manual verification.

If you add a testable pure helper or parser change and a stable local harness
already exists, adding or updating tests is welcome. Do not invent a large new
test scaffold just to satisfy a checkbox.

---

## Code Review Checklist

Review frontend changes against this checklist:

- Is the file placed in the correct layer (`components`, `features`, `stores`,
  `core`, `utils`, `services`)?
- Is state owned in the right place, or was temporary UI state promoted to a
  global store unnecessarily?
- Are subscriptions/listeners/timers cleaned up?
- Are selectors and memoized derived values used appropriately to avoid
  accidental rerender churn?
- Were new payload boundaries validated instead of asserted?
- Were existing helpers/stores reused before new abstractions were added?
