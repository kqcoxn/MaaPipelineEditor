import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

interface WorkspaceState { view: "canvas" | "home" | "pi"; piPath?: string }
interface WorkspaceActions { showHome: () => void; showCanvas: () => void; showPi: (path: string) => void }

// Navigation is deliberately not persisted: every startup restores the canvas.
export const useWorkspaceStore = create<WorkspaceState & WorkspaceActions>()(subscribeWithSelector(set => ({
  view: "canvas",
  showPi: (piPath) => set({ view: "pi", piPath }),
  showHome: () => set({ view: "home" }),
  showCanvas: () => set({ view: "canvas" }),
})));
