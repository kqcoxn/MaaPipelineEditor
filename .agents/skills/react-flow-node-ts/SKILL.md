---
name: react-flow-node-ts
description: Create React Flow node components with TypeScript types, handles, and Zustand integration. Use when building custom nodes for React Flow canvas, creating visual workflow editors, or implementing node-based UI components.
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
---

# React Flow Node

Create React Flow node components following established patterns with proper TypeScript types and store integration.

Website: https://reactflow.dev/

## References

This skill includes a local mirror of the React Flow official documentation under [references/](references/). Use it when you need detailed API signatures, guides, or UI component references without relying on network access:

- **[references/api-reference/](references/api-reference/)** — Full API reference for components, hooks, types, and utilities.
  - Start with [api-reference/index.md](references/api-reference/index.md) for an overview.
  - Common node-related entries: [components/handle.md](references/api-reference/components/handle.md), [components/node-resizer.md](references/api-reference/components/node-resizer.md), [types/node.md](references/api-reference/types/node.md), [hooks/use-nodes.md](references/api-reference/hooks/use-nodes.md).
- **[references/learn/](references/learn/)** — Tutorials, concepts, customization guides, and layouting best practices.
  - Start with [learn/index.md](references/learn/index.md) for the quick start.
  - Relevant guides: [learn/customization/custom-nodes.md](references/learn/customization/custom-nodes.md), [learn/layouting/layouting.md](references/learn/layouting/layouting.md).
- **[references/ui/](references/ui/)** — React Flow UI components and templates built on shadcn/ui.
  - Start with [ui/index.md](references/ui/index.md) for setup and usage.

> Prefer the local references over the website when exact API behavior or TypeScript types matter, because the mirrored docs are pinned to the same version this skill targets.

## Quick Start

Copy templates from [assets/](assets/) and replace placeholders:

- `{{NodeName}}` → PascalCase component name (e.g., `VideoNode`)
- `{{nodeType}}` → kebab-case type identifier (e.g., `video-node`)
- `{{NodeData}}` → Data interface name (e.g., `VideoNodeData`)

## Templates

- [assets/template.tsx](assets/template.tsx) - Node component
- [assets/types.template.ts](assets/types.template.ts) - TypeScript definitions

## Node Component Pattern

```tsx
export const MyNode = memo(function MyNode({
  id,
  data,
  selected,
  width,
  height,
}: MyNodeProps) {
  const updateNode = useAppStore((state) => state.updateNode);
  const canvasMode = useAppStore((state) => state.canvasMode);

  return (
    <>
      <NodeResizer isVisible={selected && canvasMode === "editing"} />
      <div className="node-container">
        <Handle type="target" position={Position.Top} />
        {/* Node content */}
        <Handle type="source" position={Position.Bottom} />
      </div>
    </>
  );
});
```

## Type Definition Pattern

```typescript
export interface MyNodeData extends Record<string, unknown> {
  title: string;
  description?: string;
}

export type MyNode = Node<MyNodeData, "my-node">;
```

## Integration Steps

1. Add type to `src/frontend/src/types/index.ts`
2. Create component in `src/frontend/src/components/nodes/`
3. Export from `src/frontend/src/components/nodes/index.ts`
4. Add defaults in `src/frontend/src/store/app-store.ts`
5. Register in canvas `nodeTypes`
6. Add to AddBlockMenu and ConnectMenu
