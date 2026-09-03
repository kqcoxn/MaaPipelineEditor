import { create } from "zustand";

export interface ProcessUpdate {
  detail?: string;
  progress?: number;
}

interface ProcessEntry extends Required<ProcessUpdate> {
  id: number;
  label: string;
}

interface ProcessHandle {
  update: (update: ProcessUpdate) => void;
  finish: () => void;
}

interface ProcessState {
  entries: ProcessEntry[];
  begin: (label: string, initial?: ProcessUpdate) => ProcessHandle;
}

let nextProcessId = 1;
const PAINT_FALLBACK_MS = 100;
const PRODUCTION_MIN_PROCESS_VISIBLE_MS = 1_500;
const PRODUCTION_PROCESS_COMPLETE_HOLD_MS = 240;
export const BULK_PROCESS_NODE_THRESHOLD = 100;

export function getProcessTiming(isDevelopment = import.meta.env.DEV) {
  return isDevelopment
    ? { minimumVisibleMs: 0, completeHoldMs: 0 }
    : {
        minimumVisibleMs: PRODUCTION_MIN_PROCESS_VISIBLE_MS,
        completeHoldMs: PRODUCTION_PROCESS_COMPLETE_HOLD_MS,
      };
}

export function shouldShowBulkProcess(nodeCount: number): boolean {
  return nodeCount > BULK_PROCESS_NODE_THRESHOLD;
}

export const useProcessStore = create<ProcessState>((set) => ({
  entries: [],
  begin: (label, initial) => {
    const id = nextProcessId++;
    set((state) => ({
      entries: [
        ...state.entries,
        {
          id,
          label,
          detail: initial?.detail ?? "正在准备操作",
          progress: initial?.progress ?? 8,
        },
      ],
    }));

    let finished = false;
    return {
      update: (update) => {
        if (finished) return;
        set((state) => ({
          entries: state.entries.map((entry) =>
            entry.id === id ? { ...entry, ...update } : entry,
          ),
        }));
      },
      finish: () => {
        if (finished) return;
        finished = true;
        set((state) => ({
          entries: state.entries.filter((entry) => entry.id !== id),
        }));
      },
    };
  },
}));

function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

export function yieldToBrowserPaint(): Promise<void> {
  if (typeof requestAnimationFrame !== "function") {
    return wait(0);
  }

  return new Promise((resolve) => {
    requestAnimationFrame(() => setTimeout(resolve, 0));
  });
}

function waitForPaint(): Promise<void> {
  if (typeof requestAnimationFrame !== "function") {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    setTimeout(finish, PAINT_FALLBACK_MS);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        // Promise continuations run before the frame is painted. Defer once
        // more so the visible process layer reaches the screen first.
        setTimeout(finish, 0);
      }),
    );
  });
}

export async function runWithProcess<T>(
  label: string,
  task: (update: (update: ProcessUpdate) => void) => T | Promise<T>,
  initial?: ProcessUpdate,
): Promise<T> {
  const { minimumVisibleMs, completeHoldMs } = getProcessTiming();
  const startedAt = Date.now();
  const process = useProcessStore.getState().begin(label, initial);
  try {
    await waitForPaint();
    const result = await task(process.update);
    if (minimumVisibleMs > 0) {
      const elapsedMs = Date.now() - startedAt;
      await wait(
        Math.max(0, minimumVisibleMs - elapsedMs - completeHoldMs),
      );
      process.update({ detail: "操作已完成", progress: 100 });
      await wait(completeHoldMs);
    } else {
      // Keep the layer mounted while React commits and paints task results.
      await waitForPaint();
    }
    return result;
  } finally {
    process.finish();
  }
}
