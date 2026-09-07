import { create } from "zustand";

/**
 * 成就系统持久化状态
 * - counters: 原始行为计数器（持久化，成就条件的数据源，多个成就可共享）
 * - unlocked: 已解锁成就及时间戳（持久化）
 * - progress: 未解锁成就的进度快照（运行时派生，重启后由全量评估重建）
 *
 * 注意：本模块不依赖 features/achievements，引擎求值由外部触发后通过
 * applyEnginePatch 写回，保持 stores 层无业务依赖。
 */

export const ACHIEVEMENT_SCHEMA_VERSION = 1;

/**引擎评估结果补丁 */
export interface AchievementEnginePatch {
  /**计数器增量（累加） */
  counterDelta?: Record<string, number>;
  /**进度快照更新（覆盖） */
  progress?: Record<string, number>;
  /**新解锁的成就 id */
  unlock?: string[];
}

/**随配置导出的成就数据格式 */
export interface AchievementExportData {
  schemaVersion: number;
  counters: Record<string, number>;
  unlocked: Record<string, { at: number }>;
}

/**成就胶囊当前展示项：单次解锁或启动补发汇总 */
export type AchievementToast =
  | { kind: "unlock"; id: string }
  | { kind: "retroactive"; ids: string[] };

interface AchievementState {
  counters: Record<string, number>;
  unlocked: Record<string, { at: number }>;
  progress: Record<string, number>;
  /**成就墙弹窗开关（不持久化） */
  wallOpen: boolean;
  /**当前展示的成就胶囊（不持久化） */
  toast: AchievementToast | null;

  applyEnginePatch: (patch: AchievementEnginePatch) => void;
  setWallOpen: (open: boolean) => void;
  setToast: (toast: AchievementToast | null) => void;
  exportData: () => AchievementExportData;
  /**导入成就数据：unlocked 取并集（保留较早时间），counters 取较大值。返回是否有变化 */
  importData: (data: unknown) => boolean;
  resetAll: () => void;
}

const STORAGE_KEY = "mpe_achievements";

function isValidUnlocked(
  value: unknown,
): value is Record<string, { at: number }> {
  if (!value || typeof value !== "object") return false;
  return Object.values(value as Record<string, unknown>).every(
    (entry) =>
      !!entry &&
      typeof entry === "object" &&
      typeof (entry as { at?: unknown }).at === "number",
  );
}

function isValidCounters(value: unknown): value is Record<string, number> {
  if (!value || typeof value !== "object") return false;
  return Object.values(value as Record<string, unknown>).every(
    (entry) => typeof entry === "number" && Number.isFinite(entry),
  );
}

function loadPersisted(): Pick<AchievementState, "counters" | "unlocked"> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { counters: {}, unlocked: {} };
    const parsed = JSON.parse(raw);
    return {
      counters: isValidCounters(parsed.counters) ? parsed.counters : {},
      unlocked: isValidUnlocked(parsed.unlocked) ? parsed.unlocked : {},
    };
  } catch (error) {
    console.error("[Achievement] 读取成就缓存失败:", error);
    return { counters: {}, unlocked: {} };
  }
}

function savePersisted(state: AchievementState): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: ACHIEVEMENT_SCHEMA_VERSION,
        counters: state.counters,
        unlocked: state.unlocked,
      }),
    );
  } catch (error) {
    console.error("[Achievement] 保存成就缓存失败:", error);
  }
}

export const useAchievementStore = create<AchievementState>((set, get) => ({
  ...loadPersisted(),
  progress: {},
  wallOpen: false,
  toast: null,

  applyEnginePatch(patch) {
    set((state) => {
      const next: Partial<AchievementState> = {};

      if (patch.counterDelta && Object.keys(patch.counterDelta).length > 0) {
        const counters = { ...state.counters };
        for (const [key, delta] of Object.entries(patch.counterDelta)) {
          if (!Number.isFinite(delta) || delta === 0) continue;
          counters[key] = (counters[key] ?? 0) + delta;
        }
        next.counters = counters;
      }

      if (patch.progress) {
        next.progress = { ...state.progress, ...patch.progress };
      }

      if (patch.unlock && patch.unlock.length > 0) {
        const unlocked = { ...state.unlocked };
        const progress = { ...(next.progress ?? state.progress) };
        const now = Date.now();
        for (const id of patch.unlock) {
          if (unlocked[id]) continue;
          unlocked[id] = { at: now };
          delete progress[id];
        }
        next.unlocked = unlocked;
        next.progress = progress;
      }

      return next;
    });
  },

  setWallOpen(open) {
    set({ wallOpen: open });
  },

  setToast(toast) {
    set({ toast });
  },

  exportData() {
    const state = get();
    return {
      schemaVersion: ACHIEVEMENT_SCHEMA_VERSION,
      counters: { ...state.counters },
      unlocked: { ...state.unlocked },
    };
  },

  importData(data) {
    if (!data || typeof data !== "object") return false;
    const incoming = data as Partial<AchievementExportData>;
    const inCounters = isValidCounters(incoming.counters)
      ? incoming.counters
      : null;
    const inUnlocked = isValidUnlocked(incoming.unlocked)
      ? incoming.unlocked
      : null;
    if (!inCounters && !inUnlocked) return false;

    const state = get();
    let changed = false;

    const counters = { ...state.counters };
    if (inCounters) {
      for (const [key, value] of Object.entries(inCounters)) {
        if (value > (counters[key] ?? 0)) {
          counters[key] = value;
          changed = true;
        }
      }
    }

    const unlocked = { ...state.unlocked };
    if (inUnlocked) {
      for (const [id, entry] of Object.entries(inUnlocked)) {
        const existing = unlocked[id];
        if (!existing || entry.at < existing.at) {
          unlocked[id] = { at: entry.at };
          changed = true;
        }
      }
    }

    if (changed) set({ counters, unlocked });
    return changed;
  },

  resetAll() {
    set({ counters: {}, unlocked: {}, progress: {}, toast: null });
  },
}));

/**初始化成就持久化：状态变化时自动写入 localStorage */
export function initializeAchievementPersistence(): () => void {
  return useAchievementStore.subscribe((state, prevState) => {
    if (
      state.counters !== prevState.counters ||
      state.unlocked !== prevState.unlocked
    ) {
      savePersisted(state);
    }
  });
}
