import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    saveHistory: vi.fn(),
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
    mocks.state = {
      ...mocks.state,
      nodes: [
        { id: "node-1", position: { x: 0, y: 0 }, measured: { width: 200, height: 100 } },
        { id: "node-2", position: { x: 300, y: 0 }, measured: { width: 200, height: 100 } },
      ],
    };
  });

  afterEach(() => vi.useRealTimers());

  it("preserves edges and the viewport when applying a partial layout", async () => {
    await LayoutHelper.autoPartial(mocks.state.nodes as never[]);

    expect(mocks.replace).toHaveBeenCalledWith(
      [
        expect.objectContaining({ id: "node-1", position: { x: 0, y: 0 } }),
        expect.objectContaining({ id: "node-2", position: { x: 240, y: 120 } }),
      ],
      mocks.state.edges,
      { isFitView: false, skipHistory: true, preserveSelection: true },
    );
  });

  it("does not overwrite edits made while the layout is calculating", async () => {
    const pending = LayoutHelper.autoPartial(mocks.state.nodes as never[]);
    mocks.state = {
      ...mocks.state,
      nodes: mocks.state.nodes.map((node) => ({ ...node, position: { x: 999, y: 888 } })),
    };
    await pending;
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(mocks.state.nodes[0].position).toEqual({ x: 999, y: 888 });
  });

  it("only applies the latest of overlapping layout requests", async () => {
    const first = LayoutHelper.autoPartial(mocks.state.nodes as never[]);
    const second = LayoutHelper.autoPartial(mocks.state.nodes as never[]);
    await Promise.all([first, second]);
    expect(mocks.replace).toHaveBeenCalledTimes(1);
  });

  it("uses fallback dimensions after a bounded measurement wait", async () => {
    vi.useFakeTimers();
    mocks.state.nodes = mocks.state.nodes.map((node) => ({ ...node, measured: { width: 0, height: 0 } }));
    const pending = LayoutHelper.autoPartial(mocks.state.nodes as never[]);
    await vi.advanceTimersByTimeAsync(500);
    await pending;
    expect(mocks.replace).toHaveBeenCalledTimes(1);
    const result = mocks.replace.mock.calls[0][0];
    expect(result[1].position).toEqual({ x: 240, y: 120 });
  });
});
