import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createPipelineNode, useFlowStore } from "@/stores/flow";
import NodeListPanel from "./NodeListPanel";

describe("NodeListPanel", () => {
  afterEach(() => {
    cleanup();
    useFlowStore.setState({ nodes: [], edges: [], instance: null });
  });

  it("大图仅挂载可见 rows，并只创建一个预览 Popover", async () => {
    useFlowStore.setState({
      nodes: Array.from({ length: 300 }, (_, index) =>
        createPipelineNode(`node-${index}`, { label: `Node ${index}` }),
      ),
      edges: [],
      instance: null,
    });
    render(<NodeListPanel visible />);

    const list = await screen.findByRole("list", { name: /节点列表，共 300 个节点/ });
    expect(
      list.querySelectorAll('[data-virtual-row-key^="node:"]').length,
    ).toBeLessThan(20);

    fireEvent.mouseEnter(screen.getByText("Node 0").closest("div")!);
    await waitFor(
      () => expect(document.querySelectorAll(".ant-popover")).toHaveLength(1),
      { timeout: 1000 },
    );
  });
});
