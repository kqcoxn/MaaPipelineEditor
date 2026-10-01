import { useLayoutEffect } from "react";
import { useOnViewportChange, useReactFlow } from "@xyflow/react";
import { useFlowStore } from "@/stores/flow";
import { useFileStore } from "@/stores/project/fileStore";

/**恢复请求保留到画布就绪；切换文件会替换请求，不使用延时动画。 */
export function ViewportMonitor() {
  const instance = useReactFlow();
  const pending = useFlowStore((state) => state.pendingViewport);
  useLayoutEffect(() => {
    if (!instance.viewportInitialized || !pending) return;
    // React 严格模式或同一提交内的新请求不能重复应用旧快照。
    if (useFlowStore.getState().pendingViewport !== pending) return;
    useFlowStore.setState({ pendingViewport: null, viewport: pending });
    void instance.setViewport(pending, { duration: 0 });
  }, [instance, pending]);

  useOnViewportChange({
    onEnd: (viewport) => {
      if (useFlowStore.getState().pendingViewport) return;
      useFlowStore.getState().updateViewport(viewport);
      useFileStore.getState().setFileConfig("savedViewport", { ...viewport });
    },
  });
  return null;
}
