import { create } from "zustand";
import type {
  DebugArtifactPolicy,
  DebugBatchRecognitionInput,
  DebugInterfaceImportSelections,
  DebugInterfaceImportResult,
  DebugRunInput,
  DebugNodeTarget,
  DebugRunMode,
  DebugRunProfile,
  DebugRunRequest,
  DebugScreenshotStreamConfig,
} from "../features/debug/types";
import {
  buildDebugSnapshotBundle,
  resolveDebugNodeTarget,
} from "../features/debug/snapshot";
import { useConfigStore } from "./configStore";
import { useLocalFileStore, type ResourceBundle } from "./localFileStore";
import { useMFWStore } from "./mfwStore";

const STORAGE_KEY = "mpe_debug_run_profile_v1";

interface DebugRunProfileSnapshot {
  profile: DebugRunProfile;
  artifactPolicy: DebugArtifactPolicy;
  fixedImageInput: Pick<DebugRunInput, "imagePath" | "imageRelativePath">;
  batchRecognitionImages: DebugBatchRecognitionInput[];
  screenshotStreamConfig: DebugScreenshotStreamConfig;
  interfaceImport?: DebugInterfaceImportResult;
  interfaceSelections?: DebugInterfaceImportSelections;
}

interface DebugRunProfileState extends DebugRunProfileSnapshot {
  setProfile: (profile: DebugRunProfile) => void;
  updateProfile: (updates: Partial<DebugRunProfile>) => void;
  setEntry: (entry: DebugNodeTarget) => void;
  setResourcePaths: (resourcePaths: string[]) => void;
  setAgents: (agents: DebugRunProfile["agents"]) => void;
  setScreenshotStreamConfig: (config: DebugScreenshotStreamConfig) => void;
  setFixedImageInput: (
    input: Pick<DebugRunInput, "imagePath" | "imageRelativePath">,
  ) => void;
  setBatchRecognitionImages: (images: DebugBatchRecognitionInput[]) => void;
  applyInterfaceImport: (result: DebugInterfaceImportResult) => void;
  setInterfaceSelections: (selections: DebugInterfaceImportSelections) => void;
  setArtifactPolicy: (policy: DebugArtifactPolicy) => void;
  buildRunRequest: (
    mode: DebugRunMode,
    targetNodeId?: string,
    sessionId?: string,
    input?: DebugRunInput,
  ) => DebugRunRequest;
}

const defaultArtifactPolicy: DebugArtifactPolicy = {
  includeRawImage: false,
  includeDrawImage: true,
  includeActionDetail: true,
};

const defaultScreenshotStreamConfig: DebugScreenshotStreamConfig = {
  intervalMs: 1000,
  force: false,
};

