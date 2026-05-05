# Frontend Development Guidelines

> Repo-specific frontend conventions for MaaPipelineEditor.

---

## Overview

These guidelines document how the current frontend actually works in
`maa-pipeline-editor`. They are grounded in the existing React 19 + Vite +
Ant Design + React Flow + Zustand codebase rather than generic best practices.

Read this index first, then open the topic-specific files that match the
change you are making.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Module organization and file layout | Active |
| [Component Guidelines](./component-guidelines.md) | Component patterns, props, composition | Active |
| [Debug Save Policy Contract](./debug-save-policy.md) | Cross-layer contract for debug savePolicy and target source resolution | Active |
| [Group Coordinate Model](./group-coordinate-model.md) | Absolute-vs-relative coordinate contract for group nodes, parser IO, and locate flows | Active |
| [Hook Guidelines](./hook-guidelines.md) | Custom hooks, data fetching patterns | Active |
| [State Management](./state-management.md) | Local state, global state, server state | Active |
| [Quality Guidelines](./quality-guidelines.md) | Code standards, forbidden patterns | Active |
| [Type Safety](./type-safety.md) | Type patterns, validation | Active |

---

## Pre-Development Checklist

Before writing frontend code:

1. Read [Directory Structure](./directory-structure.md) to decide the correct layer.
2. Read [Component Guidelines](./component-guidelines.md) and
   [Hook Guidelines](./hook-guidelines.md) for UI and orchestration work.
3. Read [State Management](./state-management.md) before adding or extending a
   Zustand store.
4. Read [Type Safety](./type-safety.md) before adding new contracts,
   normalization, or runtime payload handling.
5. Read [Quality Guidelines](./quality-guidelines.md) before final validation.
6. If the change touches debug save behavior, also read
   [Debug Save Policy Contract](./debug-save-policy.md).

## Notes

- Language for these spec files is English.
- Document reality first. If the repo has legacy exceptions, note them instead
  of pretending they do not exist.
