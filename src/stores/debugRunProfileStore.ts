import { create } from "zustand";
import type {
  DebugArtifactPolicy,
  DebugNodeTarget,
  DebugRunMode,
  DebugRunProfile,
  DebugRunRequest,
} from "../features/debug/types";
import {
  buildDebugSnapshotBundle,
  resolveDebugNodeTarget,
} from "../features/debug/snapshot";
import { useConfigStore } from "./configStore";
import { useLocalFileStore } from "./localFileStore";
import { useMFWStore } from "./mfwStore";

const STORAGE_KEY = "mpe_debug_run_profile_v1";

interface DebugRunProfileSnapshot {
  profile: DebugRunProfile;
  artifactPolicy: DebugArtifactPolicy;
}

interface DebugRunProfileState extends DebugRunProfileSnapshot {
  setProfile: (profile: DebugRunProfile) => void;
  updateProfile: (updates: Partial<DebugRunProfile>) => void;
  setEntry: (entry: DebugNodeTarget) => void;
  setResourcePaths: (resourcePaths: string[]) => void;
  setArtifactPolicy: (policy: DebugArtifactPolicy) => void;
  buildRunRequest: (
    mode: DebugRunMode,
    targetNodeId?: string,
    sessionId?: string,
  ) => DebugRunRequest;
}

const defaultArtifactPolicy: DebugArtifactPolicy = {
  includeRawImage: false,
  includeDrawImage: true,
  includeActionDetail: true,
};

function createDefaultProfile(): DebugRunProfile {
  const entry = {
    fileId: "",
    nodeId: "",
    runtimeName: "",
  };

  return {
    id: "default",
    name: "默认调试 Profile",
    interfaces: [],
    resourcePaths: [],
    controller: {
      type: "adb",
      options: {},
    },
    agents: [],
    entry,
    savePolicy: useConfigStore.getState().configs.saveFilesBeforeDebug
      ? "save-open-files"
      : "sandbox",
    maaOptions: {
      debugMode: true,
      saveDraw: true,
      saveOnError: true,
      drawQuality: 80,
    },
  };
}

function readSnapshot(): DebugRunProfileSnapshot {
  const fallback = {
    profile: createDefaultProfile(),
    artifactPolicy: defaultArtifactPolicy,
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<DebugRunProfileSnapshot>;
    return {
      profile: {
        ...fallback.profile,
        ...parsed.profile,
        controller: {
          ...fallback.profile.controller,
          ...parsed.profile?.controller,
          options: parsed.profile?.controller?.options ?? {},
        },
        maaOptions: {
          ...fallback.profile.maaOptions,
          ...parsed.profile?.maaOptions,
        },
        agents: parsed.profile?.agents ?? fallback.profile.agents,
        interfaces: parsed.profile?.interfaces ?? fallback.profile.interfaces,
        resourcePaths:
          parsed.profile?.resourcePaths ?? fallback.profile.resourcePaths,
      },
      artifactPolicy: {
        ...defaultArtifactPolicy,
        ...parsed.artifactPolicy,
      },
    };
  } catch (error) {
    console.warn("[debugRunProfileStore] Failed to read profile:", error);
    return fallback;
  }
}

function writeSnapshot(snapshot: DebugRunProfileSnapshot): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch (error) {
    console.warn("[debugRunProfileStore] Failed to write profile:", error);
  }
}

function normalizeResourcePaths(resourcePaths: string[]): string[] {
  const explicitPaths = resourcePaths
    .map((path) => path.trim())
    .filter(Boolean);
  if (explicitPaths.length > 0) return explicitPaths;

  return useLocalFileStore
    .getState()
    .resourceBundles.map((bundle) => bundle.abs_path)
    .filter(Boolean);
}

function resolveControllerType(): DebugRunProfile["controller"]["type"] {
  const controllerType = useMFWStore.getState().controllerType;
  if (
    controllerType === "adb" ||
    controllerType === "win32" ||
    controllerType === "dbg" ||
    controllerType === "replay" ||
    controllerType === "record"
  ) {
    return controllerType;
  }
  return "adb";
}

export const useDebugRunProfileStore = create<DebugRunProfileState>(
  (set, get) => {
    const initial = readSnapshot();

    const commit = (snapshot: DebugRunProfileSnapshot) => {
      writeSnapshot(snapshot);
      set(snapshot);
    };

    return {
      ...initial,

      setProfile: (profile) =>
        commit({
          profile,
          artifactPolicy: get().artifactPolicy,
        }),

      updateProfile: (updates) => {
        const next = {
          ...get().profile,
          ...updates,
        };
        commit({
          profile: next,
          artifactPolicy: get().artifactPolicy,
        });
      },

      setEntry: (entry) => {
        const next = {
          ...get().profile,
          entry,
        };
        commit({
          profile: next,
          artifactPolicy: get().artifactPolicy,
        });
      },

      setResourcePaths: (resourcePaths) => {
        const next = {
          ...get().profile,
          resourcePaths,
        };
        commit({
          profile: next,
          artifactPolicy: get().artifactPolicy,
        });
      },

      setArtifactPolicy: (artifactPolicy) =>
        commit({
          profile: get().profile,
          artifactPolicy,
        }),

      buildRunRequest: (mode, targetNodeId, sessionId) => {
        const bundle = buildDebugSnapshotBundle();
        const storeProfile = get().profile;
        const mfwState = useMFWStore.getState();
        const target =
          targetNodeId !== undefined
            ? resolveDebugNodeTarget(targetNodeId, bundle.resolverSnapshot)
            : undefined;
        const snapshotEntry =
          bundle.resolverSnapshot.nodes.find(
            (node) => node.fileId === bundle.resolverSnapshot.rootFileId,
          ) ?? bundle.resolverSnapshot.nodes[0];
        const fallbackEntry = snapshotEntry
          ? {
              fileId: snapshotEntry.fileId,
              nodeId: snapshotEntry.nodeId,
              runtimeName: snapshotEntry.runtimeName,
            }
          : storeProfile.entry;
        const hasStoredEntry = Boolean(storeProfile.entry.runtimeName);
        const entry = target ?? (hasStoredEntry ? storeProfile.entry : fallbackEntry);
        const controllerType = resolveControllerType();
        const controllerOptions = {
          ...storeProfile.controller.options,
          ...(mfwState.controllerId && { controllerId: mfwState.controllerId }),
        };

        return {
          sessionId,
          profileId: storeProfile.id,
          profile: {
            ...storeProfile,
            entry,
            resourcePaths: normalizeResourcePaths(storeProfile.resourcePaths),
            controller: {
              type: controllerType,
              options: controllerOptions,
            },
          },
          mode,
          graphSnapshot: bundle.graphSnapshot,
          resolverSnapshot: bundle.resolverSnapshot,
          target:
            mode === "run-from-node" ||
            mode === "single-node-run" ||
            mode === "recognition-only" ||
            mode === "action-only" ||
            mode === "fixed-image-recognition"
              ? entry
              : undefined,
          overrides: bundle.overrides,
          artifactPolicy: get().artifactPolicy,
        };
      },
    };
  },
);
