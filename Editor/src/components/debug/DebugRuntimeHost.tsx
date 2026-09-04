import { useCallback, useEffect, useState } from "react";

import { LazyFeature } from "@/components/async/LazyFeature";
import {
  queueDebugRun,
  subscribeDebugRunRequests,
  type DebugRunRequestIntent,
} from "@/features/debug/actions/debugRunRequestBridge";
import { useDebugRunStatusTracker } from "@/features/debug/hooks/useDebugRunStatusTracker";
import { useDebugSessionStore } from "@/stores/debug/debugSessionStore";

const loadDebugModal = () =>
  import("./DebugModal").then((module) => ({ default: module.DebugModal }));

export function DebugRuntimeHost() {
  const [runtimeLoadRequested, setRuntimeLoadRequested] = useState(false);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const modalOpen = useDebugSessionStore((state) => state.modalOpen);
  useDebugRunStatusTracker();

  useEffect(() => {
    if (runtimeReady) return;

    return subscribeDebugRunRequests((intent: DebugRunRequestIntent) => {
      setRuntimeLoadRequested(true);
      queueDebugRun(intent);
    });
  }, [runtimeReady]);

  const handleRuntimeReady = useCallback(() => {
    setRuntimeReady(true);
  }, []);

  const shouldMountRuntime = modalOpen || runtimeLoadRequested || runtimeReady;

  return shouldMountRuntime ? (
    <LazyFeature
      loader={loadDebugModal}
      loadingLabel="正在加载调试功能包"
      componentProps={{ onRuntimeReady: handleRuntimeReady }}
    />
  ) : null;
}
