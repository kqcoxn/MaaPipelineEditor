import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createPipelineNode, useFlowStore } from "@/stores/flow";

vi.mock("../../../modals/NodeJsonEditorModal", () => ({
  NodeJsonEditorModal: ({
    open,
    node,
  }: {
    open: boolean;
    node: { type: string; data: { label?: string } } | null;
  }) =>
    open && node ? (
      <div>
        <span>编辑节点 JSON</span>
        <span>{`${node.type} - ${node.data.label ?? "未命名"}`}</span>
      </div>
    ) : null,
}));

import { CanvasNodeContextMenu } from "./CanvasNodeContextMenu";

describe("CanvasNodeContextMenu", () => {
  afterEach(() => {
    cleanup();
    useFlowStore.getState().replace([], [], {
      isFitView: false,
      skipHistory: true,
    });
    useFlowStore.getState().clearHistory();
    vi.restoreAllMocks();
  });

  it("只注册一次 JSON 编辑事件，并能打开单例编辑器", async () => {
    const node = createPipelineNode("context-node", { label: "Context" });
    useFlowStore.getState().replace([node], [], {
      isFitView: false,
      skipHistory: true,
    });

    const addEventListener = vi.spyOn(window, "addEventListener");
    const removeEventListener = vi.spyOn(window, "removeEventListener");
    const onOpenChange = vi.fn();
    const view = render(
      <CanvasNodeContextMenu
        nodeId={node.id}
        position={{ x: 10, y: 20 }}
        open={false}
        onOpenChange={onOpenChange}
      />,
    );

    expect(
      addEventListener.mock.calls.filter(
        ([eventName]) => eventName === "mpe:edit-node-json",
      ),
    ).toHaveLength(1);

    act(() => {
      window.dispatchEvent(
        new CustomEvent("mpe:edit-node-json", { detail: { node } }),
      );
    });

    await waitFor(() =>
      expect(screen.getByText("编辑节点 JSON")).toBeInTheDocument(),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);

    act(() => {
      useFlowStore
        .getState()
        .setNodeData("context-node", "direct", "label", "Latest");
    });
    await waitFor(() =>
      expect(screen.getByText("pipeline - Latest")).toBeInTheDocument(),
    );

    view.unmount();
    expect(
      removeEventListener.mock.calls.filter(
        ([eventName]) => eventName === "mpe:edit-node-json",
      ),
    ).toHaveLength(1);
  });
});
