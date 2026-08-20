import { beforeEach, describe, expect, it } from "vitest";
import { useBusinessArchitectureStore } from "./store";
import type { BusinessArchitectureDocument } from "./types";

function createDocument(runId: string): BusinessArchitectureDocument {
  return {
    title: "日常流程",
    summary: "完成日常任务。",
    fileName: "daily.json",
    sourceRunId: runId,
    sourceStateVersion: 1,
    sourceSignature: "signature",
    generatedAt: 1,
    stages: [
      {
        id: "main",
        title: "执行任务",
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
  };
}

beforeEach(() => {
  useBusinessArchitectureStore.getState().clear();
});

describe("business architecture store", () => {
  it("保存产物时不自动打开，只有消息操作可以打开对应 Run", () => {
    const store = useBusinessArchitectureStore.getState();

    store.setDocument(createDocument("run-1"));
    expect(useBusinessArchitectureStore.getState().activeDocumentRunId).toBeNull();

    expect(store.openDocument("run-1")).toBe(true);
    expect(useBusinessArchitectureStore.getState().activeDocumentRunId).toBe(
      "run-1",
    );

    store.closeDocument();
    expect(useBusinessArchitectureStore.getState().activeDocumentRunId).toBeNull();
  });

  it("为不同 Run 分别保留架构产物", () => {
    const store = useBusinessArchitectureStore.getState();

    store.setDocument(createDocument("run-1"));
    store.setDocument(createDocument("run-2"));

    expect(Object.keys(useBusinessArchitectureStore.getState().documents)).toEqual([
      "run-1",
      "run-2",
    ]);
  });
});
