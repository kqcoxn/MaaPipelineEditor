import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  createPipelineNode,
  useFlowStore,
} from "@/stores/flow";
import {
  SourceHandleTypeEnum,
  TargetHandleTypeEnum,
} from "@/components/flow/nodes";
import {
  AvoidanceRoutingProvider,
  useAvoidanceRoutingContext,
} from "./avoidanceRoutingContext";

function ContextProbe({
  onValue,
}: {
  onValue: (value: ReturnType<typeof useAvoidanceRoutingContext>) => void;
}) {
  onValue(useAvoidanceRoutingContext());
  return null;
}

afterEach(() => {
  act(() => {
    useFlowStore.getState().replace([], [], {
      isFitView: false,
      skipHistory: true,
    });
    useFlowStore.getState().clearHistory();
  });
});

describe("AvoidanceRoutingProvider", () => {
  it("只在所属修订号变化时替换公共输入引用", () => {
    const source = createPipelineNode("source", {
      label: "Source",
      position: { x: 0, y: 0 },
    });
    const target = createPipelineNode("target", {
      label: "Target",
      position: { x: 400, y: 0 },
    });
    useFlowStore.getState().replace(
      [source, target],
      [
        {
          id: "source-target",
          source: "source",
          sourceHandle: SourceHandleTypeEnum.Next,
          target: "target",
          targetHandle: TargetHandleTypeEnum.Target,
          label: 1,
          type: "marked",
        },
      ],
      { isFitView: false, skipHistory: true },
    );

    const values: Array<ReturnType<typeof useAvoidanceRoutingContext>> = [];
    render(
      <AvoidanceRoutingProvider enabled>
        <ContextProbe onValue={(value) => values.push(value)} />
      </AvoidanceRoutingProvider>,
    );

    const initial = values.at(-1)!;
    const initialBounds = initial.nodeBoundsList;
    const initialParallel = initial.parallelEdgeInfoById;

    act(() => {
      useFlowStore.getState().setNodeData("source", "data", "label", "Renamed");
    });
    expect(values.at(-1)?.nodeBoundsList).toBe(initialBounds);
    expect(values.at(-1)?.parallelEdgeInfoById).toBe(initialParallel);

    act(() => {
      useFlowStore.getState().updateNodes([
        {
          type: "position",
          id: "source",
          position: { x: 40, y: 20 },
          dragging: true,
        },
      ]);
    });
    expect(values.at(-1)?.nodeBoundsList).not.toBe(initialBounds);
    const afterLayout = values.at(-1)!;

    act(() => {
      useFlowStore.getState().addEdge({
        source: "source",
        sourceHandle: SourceHandleTypeEnum.Next,
        target: "target",
        targetHandle: TargetHandleTypeEnum.JumpBack,
      });
    });
    expect(values.at(-1)?.nodeBoundsList).toBe(afterLayout.nodeBoundsList);
    expect(values.at(-1)?.parallelEdgeInfoById).not.toBe(
      afterLayout.parallelEdgeInfoById,
    );
  });
});
