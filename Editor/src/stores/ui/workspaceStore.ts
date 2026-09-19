import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

interface WorkspaceState { view: "canvas" | "home" }
interface WorkspaceActions { showHome: () => void; showCanvas: () => void }

// Navigation is deliberately not persisted: every startup restores the canvas.
export const useWorkspaceStore = create<WorkspaceState & WorkspaceActions>()(subscribeWithSelector(set => ({
  view: "canvas",
  showHome: () => set({ view: "home" }),
  showCanvas: () => set({ view: "canvas" }),
})));
