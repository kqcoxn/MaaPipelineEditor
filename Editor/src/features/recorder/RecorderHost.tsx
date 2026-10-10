import { lazy, Suspense } from "react";
import { useRecorderStore } from "./store";

const RecorderWorkbench = lazy(() => import("./RecorderWorkbench"));

export function RecorderHost() {
  const open = useRecorderStore((s) => s.open);
  return open ? <Suspense fallback={null}><RecorderWorkbench /></Suspense> : null;
}
