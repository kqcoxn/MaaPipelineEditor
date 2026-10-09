import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import {
  newStep,
  validateConfig,
  type RecorderConfig,
  type RecorderFrame,
  type RecorderResult,
  type RecorderStep,
} from "./types";

interface RecorderState {
  open: boolean;
  recording: boolean;
  detailsOpen: boolean;
  liveFrame?: RecorderFrame;
  sessionId: string;
  steps: RecorderStep[];
  current: RecorderStep;
  dirty: boolean;
  busy: boolean;
  resourcePath: string;
}
interface RecorderActions {
  setOpen: (open: boolean) => void;
  setRecording: (recording: boolean) => void;
  setDetailsOpen: (open: boolean) => void;
  setLiveFrame: (frame: RecorderFrame) => void;
  appendCapture: (step: RecorderStep) => void;
  finishCapture: (
    id: string,
    capture: NonNullable<RecorderStep["capture"]>,
  ) => void;
  finishSuggestion: (
    sessionId: string,
    id: string,
    version: number,
    patch?: Partial<RecorderConfig>,
    error?: string,
  ) => void;
  skipSuggestions: () => void;
  setBusy: (busy: boolean) => void;
  setResourcePath: (path: string) => void;
  edit: (patch: Partial<RecorderConfig>) => void;
  setFrame: (frame: RecorderFrame, preserveResult?: boolean) => void;
  applyResult: (id: string, version: number, result: RecorderResult) => boolean;
  save: () => string | undefined;
  select: (id?: string) => void;
  remove: (id: string) => void;
  move: (id: string, delta: number) => void;
  reset: () => void;
}
export const useRecorderStore = create<RecorderState & RecorderActions>()(
  subscribeWithSelector((set, get) => ({
    open: false,
    recording: false,
    detailsOpen: false,
    liveFrame: undefined,
    sessionId: crypto.randomUUID(),
    steps: [],
    current: newStep(),
    dirty: false,
    busy: false,
    resourcePath: "",
    setOpen: (open) => set({ open, ...(!open ? { recording: false } : {}) }),
    setRecording: (recording) => set({ recording }),
    setDetailsOpen: (detailsOpen) => set({ detailsOpen }),
    setLiveFrame: (liveFrame) => set({ liveFrame }),
    appendCapture: (step) =>
      set((state) => ({
        steps: [...state.steps, step],
        current: step,
        dirty: false,
      })),
    finishCapture: (id, capture) =>
      set((state) => ({
        steps: state.steps.map((step) =>
          step.id === id ? { ...step, capture } : step,
        ),
        current:
          state.current.id === id
            ? { ...state.current, capture }
            : state.current,
      })),
    finishSuggestion: (sessionId, id, version, patch, error) =>
      set((state) => {
        if (state.sessionId !== sessionId) return state;
        const edited =
          state.current.id === id &&
          (state.dirty || state.current.version !== version);
        const update = (step: RecorderStep): RecorderStep => {
          if (step.id !== id || step.suggestion !== "pending") return step;
          const apply =
            !edited && !step.result && step.version === version && patch;
          return {
            ...step,
            suggestion: error ? "unavailable" : apply ? "ocr" : "template",
            suggestionError: error,
            ...(apply
              ? {
                  version: step.version + 1,
                  config: { ...step.config, ...patch },
                  result: undefined,
                }
              : {}),
          };
        };
        return {
          steps: state.steps.map(update),
          current: update(state.current),
        };
      }),
    skipSuggestions: () =>
      set((state) => {
        const skip = (step: RecorderStep): RecorderStep =>
          step.suggestion === "pending"
            ? { ...step, suggestion: "template" }
            : step;
        return { steps: state.steps.map(skip), current: skip(state.current) };
      }),
    setBusy: (busy) => set({ busy }),
    setResourcePath: (resourcePath) =>
      set((state) => ({
        resourcePath,
        current: {
          ...state.current,
          version: state.current.version + 1,
          result: undefined,
        },
        steps: state.steps.map((step) => ({ ...step, result: undefined })),
      })),
    edit: (patch) =>
      set((state) => ({
        dirty: true,
        current: {
          ...state.current,
          version: state.current.version + 1,
          result: undefined,
          config: {
            ...state.current.config,
            // Automatic offsets belong to a particular recognition box. A new
            // algorithm/template must not inherit its width/height correction.
            ...((patch.recognition &&
              patch.recognition !== state.current.config.recognition) ||
            (patch.templateImage &&
              patch.templateImage !== state.current.config.templateImage &&
              state.current.config.targetMode === "recognition")
              ? { offset: [0, 0, 0, 0] as [number, number, number, number] }
              : {}),
            ...patch,
          },
        },
      })),
    setFrame: (frame, preserveResult = false) =>
      set((state) => ({
        current: {
          ...state.current,
          frame,
          ...(frame.image !== state.current.frame?.image
            ? { templateCandidates: undefined, capturePoint: undefined }
            : {}),
          result: preserveResult ? state.current.result : undefined,
          version: state.current.version + 1,
        },
      })),
    applyResult: (id, version, result) => {
      const state = get();
      if (state.current.id !== id || state.current.version !== version)
        return false;
      set({
        current: { ...state.current, result },
        steps: state.steps.map((step) =>
          step.id === id && step.version === version
            ? { ...step, result }
            : step,
        ),
      });
      return true;
    },
    save: () => {
      const state = get();
      const error = validateConfig(state.current.config);
      if (error) return error;
      if (
        state.steps.length >= 200 &&
        !state.steps.some((s) => s.id === state.current.id)
      )
        return "单次录制最多保存 200 个步骤";
      const current = {
        ...state.current,
        config: {
          ...state.current.config,
          name:
            state.current.config.name.trim() ||
            `录制步骤_${state.steps.length + 1}`,
        },
      };
      const exists = state.steps.some((step) => step.id === current.id);
      set({
        current,
        dirty: false,
        steps: exists
          ? state.steps.map((step) => (step.id === current.id ? current : step))
          : [...state.steps, current],
      });
    },
    select: (id) => {
      const state = get();
      const step = state.steps.find((s) => s.id === id);
      set({
        current: step ?? { ...newStep(), frame: state.current.frame },
        dirty: false,
      });
    },
    remove: (id) =>
      set((state) => ({
        steps: state.steps.filter((s) => s.id !== id),
        ...(state.current.id === id
          ? {
              current: { ...newStep(), frame: state.current.frame },
              dirty: false,
            }
          : {}),
      })),
    move: (id, delta) => {
      const steps = [...get().steps];
      const index = steps.findIndex((s) => s.id === id);
      const next = index + delta;
      if (index < 0 || next < 0 || next >= steps.length) return;
      [steps[index], steps[next]] = [steps[next], steps[index]];
      set({ steps });
    },
    reset: () =>
      set({
        sessionId: crypto.randomUUID(),
        steps: [],
        current: newStep(),
        dirty: false,
        open: false,
        recording: false,
        detailsOpen: false,
        liveFrame: undefined,
      }),
  })),
);
