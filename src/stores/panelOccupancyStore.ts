import { create } from "zustand";

/**
 * 面板占位互斥系统
 *
 * 管理面板区域的互斥关系：同一区域内，同一时刻只有一个面板可以激活。
 * 面板通过声明式注册参与系统，互斥反应有多种形态（close/hide/offset）。
 */

// ========== 类型定义 ==========

/**面板所属区域 */
export type PanelArea = "right" | "left" | "bottom";

/**面板被排挤时的反应形态 */
export type PanelReaction = "close" | "hide" | "offset";

/**面板描述符 */
export interface PanelDescriptor {
  /**唯一标识 */
  id: string;
  /**所属区域 */
  area: PanelArea;
  /**被排挤时的反应 */
  reaction: PanelReaction;
  /**被动面板：只观察不抢占区域 */
  passive: boolean;
}

// ========== 面板注册表 ==========

const panelRegistry = new Map<string, PanelDescriptor>();

/**
 * 注册面板到系统
 * 应在应用初始化时调用，不在运行时动态增删
 */
function registerPanel(descriptor: PanelDescriptor): void {
  panelRegistry.set(descriptor.id, descriptor);
}

/**获取面板描述符 */
export function getPanelDescriptor(id: string): PanelDescriptor | undefined {
  return panelRegistry.get(id);
}

// ========== 初始化注册所有面板 ==========

// 右侧区域 - 主动面板
registerPanel({ id: "json", area: "right", reaction: "close", passive: false });
registerPanel({
  id: "field",
  area: "right",
  reaction: "close",
  passive: false,
});
registerPanel({ id: "edge", area: "right", reaction: "close", passive: false });
registerPanel({
  id: "nodeList",
  area: "right",
  reaction: "close",
  passive: false,
});

// 右侧区域 - 被动面板
registerPanel({
  id: "liveScreen",
  area: "right",
  reaction: "hide",
  passive: true,
});
registerPanel({
  id: "recognition",
  area: "right",
  reaction: "offset",
  passive: true,
});
registerPanel({
  id: "explorationFAB",
  area: "right",
  reaction: "hide",
  passive: true,
});

// ========== Store ==========

interface PanelOccupancyState {
  /**每个区域当前激活的面板 ID */
  activePanels: Record<PanelArea, string | null>;

  // Actions
  /**面板抢占其所属区域 */
  activate: (panelId: string) => void;
  /**面板释放其所属区域（仅当该面板是当前激活者时生效） */
  deactivate: (panelId: string) => void;
}

export const usePanelOccupancyStore = create<PanelOccupancyState>((set) => ({
  activePanels: {
    right: null,
    left: null,
    bottom: null,
  },

  activate: (panelId: string) => {
    const descriptor = panelRegistry.get(panelId);
    if (!descriptor) return;
    if (descriptor.passive) return; // 被动面板不能抢占区域

    set((state) => ({
      activePanels: {
        ...state.activePanels,
        [descriptor.area]: panelId,
      },
    }));
  },

  deactivate: (panelId: string) => {
    const descriptor = panelRegistry.get(panelId);
    if (!descriptor) return;

    set((state) => {
      // 仅当该面板是当前激活者时才释放
      if (state.activePanels[descriptor.area] !== panelId) {
        return state;
      }
      return {
        activePanels: {
          ...state.activePanels,
          [descriptor.area]: null,
        },
      };
    });
  },
}));
