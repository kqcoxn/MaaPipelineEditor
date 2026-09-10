import { act, cleanup, render } from "@testing-library/react";
import { ReactFlowProvider, useStoreApi } from "@xyflow/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StableEdgeLabelRenderer } from "./StableEdgeLabelRenderer";

afterEach(cleanup);

function createCanvas() {
  const root = document.createElement("div");
  const labels = document.createElement("div");
  labels.className = "react-flow__edgelabel-renderer";
  root.append(labels);
  return { root, labels };
}

function mountLabels(count = 1) {
  let store!: ReturnType<typeof useStoreApi>;
  function Labels() {
    store = useStoreApi();
    return Array.from({ length: count }, (_, index) => (
      <StableEdgeLabelRenderer key={index}>
        <span>label-{index}</span>
      </StableEdgeLabelRenderer>
    ));
  }
  const view = render(<ReactFlowProvider><Labels /></ReactFlowProvider>);
  return { store, ...view };
}

describe("StableEdgeLabelRenderer", () => {
  it("does not query the DOM again during repeated pan and zoom updates", () => {
    const { store } = mountLabels(100);
    const { root, labels } = createCanvas();
    act(() => store.setState({ domNode: root }));
    expect(labels.children).toHaveLength(100);
    const query = vi.spyOn(root, "querySelector");

    for (let frame = 1; frame <= 60; frame++) {
      act(() => store.setState({ transform: [frame, -frame, 1 + frame / 100] }));
    }

    expect(query.mock.calls.length).toBe(0);
    expect(labels.children).toHaveLength(100);
  });

  it("resolves a late canvas root and moves labels when the root changes", () => {
    const { store, unmount } = mountLabels();
    const first = createCanvas();
    const second = createCanvas();
    act(() => store.setState({ domNode: first.root }));
    expect(first.labels.textContent).toBe("label-0");

    act(() => store.setState({ domNode: second.root }));
    expect(first.labels.children).toHaveLength(0);
    expect(second.labels.textContent).toBe("label-0");

    unmount();
    expect(second.labels.children).toHaveLength(0);
  });

  it("keeps separate canvases' labels isolated", () => {
    const first = mountLabels(2);
    const second = mountLabels(3);
    const firstCanvas = createCanvas();
    const secondCanvas = createCanvas();
    act(() => {
      first.store.setState({ domNode: firstCanvas.root });
      second.store.setState({ domNode: secondCanvas.root });
    });
    expect(firstCanvas.labels.children).toHaveLength(2);
    expect(secondCanvas.labels.children).toHaveLength(3);
  });
});
