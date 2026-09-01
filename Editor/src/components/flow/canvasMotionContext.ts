import { createContext, useContext } from "react";

import type { CanvasMotionReason } from "@/hooks/useCanvasMotionPause";

export interface CanvasMotionContextValue {
  beginCanvasMotionPause: (reason: CanvasMotionReason) => void;
  endCanvasMotionPause: (reason: CanvasMotionReason) => void;
}

const emptyCanvasMotionContext: CanvasMotionContextValue = {
  beginCanvasMotionPause: () => undefined,
  endCanvasMotionPause: () => undefined,
};

export const CanvasMotionContext = createContext<CanvasMotionContextValue>(
  emptyCanvasMotionContext,
);

export const useCanvasMotionContext = () => useContext(CanvasMotionContext);
