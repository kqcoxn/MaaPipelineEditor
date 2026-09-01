import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createGroupNode,
  createPipelineNode,
  useFlowStore,
} from "@/stores/flow";
import {
  findNodeIdByLabel,
  selectAndCenterNode,
  selectAndFitNodeIds,
} from "./flowNavigationService";

describe("flowNavigationService", () => {
  const setCenter = vi.fn();
  const fitView = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    const group = createGroupNode("group", {
      label: "Group",
      position: { x: 100, y: 50 },
    });
    const child = {
      ...createPipelineNode("child", {
        label: "Child",
        position: { x: 20, y: 30 },
      }),
      parentId: group.id,
      measured: { width: 100, height: 60 },
    };
    const other = createPipelineNode("other", { label: "Other" });
    useFlowStore.getState().replace([group, child, other], [], {
      isFitView: false,
      skipHistory: true,
    });
    useFlowStore.setState({
      instance: {
        fitView,
        getInternalNode: vi.fn(() => undefined),
        setCenter,
      } as never,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("selects and centers a grouped node through the ID index", () => {
    expect(findNodeIdByLabel("Child")).toBe("child");
    expect(selectAndCenterNode("child")).toBe(true);

    expect(useFlowStore.getState().selectedNodeIds).toEqual(new Set(["child"]));
    expect(setCenter).toHaveBeenCalledWith(170, 110, {
      duration: 500,
      zoom: 1.5,
    });
  });

  it("deduplicates IDs and delays fitView until its caller closes overlays", () => {
    const targetNodes = selectAndFitNodeIds(
      ["child", "other", "child", "missing"],
      { delay: 120, duration: 300, maxZoom: 1.35 },
    );

    expect(targetNodes.map((node) => node.id)).toEqual(["child", "other"]);
    expect(useFlowStore.getState().selectedNodeIds).toEqual(
      new Set(["child", "other"]),
    );
    expect(fitView).not.toHaveBeenCalled();

    vi.advanceTimersByTime(120);
    expect(fitView).toHaveBeenCalledWith({
      nodes: targetNodes,
      duration: 300,
      interpolate: undefined,
      maxZoom: 1.35,
      minZoom: undefined,
      padding: undefined,
    });
  });
});
