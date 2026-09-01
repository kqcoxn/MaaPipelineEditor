import { beforeEach, describe, expect, it, vi } from "vitest";

import { message } from "antd";
import { createPipelineNode } from ".";
import { useClipboardStore } from "./clipboardStore";
import { useProcessStore } from "@/stores/ui/processStore";

vi.mock("antd", () => ({
  message: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("flow clipboard", () => {
  beforeEach(() => {
    useClipboardStore.setState({ clipboardNodes: [], clipboardEdges: [] });
    useProcessStore.setState({ entries: [] });
    vi.mocked(message.error).mockClear();
    vi.mocked(message.success).mockClear();
  });

  it("keeps small copies synchronous without process feedback", async () => {
    const nodes = Array.from({ length: 100 }, (_, index) =>
      createPipelineNode(`node-${index}`),
    );

    const copyOperation = useClipboardStore.getState().copy(nodes, []);

    expect(useProcessStore.getState().entries).toEqual([]);
    expect(useClipboardStore.getState().clipboardNodes).toHaveLength(100);
    await copyOperation;
  });

  it("reports fixed stages while copying over 100 nodes", async () => {
    const nodes = Array.from({ length: 101 }, (_, index) =>
      createPipelineNode(`node-${index}`, {
        datas: { extras: { nested: { index } } },
      }),
    );
    const details: string[] = [];
    const unsubscribe = useProcessStore.subscribe((state) => {
      const detail = state.entries[state.entries.length - 1]?.detail;
      if (detail) details.push(detail);
    });

    const copyOperation = useClipboardStore.getState().copy(nodes, []);
    expect(useProcessStore.getState().entries).toEqual([
      expect.objectContaining({
        label: "正在复制节点",
        detail: "正在复制 101 个节点",
      }),
    ]);

    await copyOperation;
    unsubscribe();

    expect(details).toEqual([
      "正在复制 101 个节点",
      "正在写入内部粘贴板",
    ]);
    expect(useClipboardStore.getState().clipboardNodes).toHaveLength(101);
    expect(useClipboardStore.getState().clipboardNodes[0]).not.toBe(nodes[0]);
    expect(useProcessStore.getState().entries).toEqual([]);
    expect(message.success).toHaveBeenCalledOnce();
  });
});
