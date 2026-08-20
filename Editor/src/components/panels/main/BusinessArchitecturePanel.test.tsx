import { act, fireEvent, render, screen } from "@testing-library/react";
import { App as AntdApp } from "antd";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBusinessArchitectureStore } from "@/features/ai-harness";
import BusinessArchitecturePanel from "./BusinessArchitecturePanel";

vi.mock("@xyflow/react", async () => {
  const actual = await vi.importActual<typeof import("@xyflow/react")>(
    "@xyflow/react",
  );
  return {
    ...actual,
    ReactFlow: ({ children }: { children?: ReactNode }) => (
      <div data-testid="architecture-graph">{children}</div>
    ),
    Background: () => null,
    Controls: () => null,
    Handle: () => null,
  };
});

beforeEach(() => {
  useBusinessArchitectureStore.getState().clear();
});

describe("BusinessArchitecturePanel", () => {
  it("保存产物后保持关闭，显式打开后才展示 Modal", async () => {
    useBusinessArchitectureStore.getState().setDocument({
      title: "日常作业",
      summary: "完成日常作业。",
      fileName: "daily.json",
      sourceRunId: "run-1",
      sourceStateVersion: 1,
      sourceSignature: "signature",
      generatedAt: 1,
      stages: [
        {
          id: "main",
          title: "执行作业",
          description: "完成主要任务。",
          kind: "main",
          nodeIds: ["start"],
        },
      ],
      transitions: [],
      coverage: {
        includedNodeCount: 1,
        totalNodeCount: 1,
        autoAssignedNodeIds: [],
      },
    });

    render(
      <AntdApp>
        <BusinessArchitecturePanel />
      </AntdApp>,
    );

    expect(screen.queryByRole("dialog")).toBeNull();

    act(() => {
      useBusinessArchitectureStore.getState().openDocument("run-1");
    });
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("日常作业")).toBeInTheDocument();
    expect(screen.getByTestId("architecture-graph")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(
      useBusinessArchitectureStore.getState().activeDocumentRunId,
    ).toBeNull();
  });
});
