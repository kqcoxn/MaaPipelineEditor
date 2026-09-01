import { useEffect, useRef } from "react";

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
  const modalOpen = useDebugSessionStore((state) => state.modalOpen);
  const openModal = useDebugSessionStore((state) => state.openModal);
  const modalOpenRef = useRef(modalOpen);
  modalOpenRef.current = modalOpen;
  useDebugRunStatusTracker();

  useEffect(
    () =>
      subscribeDebugRunRequests((intent: DebugRunRequestIntent) => {
        if (modalOpenRef.current) return;
        openModal("overview");
        window.setTimeout(() => queueDebugRun(intent), 0);
      }),
    [openModal],
  );

  return modalOpen ? (
    <LazyFeature
      loader={loadDebugModal}
      loadingLabel="正在加载调试功能包"
    />
  ) : null;
}

