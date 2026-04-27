import { create } from "zustand";
import type {
  DebugArtifactPayload,
  DebugArtifactRef,
} from "../features/debug/types";

type ArtifactLoadStatus = "idle" | "loading" | "ready" | "error";

export interface DebugArtifactEntry {
  ref: DebugArtifactRef;
  status: ArtifactLoadStatus;
  payload?: DebugArtifactPayload;
  error?: string;
}

interface DebugArtifactState {
  artifacts: Record<string, DebugArtifactEntry>;
  selectedArtifactId?: string;
  upsertRef: (ref: DebugArtifactRef) => void;
  setLoading: (artifactId: string) => void;
  setPayload: (payload: DebugArtifactPayload) => void;
  setError: (artifactId: string, error: string) => void;
  selectArtifact: (artifactId?: string) => void;
  resetArtifacts: (sessionId?: string) => void;
}

export const useDebugArtifactStore = create<DebugArtifactState>((set) => ({
  artifacts: {},

  upsertRef: (ref) =>
    set((state) => {
      const current = state.artifacts[ref.id];
      return {
        artifacts: {
          ...state.artifacts,
          [ref.id]: {
            ref: { ...current?.ref, ...ref },
            status: current?.status ?? "idle",
            payload: current?.payload,
            error: current?.error,
          },
        },
      };
    }),

  setLoading: (artifactId) =>
    set((state) => {
      const current = state.artifacts[artifactId];
      if (!current) return {};
      return {
        artifacts: {
          ...state.artifacts,
          [artifactId]: {
            ...current,
            status: "loading",
            error: undefined,
          },
        },
      };
    }),

  setPayload: (payload) =>
    set((state) => ({
      artifacts: {
        ...state.artifacts,
        [payload.ref.id]: {
          ref: payload.ref,
          status: "ready",
          payload,
        },
      },
    })),

  setError: (artifactId, error) =>
    set((state) => {
      const current = state.artifacts[artifactId];
      if (!current) return {};
      return {
        artifacts: {
          ...state.artifacts,
          [artifactId]: {
            ...current,
            status: "error",
            error,
          },
        },
      };
    }),

  selectArtifact: (artifactId) => set({ selectedArtifactId: artifactId }),

  resetArtifacts: (sessionId) =>
    set((state) => {
      if (!sessionId) {
        return {
          artifacts: {},
          selectedArtifactId: undefined,
        };
      }
      const artifacts = Object.fromEntries(
        Object.entries(state.artifacts).filter(
          ([, entry]) => entry.ref.sessionId !== sessionId,
        ),
      );
      return {
        artifacts,
        selectedArtifactId:
          state.selectedArtifactId &&
          artifacts[state.selectedArtifactId] !== undefined
            ? state.selectedArtifactId
            : undefined,
      };
    }),
}));
