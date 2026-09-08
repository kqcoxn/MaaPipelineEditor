import { beforeEach, describe, expect, it, vi } from "vitest";

import { message } from "antd";
import { createPipelineNode } from ".";
import { useClipboardStore } from "./clipboardStore";
import { useProcessStore } from "@/stores/ui/processStore";
import { subscribeAchievementEvents } from "@/features/achievements/bus";

vi.mock("antd", async (importOriginal) => {
  const antd = await importOriginal<typeof import("antd")>();
  return {
    ...antd,
    message: {
      ...antd.message,
      error: vi.fn(),
      success: vi.fn(),
    },
  };
});

describe("flow clipboard", () => {
  it("一次复制超过50个节点才触发隐藏成就，复制不计作粘贴", async () => {
    const events: string[] = [];
    const dispose = subscribeAchievementEvents((event) => events.push(event.type));
    try {
      for (const count of [0, 50, 51]) {
        await useClipboardStore.getState().copy(Array.from({ length: count }, (_, i) => createPipelineNode(`copy-${i}`)));
      }
      expect(events).toEqual(["achievement:bulk_copied"]);
    } finally {
      dispose();
    }
  });
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
