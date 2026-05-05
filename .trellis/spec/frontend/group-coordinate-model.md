# Group Coordinate Model

> Executable contract for group/node coordinate semantics in the flow editor.

---

## Scenario: Group Coordinate Unification

### 1. Scope / Trigger

- Trigger: Group child nodes currently mix React Flow relative coordinates with
  business/storage coordinates.
- Trigger: save/load/paste/group/locate code paths each re-implement parent-child
  conversion, causing drift and inconsistent behavior.
- Trigger: this is cross-layer work across React Flow rendering, Zustand flow
  state, parser import/export, and locate/focus behavior, so code-spec depth is
  mandatory.

### 2. Signatures

- New pure coordinate helper module:
  `src/stores/flow/utils/coordinateUtils.ts`
- Required helper signatures:
  - `getNodeAbsolutePosition(node, allNodes): PositionType`
  - `getNodeAbsoluteRect(node, allNodes): RectLike`
  - `toRelativePosition(absolutePosition, parentNode): PositionType`
  - `toRelativePositionFromParentAbsolute(absolutePosition, parentAbsolutePosition): PositionType`
  - `normalizeImportedNodePosition(node, allNodes, coordinateMode): NodeType`
  - `serializeNodePosition(node, allNodes): PositionType`
  - `resolveParentChain(node, allNodes): NodeType[]`
- File config contract update:
  - pipeline config / mpe config must carry
    `coordinateMode?: "relative-legacy" | "absolute-v1"`

### 3. Contracts

#### Source of truth

- Business truth:
  all non-ephemeral coordinate consumers must treat node positions as
  **absolute coordinates**.
- React Flow adapter truth:
  a node with `parentId` may still use relative `position` inside the rendered
  `nodes` array, but this representation is adapter-local only.

#### Runtime contract

- Store/business-facing helpers must never assume `node.position` is the final
  truth unless they explicitly normalized it through the coordinate module.
- Locate/focus APIs must consume absolute rectangles/positions, not raw React
  Flow child-relative positions.
- Group detection logic must compare against absolute positions.

#### Persistence contract

- Exported node positions must be absolute for pipeline/external/anchor/sticker
  nodes regardless of group membership.
- Group nodes keep absolute positions as before.
- Group membership remains expressed by group metadata (`childrenLabels`) plus
  runtime `parentId` reconstruction.
- Exporters must write `coordinateMode: "absolute-v1"` into file config.
- Importers must branch by `coordinateMode`:
  - `relative-legacy` or missing: existing child positions are interpreted as
    legacy relative coordinates once group membership is restored.
  - `absolute-v1`: imported child positions are interpreted as absolute and must
    be converted to React Flow relative positions only after parent resolution.
  - `absolute-v1` conversion must subtract the imported direct parent's source
    absolute position, not reuse runtime parent-chain resolution on a partially
    normalized node set.

#### Boundary contract

- Only the following layers may read or write React Flow relative child
  positions:
  - `src/stores/flow/utils/coordinateUtils.ts`
  - the flow-node adapter path that prepares React Flow `nodes`
- Parser/business/feature code must not open-code `parent.position +/- child.position`.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| Node has no `parentId` | Absolute position equals stored/rendered position |
| Node has single parent | Absolute position resolves via helper, not inline math |
| Node has nested parents | Helper must resolve full parent chain, not only one level |
| Import file has no `coordinateMode` | Treat as `relative-legacy` |
| Import file has `absolute-v1` | Convert child absolute positions to relative only for React Flow runtime |
| Import file has nested groups under `absolute-v1` | Convert child relative position from the imported direct parent absolute anchor only; do not re-add ancestor offsets |
| Parent referenced by child is missing | Clear `parentId`; keep absolute position |
| Node leaves group | Persisted position remains absolute after operation |
| Node enters group | Business truth stays absolute; adapter derives relative position |
| Paste with parent kept | New parent relation is rebuilt, then relative render position recalculated from absolute |
| Paste source nodes already contain parent chains | Compute source absolute positions from a source-node snapshot, not only current canvas state |
| Locate/focus/search uses child raw `position` | Bug; must be replaced with helper-based absolute coordinates |

### 5. Good/Base/Bad Cases

- Good:
  search result centering, node list focus, cross-file locate, paste offset,
  group create/detach all call the same absolute-position helper.
- Base:
  a node not inside any group continues to behave exactly as before.
- Bad:
  parser export writes raw `fNode.position` for grouped children without
  normalizing to absolute.
