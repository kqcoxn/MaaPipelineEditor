import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  runWithProcess: vi.fn(
    async (
      _label: string,
      task: (update: (value: unknown) => void) => unknown | Promise<unknown>,
    ) => task(vi.fn()),
  ),
  state: {
    nodes: [
      {
        id: "node-1",
        position: { x: 0, y: 0 },
        measured: { width: 200, height: 100 },
      },
      {
        id: "node-2",
        position: { x: 300, y: 0 },
        measured: { width: 200, height: 100 },
      },
    ],
    edges: [],
    replace: vi.fn(),
  },
}));

mocks.state.replace = mocks.replace;

vi.mock("../stores/flow", () => ({
  useFlowStore: {
    getState: () => mocks.state,
  },
}));

vi.mock("../stores/ui/processStore", () => ({
  runWithProcess: mocks.runWithProcess,
}));

vi.mock("elkjs/lib/elk.bundled.js", () => ({
  default: class TestElk {
    async layout(graph: { children: Array<{ id: string }> }) {
      return {
        ...graph,
        children: graph.children.map((node, index) => ({
          ...node,
          x: index * 240,
          y: index * 120,
        })),
      };
    }
  },
}));

import { LayoutHelper } from "./layout";

describe("LayoutHelper partial layout", () => {
  beforeEach(() => {
    mocks.replace.mockClear();
    mocks.runWithProcess.mockClear();
  });

  it("preserves edges and the viewport when applying a partial layout", async () => {
    await LayoutHelper.autoPartial(mocks.state.nodes as never[]);

    expect(mocks.replace).toHaveBeenCalledWith(
      [
        expect.objectContaining({ id: "node-1", position: { x: 0, y: 0 } }),
        expect.objectContaining({ id: "node-2", position: { x: 240, y: 120 } }),
      ],
      mocks.state.edges,
      { isFitView: false },
    );
  });
});
