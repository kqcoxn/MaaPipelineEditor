import { create } from "zustand";
import { persist, subscribeWithSelector } from "zustand/middleware";

export const PROJECT_SIDEBAR_DEFAULT_WIDTH = 280;
export const PROJECT_SIDEBAR_MIN_WIDTH = 240;
export const PROJECT_SIDEBAR_MAX_WIDTH = 480;

interface ProjectSidebarState {
  visible: boolean;
  width: number;
}

interface ProjectSidebarActions {
  setVisible: (visible: boolean) => void;
  toggle: () => void;
  setWidth: (width: number) => void;
}

type ProjectSidebarStore = ProjectSidebarState & ProjectSidebarActions;

export function clampProjectSidebarWidth(width: number): number {
  if (!Number.isFinite(width)) return PROJECT_SIDEBAR_DEFAULT_WIDTH;
  return Math.min(
    PROJECT_SIDEBAR_MAX_WIDTH,
    Math.max(PROJECT_SIDEBAR_MIN_WIDTH, Math.round(width)),
  );
}

export function shouldRenderProjectSidebar(
  isEmbed: boolean,
  connected: boolean,
  visible: boolean,
): boolean {
  return !isEmbed && connected && visible;
}

export const useProjectSidebarStore = create<ProjectSidebarStore>()(
  persist(
    subscribeWithSelector((set, get) => ({
      visible: true,
      width: PROJECT_SIDEBAR_DEFAULT_WIDTH,
      setVisible(visible) {
        set({ visible });
      },
      toggle() {
        set({ visible: !get().visible });
      },
      setWidth(width) {
        set({ width: clampProjectSidebarWidth(width) });
      },
    })),
    {
      name: "mpe.project-sidebar",
      partialize: ({ visible, width }) => ({ visible, width }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<ProjectSidebarState>;
        return {
          ...currentState,
          visible:
            typeof persisted.visible === "boolean"
              ? persisted.visible
              : currentState.visible,
          width:
            typeof persisted.width === "number"
              ? clampProjectSidebarWidth(persisted.width)
              : currentState.width,
        };
      },
    },
  ),
);
