import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnchorReferenceList } from "./AnchorReferenceList";

const reference = {
  id: "remote-node-id",
  label: "RemoteNode",
  relativePath: "pipelines/remote.json",
  isCurrentFile: false,
};

describe("AnchorReferenceList", () => {
  afterEach(cleanup);

  it("renders iframe anchor definitions as read-only rows", () => {
    const onNavigate = vi.fn();
    const { container } = render(
      <AnchorReferenceList
        canNavigate={false}
        referenceNodes={[reference]}
        onNavigate={onNavigate}
      />,
    );

    fireEvent.click(screen.getByText("RemoteNode"));

    expect(onNavigate).not.toHaveBeenCalled();
    expect(container.querySelector("button")).toBeNull();
    expect(container.querySelector(".anticon-export")).toBeNull();
  });

  it("keeps standalone anchor references clickable", () => {
    const onNavigate = vi.fn();
    render(
      <AnchorReferenceList
        canNavigate
        referenceNodes={[reference]}
        onNavigate={onNavigate}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "跳转到节点 RemoteNode" }),
    );

    expect(onNavigate).toHaveBeenCalledWith(reference);
  });
});
