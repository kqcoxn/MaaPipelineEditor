import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { useMFWStore } from "@/stores/connection/mfwStore";
import {
  newStep,
  type RecorderConfig,
  type RecorderFrame,
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
  select: (id: string) => void;
  remove: (id: string) => void;
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
    busy: false,
    resourcePath: "",
    setOpen: (open) => {
      if (open) {
        const { connectionStatus, controllerId } = useMFWStore.getState();
        set({
          open: true,
          recording: connectionStatus === "connected" && !!controllerId,
          detailsOpen: false,
        });
      } else get().reset();
    },
    setRecording: (recording) =>
      set({ recording, ...(recording ? { detailsOpen: false } : {}) }),
    setDetailsOpen: (detailsOpen) => set({ detailsOpen }),
    setLiveFrame: (liveFrame) => set({ liveFrame }),
    appendCapture: (step) =>
      set((state) => ({
        steps: [...state.steps, step],
        current: step,
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
        const update = (step: RecorderStep): RecorderStep => {
          if (step.id !== id || step.suggestion !== "pending") return step;
          const apply =
            step.version === version && patch;
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
    setResourcePath: (resourcePath) => set({ resourcePath }),
    select: (id) => {
      const state = get();
      const step = state.steps.find((s) => s.id === id);
      if (step) set({ current: step, detailsOpen: true, recording: false });
    },
    remove: (id) =>
      set((state) => ({
        steps: state.steps.filter((s) => s.id !== id),
        ...(state.current.id === id
          ? {
            current: newStep(),
            detailsOpen: false,
          }
          : {}),
      })),
    reset: () =>
      set({
        busy: false,
        sessionId: crypto.randomUUID(),
        steps: [],
        current: newStep(),
        open: false,
        recording: false,
        detailsOpen: false,
        liveFrame: undefined,
      }),
  })),
);
