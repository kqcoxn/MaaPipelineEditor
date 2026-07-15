---
name: ant-design
description: Decision guide for antd 6.x, Ant Design Pro 5/ProComponents, Ant Design X v2, and the offline `@ant-design/cli`. Use for component selection, theming/tokens, SSR, a11y, performance, routing/access/CRUD, AI/chat UI patterns, local API lookup, debugging, migration, and usage analysis.
---

# Ant Design

## S - Scope
- Target: `antd@^6` + React 18-19, with `ant-design-pro@^5` / `@ant-design/pro-components` and `@ant-design/x@^2` when needed.
- Tooling: `@ant-design/cli` for offline component metadata, demos, changelogs, migrations, linting, doctor checks, and usage analysis.
- Focus: decision guidance only; no end-user tutorials.
- Source policy: official docs only; no undocumented APIs or internal `.ant-*` coupling.

### Default assumptions
- Language: TypeScript.
- Styling: tokens first, then `classNames`/`styles`; avoid global overrides.
- Provider: one root `ConfigProvider` unless strict isolation is required.

### Mandatory rules
- Before writing or changing antd component code, query the component API first with `antd info <Component> --format json`. Do not rely on memory when the CLI can answer it offline.
- Always use `--format json` with `antd` CLI commands.
- If the project version matters, match it with `--version <x.y.z>` or let the CLI auto-detect from local `node_modules`.
- After changing antd code, run `antd lint <changed-path> --format json`.
- If an `antd` CLI command crashes, returns wrong data, or violates its documented behavior, prepare an `antd bug-cli` preview for user confirmation instead of silently working around it.
- For component questions, first map the component name to the official route slug `{components}` (lowercase kebab-case, e.g. `TreeSelect -> tree-select`, `Button -> button`), then request docs in this order (CN first, EN fallback):
  1. `https://ant.design/components/{components}-cn`
  2. `https://ant.design/components/{components}`
  - Examples: `tree-select-cn -> tree-select`, `button-cn -> button`.
- Use only documented antd/Pro/X APIs.
- Do not invent props/events/component names.
- Do not rely on internal DOM or `.ant-*` selectors.
- Theme priority: global tokens -> component tokens -> alias tokens.

## P - Process
### 1) Classify
- Identify layer: core antd, Pro, or X.
- Confirm version, rendering mode (CSR/SSR/streaming), data scale, and whether `@ant-design/cli` should be the primary lookup path.

### 2) Query authoritative sources
- Prefer local `@ant-design/cli` first for structured lookup:
  - `antd info` for props/API
  - `antd demo` for a working baseline
  - `antd doc` for full docs
  - `antd token` / `antd semantic` for theming and styling hooks
  - `antd doctor`, `antd lint`, `antd usage`, `antd migrate`, `antd changelog` when debugging or upgrading
- Then request the official component docs (`-cn` first, EN fallback) when narrative docs or cross-checking are needed.

### 3) Decide
- Provider baseline: CSR -> `ConfigProvider`; SSR -> `ConfigProvider` + `StyleProvider`.
- Theming baseline: global tokens -> component tokens -> `classNames`/`styles`.
- Output recommendation + risk + verification points (SSR/a11y/perf), citing CLI findings when used.

## O - Output
- Provide short decision rationale (1-3 sentences).
- Include minimal provider/theming strategy.
- Include concrete SSR/a11y/perf checks.
- For Pro: include route/menu/access and CRUD schema direction.
- For X: include message/tool schema and streaming state direction.

## References

| File | Use when |
| --- | --- |
| `references/antd-cli.md` | You need the exact offline CLI workflow for API lookup, demos, linting, doctor checks, migration, changelog review, usage analysis, or bug reporting. |

## Regression checklist
- [ ] One root `ConfigProvider`; SSR style order/hydration verified.
- [ ] Tokens first; no broad global `.ant-*` overrides.
- [ ] Table has stable `rowKey`; sort/filter/pagination entry is unified.
- [ ] Select remote mode disables local filter when using remote search.
- [ ] Upload controlled/uncontrolled mode is explicit with failure/retry path.
- [ ] Pro route/menu/access remain consistent with backend enforcement.
- [ ] X streaming supports stop/retry and deterministic tool rendering.
- [ ] If `antd` CLI was used, commands ran with `--format json` and any CLI defect was escalated via `antd bug-cli` preview.
