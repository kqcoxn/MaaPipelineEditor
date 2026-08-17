import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { message } from "antd";
import { useEmbedStore } from "@/stores/embed/embedStore";
import type { NodeType } from "@/stores/flow";
import { NodeTypeEnum } from "../../../flow/nodes";
import { crossFileService } from "../../../../services/crossFileService";
import { FieldPanelToolbarRight } from "./FieldPanelToolbar";

function createNode(type: NodeTypeEnum): NodeType {
  return {
    id: `${type}-node`,
    type,
    position: { x: 0, y: 0 },
    data: { label: "TargetNode" },
  } as NodeType;
}

describe("FieldPanelToolbarRight node navigation", () => {
  beforeEach(() => {
    useEmbedStore.getState().reset();
    vi.spyOn(message, "success").mockReturnValue(
      {} as ReturnType<typeof message.success>,
    );
    vi.spyOn(message, "warning").mockReturnValue(
      {} as ReturnType<typeof message.warning>,
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("hides Anchor navigation in iframe mode", () => {
    window.history.replaceState({}, "", "/?embed=true&origin=test-host");
    const navigate = vi.spyOn(crossFileService, "navigateToNodeByName");
    const { container } = render(
      <FieldPanelToolbarRight currentNode={createNode(NodeTypeEnum.Anchor)} />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("disables External navigation when the host capability is absent", () => {
    window.history.replaceState({}, "", "/?embed=true&origin=test-host");
    const navigate = vi.spyOn(crossFileService, "navigateToNodeByName");
    render(
      <FieldPanelToolbarRight currentNode={createNode(NodeTypeEnum.External)} />,
    );

    const button = screen.getByLabelText("宿主未声明节点导航能力");
    expect(button).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(button);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("keeps standalone External navigation enabled", async () => {
    window.history.replaceState({}, "", "/");
    const navigate = vi
      .spyOn(crossFileService, "navigateToNodeByName")
      .mockResolvedValue({ success: true, message: "已定位" });
    render(
      <FieldPanelToolbarRight currentNode={createNode(NodeTypeEnum.External)} />,
    );

    fireEvent.click(screen.getByLabelText("跳转到目标节点"));

    await vi.waitFor(() => expect(navigate).toHaveBeenCalledOnce());
  });
});