function createDefaultProfile(): DebugRunProfile {
  const entry = {
    fileId: "",
    nodeId: "",
    runtimeName: "",
  };

  return {
    id: "default",
    name: "默认调试配置",
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
    fixedImageInput: {},
    batchRecognitionImages: [],
    screenshotStreamConfig: defaultScreenshotStreamConfig,
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
      fixedImageInput: {
        ...fallback.fixedImageInput,
        ...parsed.fixedImageInput,
      },
      batchRecognitionImages:
        parsed.batchRecognitionImages ?? fallback.batchRecognitionImages,
      screenshotStreamConfig: {
        ...defaultScreenshotStreamConfig,
        ...parsed.screenshotStreamConfig,
      },
      interfaceImport: parsed.interfaceImport,
      interfaceSelections: parsed.interfaceSelections,
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

export function normalizeDebugResourcePaths(
  resourcePaths: string[],
  resourceBundles: ResourceBundle[] = useLocalFileStore.getState()
    .resourceBundles,
): string[] {
  const explicitPaths = resourcePaths
    .map((path) => path.trim())
    .filter(Boolean);
  if (explicitPaths.length > 0) return explicitPaths;

  return resourceBundles.map((bundle) => bundle.abs_path).filter(Boolean);
}

export function makeDebugResourceKey(
  resourcePaths: string[],
  resourceBundles?: ResourceBundle[],
): string {
  return normalizeDebugResourcePaths(resourcePaths, resourceBundles).join("\n");
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

function omitStoredControllerId(
  options: DebugRunProfile["controller"]["options"],
): DebugRunProfile["controller"]["options"] {
  const next = { ...options };
  delete next.controllerId;
  delete next.controller_id;
  return next;
}

export const useDebugRunProfileStore = create<DebugRunProfileState>(
  (set, get) => {
    const initial = readSnapshot();

    const commit = (snapshot: Partial<DebugRunProfileSnapshot>) => {
      const current = get();
      const next: DebugRunProfileSnapshot = {
        profile: snapshot.profile ?? current.profile,
        artifactPolicy: snapshot.artifactPolicy ?? current.artifactPolicy,
        fixedImageInput: snapshot.fixedImageInput ?? current.fixedImageInput,
        batchRecognitionImages:
          snapshot.batchRecognitionImages ?? current.batchRecognitionImages,
        screenshotStreamConfig:
          snapshot.screenshotStreamConfig ?? current.screenshotStreamConfig,
        interfaceImport:
          snapshot.interfaceImport === undefined
            ? current.interfaceImport
            : snapshot.interfaceImport,
        interfaceSelections:
          snapshot.interfaceSelections === undefined
            ? current.interfaceSelections
            : snapshot.interfaceSelections,
      };
      writeSnapshot(next);
      set(next);
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

      setAgents: (agents) => {
        commit({
          profile: {
            ...get().profile,
            agents,
          },
        });
      },

      setScreenshotStreamConfig: (screenshotStreamConfig) => {
        commit({ screenshotStreamConfig });
      },

      setFixedImageInput: (fixedImageInput) => {
        commit({ fixedImageInput });
      },

      setBatchRecognitionImages: (batchRecognitionImages) => {
        commit({ batchRecognitionImages });
      },

      applyInterfaceImport: (result) => {
        const current = get();
        const currentControllerId =
          current.profile.controller.options.controllerId ??
          current.profile.controller.options.controller_id;
        const preservedControllerOptions =
          typeof currentControllerId === "string" &&
          currentControllerId.trim() !== ""
            ? { controllerId: currentControllerId }
            : {};
        const controllerOptions = {
          ...result.profile.controller.options,
          ...preservedControllerOptions,
        };

        commit({
          profile: {
            ...result.profile,
            agents: result.profile.agents.map((agent) => ({
              ...agent,
              launchMode: agent.launchMode ?? "manual",
            })),
            controller: {
              ...result.profile.controller,
              options: controllerOptions,
            },
            savePolicy: current.profile.savePolicy,
            maaOptions: current.profile.maaOptions,
          },
          interfaceImport: result,
          interfaceSelections: result.selections,
        });
      },

      setInterfaceSelections: (interfaceSelections) => {
        commit({ interfaceSelections });
      },

      setArtifactPolicy: (artifactPolicy) =>
        commit({
          profile: get().profile,
          artifactPolicy,
        }),

      buildRunRequest: (mode, targetNodeId, sessionId, input) => {
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
        const entry =
          target ?? (hasStoredEntry ? storeProfile.entry : fallbackEntry);
        const controllerType = resolveControllerType();
        const liveControllerId =
          mfwState.connectionStatus === "connected"
            ? mfwState.controllerId
            : undefined;
        const controllerOptions = {
          ...omitStoredControllerId(storeProfile.controller.options),
          ...(liveControllerId && { controllerId: liveControllerId }),
        };
        const requestInput: DebugRunInput = {
          ...input,
          ...(mode === "fixed-image-recognition"
            ? {
                imagePath: get().fixedImageInput.imagePath,
                imageRelativePath: get().fixedImageInput.imageRelativePath,
              }
            : {}),
        };
        const normalizedInput = Object.fromEntries(
          Object.entries(requestInput).filter(([, value]) =>
            typeof value === "string" ? value.trim() !== "" : value !== undefined,
          ),
        ) as DebugRunInput;

        return {
          sessionId,
          profileId: storeProfile.id,
          profile: {
            ...storeProfile,
            entry,
            resourcePaths: normalizeDebugResourcePaths(
              storeProfile.resourcePaths,
            ),
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
          overrides: [
            ...bundle.overrides,
            ...(get().interfaceImport?.overrides ?? []),
          ],
          artifactPolicy: get().artifactPolicy,
          input:
            Object.keys(normalizedInput).length > 0 ? normalizedInput : undefined,
        };
      },
    };
  },
);