- Bad:
  feature code calls `setCenter(node.position.x, node.position.y, ...)` for a
  grouped child.
- Bad:
  copy/paste subtracts parent position in one slice and add parent position in
  another slice without a shared helper.

### 6. Tests Required

- Unit:
  - absolute position resolution for root node, single parent, nested parent
  - absolute-to-relative conversion round-trip
  - importer normalization under `relative-legacy`
  - importer normalization under `absolute-v1`
  - exporter serialization for grouped child uses absolute coordinates
- Integration:
  - create group -> save/export -> reload -> locate node remains stable
  - detach from group -> save/export -> reload -> locate node remains stable
  - nested group export -> reload under `absolute-v1` -> child relative render
    position remains correct
  - paste grouped nodes with/without parent group -> relative render position
    is correct and persisted absolute position is stable
- Assertion points:
  - exported JSON/MPE config contains `coordinateMode: "absolute-v1"`
  - all focus/locate flows use helper-derived absolute coordinates

### 7. Wrong vs Correct

#### Wrong

```ts
const position = node.position;
instance.setCenter(position.x + width / 2, position.y + height / 2, {
  zoom: 1.2,
});
```

Why wrong:
- grouped children expose React Flow relative position here
- callers silently get different semantics for grouped vs non-grouped nodes

#### Correct

```ts
const absolute = getNodeAbsolutePosition(node, allNodes);
instance.setCenter(absolute.x + width / 2, absolute.y + height / 2, {
  zoom: 1.2,
});
```

Why correct:
- the caller always consumes one semantic: absolute position
- group membership stays encapsulated in one helper module

---

## Design Decision: Absolute Business Coordinates, Relative React Flow Adapter

**Context**: React Flow `parentId` requires child render positions to be
relative to the parent, but business behavior such as save/load/locate must not
depend on that UI-specific representation.

**Options Considered**:
1. Keep relative coordinates everywhere, but add more helper functions
2. Store absolute coordinates as truth and adapt only at the React Flow boundary
3. Remove React Flow parent-relative semantics and emulate groups manually

**Decision**: Use option 2.

**Why**:
- It matches the actual product problem: relative coordinates leaked out of the
  render layer.
- It preserves React Flow group support without forcing the entire app to speak
  relative coordinates.
- It gives one stable semantic for save/load/locate/layout/paste.

### Wrong: scattered inline conversion

```ts
position: {
  x: node.position.x - groupNode.position.x,
  y: node.position.y - groupNode.position.y,
}
```

### Correct: centralized conversion helper

```ts
position: toRelativePosition(absolutePosition, groupNode)
```

---

## Convention: Coordinate Semantics by Layer

- `src/core/parser/*`
  only reads/writes persisted absolute coordinates plus `coordinateMode`
- `src/stores/flow/slices/*`
  may call coordinate helpers, but must not open-code parent-child math
- `src/components/*` and `src/features/*`
  use absolute coordinates for locate/focus/selection decisions
- `src/stores/flow/utils/coordinateUtils.ts`
  owns parent-chain traversal and relative adaptation

---

## Common Mistakes

### Don't: treat `node.position` as absolute in feature code

This is only safe for root nodes. Group children become inconsistent immediately.

### Don't: keep one-level parent math

Even if current UI mostly creates one-level groups, helpers must resolve the
entire parent chain. This prevents future nested-group regressions and removes
hidden semantic traps.

### Don't: export grouped child raw positions

Exporting raw child-relative positions keeps the persistence layer ambiguous and
forces every importer/locator to guess the meaning later.

### Don't: normalize imported absolute payloads with runtime parent-chain helpers

During `absolute-v1` import, the node array has not fully entered runtime
semantics yet. Reusing runtime absolute-position helpers here can double-count
ancestor offsets for nested groups.

---

## Implementation Notes

- Start by replacing `getNodeAbsolutePosition()` with a parent-chain aware
  helper in the new coordinate module, then route old callers through it.
- Cut over save/load before locate/focus cleanup so new data stops becoming
  ambiguous.
- Add `coordinateMode` with a default import fallback of `relative-legacy`.
- During paste, compute source absolute coordinates from a source snapshot that
  includes the pasted node set before remapping ids, then derive relative child
  positions from the rebuilt parent absolute anchor.
- After the cutover, delete duplicated conversion logic from:
  - `src/stores/flow/slices/nodeSlice.ts`
  - `src/stores/flow/slices/graphSlice.ts`
  - parser import/export paths
