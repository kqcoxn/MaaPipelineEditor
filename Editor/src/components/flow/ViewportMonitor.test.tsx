import { act, cleanup, render } from "@testing-library/react";
import { ReactFlowProvider, useStoreApi } from "@xyflow/react";
import { afterEach, expect, it } from "vitest";
import { useFlowStore } from "@/stores/flow";
import { ViewportMonitor } from "./ViewportMonitor";

afterEach(() => {
  cleanup();
  useFlowStore.setState({ pendingViewport: null });
});

it("画布就绪后应用最后一次请求，后续渲染不覆盖用户移动", async () => {
  let store: ReturnType<typeof useStoreApi>;
  function Probe() {
    store = useStoreApi();
    return <ViewportMonitor />;
  }
  const first = { x: -200, y: 400, zoom: 1.7 };
  const last = { x: -800, y: 100, zoom: 0.8 };
  useFlowStore.getState().requestViewport(first);
  const view = render(<ReactFlowProvider><Probe /></ReactFlowProvider>);
  expect(useFlowStore.getState().pendingViewport).toEqual(first);
  act(() => useFlowStore.getState().requestViewport(last));

  // 用最小 panZoom 适配器模拟底层画布挂载，保留真实 React Flow hooks/store。
  await act(async () => {
    store!.setState({ panZoom: {
      setViewport: async (viewport: typeof last) => {
        store!.setState({ transform: [viewport.x, viewport.y, viewport.zoom] });
        return { x: viewport.x, y: viewport.y, k: viewport.zoom };
      },
    } as NonNullable<ReturnType<typeof store.getState>["panZoom"]> });
  });
  expect(store!.getState().transform).toEqual([last.x, last.y, last.zoom]);
  expect(useFlowStore.getState().pendingViewport).toBeNull();
  expect(useFlowStore.getState().viewport).toEqual(last);

  act(() => store!.setState({ transform: [12, 34, 2] }));
  view.rerender(<ReactFlowProvider><Probe /></ReactFlowProvider>);
  expect(store!.getState().transform).toEqual([12, 34, 2]);
});
