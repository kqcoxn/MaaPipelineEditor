import { create } from "zustand";
import type {
  DebugAgentTransport,
  DebugAgentProfile,
  DebugArtifactPolicy,
  DebugRunInput,
  DebugNodeTarget,
  DebugPipelineOverride,
  DebugRunMode,
  DebugRunProfile,
  DebugRunRequest,
} from "../features/debug/types";
import {
  buildDebugSnapshotBundle,
  resolveDebugNodeTarget,
} from "../features/debug/snapshot";
import {
  DEFAULT_DEBUG_AGENT_TIMEOUT_MS,
  getDebugAgentProfileKey,
} from "../features/debug/agentProfile";
import { useLocalFileStore, type ResourceBundle } from "./localFileStore";
import { useMFWStore } from "./mfwStore";

const STORAGE_KEY = "mpe_debug_run_profiles_v3";
const LEGACY_STORAGE_KEY = "mpe_debug_run_profiles_v2";
const OLDER_LEGACY_STORAGE_KEY = "mpe_debug_run_profile_v1";

export interface DebugRunProfilePreset {
  id: string;
  profile: DebugRunProfile;
  artifactPolicy: DebugArtifactPolicy;
}

interface DebugRunProfilesSnapshot {
  profiles: DebugRunProfilePreset[];
  activeProfileId: string;
}

type PartialDebugRunProfilePreset = Omit<
  Partial<DebugRunProfilePreset>,
  "profile" | "artifactPolicy"
> & {
  profile?: Partial<DebugRunProfile>;
  artifactPolicy?: Partial<DebugArtifactPolicy>;
};

type PartialDebugRunProfilesSnapshot = Omit<
  Partial<DebugRunProfilesSnapshot>,
  "profiles"
> & {
  profiles?: PartialDebugRunProfilePreset[];
};

interface LegacyDebugRunProfileSnapshot {
  profile?: Partial<DebugRunProfile> & Record<string, unknown>;
  artifactPolicy?: Partial<DebugArtifactPolicy>;
}

interface DebugRunProfileState extends DebugRunProfilePreset {
  profiles: DebugRunProfilePreset[];
  activeProfileId: string;
  setActiveProfile: (profileId: string) => void;
  createProfile: () => void;
  deleteProfile: (profileId: string) => void;
  setProfile: (profile: DebugRunProfile) => void;
  updateProfile: (updates: Partial<DebugRunProfile>) => void;
  setEntry: (entry: DebugNodeTarget) => void;
  setResourcePaths: (resourcePaths: string[]) => void;
  setAgents: (agents: DebugAgentProfile[]) => void;
  setArtifactPolicy: (policy: DebugArtifactPolicy) => void;
  buildRunRequest: (
    mode: DebugRunMode,
    targetNodeId?: string,
    sessionId?: string,
    input?: DebugRunInput,
    overrides?: DebugPipelineOverride[],
  ) => DebugRunRequest;
}

const defaultArtifactPolicy: DebugArtifactPolicy = {
  includeRawImage: true,
  includeDrawImage: true,
  includeActionDetail: true,
};

function createDefaultProfile(id = "default", name = "默认调试配置"): DebugRunProfile {
  return {
    id,
    name,
    resourcePaths: [],
    controller: {
      type: "adb",
      options: {},
    },
    agents: [],
    entry: {
      fileId: "",
      nodeId: "",
      runtimeName: "",
    },
    savePolicy: "sandbox",
    maaOptions: {
      debugMode: true,
      saveDraw: true,
      saveOnError: true,
      drawQuality: 80,
    },
  };
}

function createDefaultPreset(id = "default", name = "默认调试配置"): DebugRunProfilePreset {
  return {
    id,
    profile: createDefaultProfile(id, name),
    artifactPolicy: defaultArtifactPolicy,
  };
}

function readSnapshot(): DebugRunProfilesSnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return normalizeSnapshot(JSON.parse(raw) as Partial<DebugRunProfilesSnapshot>);
    }

    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw) as Partial<DebugRunProfilesSnapshot>;
      return normalizeSnapshot(migrateLegacySnapshot(legacy));
    }

    const olderLegacyRaw = localStorage.getItem(OLDER_LEGACY_STORAGE_KEY);
    if (olderLegacyRaw) {
      const legacy = JSON.parse(olderLegacyRaw) as LegacyDebugRunProfileSnapshot;
      return normalizeSnapshot({
        profiles: [
          {
            id: stringFromValue(legacy.profile?.id) ?? "default",
            profile: sanitizeProfile(
              migrateLegacyProfile(legacy.profile),
            ),
            artifactPolicy: {
              ...defaultArtifactPolicy,
              ...legacy.artifactPolicy,
            },
          },
        ],
        activeProfileId: stringFromValue(legacy.profile?.id) ?? "default",
      });
    }
  } catch (error) {
    console.warn("[debugRunProfileStore] Failed to read profiles:", error);
  }
  return normalizeSnapshot({
    profiles: [createDefaultPreset()],
    activeProfileId: "default",
  });
}

function writeSnapshot(snapshot: DebugRunProfilesSnapshot): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch (error) {
    console.warn("[debugRunProfileStore] Failed to write profiles:", error);
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
  if (controllerType === "adb" || controllerType === "win32") {
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
    const initialSnapshot = readSnapshot();
    const initialActive = activePreset(initialSnapshot);

    const commit = (snapshot: DebugRunProfilesSnapshot) => {
      const next = normalizeSnapshot(snapshot);
      const active = activePreset(next);
      writeSnapshot(next);
      set({
        profiles: next.profiles,
        activeProfileId: next.activeProfileId,
        ...active,
      });
    };

    const updateActivePreset = (
      updater: (preset: DebugRunProfilePreset) => DebugRunProfilePreset,
    ) => {
      const current = get();
      const currentPreset = activePreset({
        profiles: current.profiles,
        activeProfileId: current.activeProfileId,
      });
      const nextPreset = normalizePreset(updater(currentPreset));
      commit({
        profiles: current.profiles.map((profile) =>
          profile.id === current.activeProfileId ? nextPreset : profile,
        ),
        activeProfileId: nextPreset.id,
      });
    };

    return {
      profiles: initialSnapshot.profiles,
      activeProfileId: initialSnapshot.activeProfileId,
      ...initialActive,

      setActiveProfile: (profileId) => {
        if (!get().profiles.some((profile) => profile.id === profileId)) return;
        commit({
          profiles: get().profiles,
          activeProfileId: profileId,
        });
      },

      createProfile: () => {
        const current = get();
        const nextId = uniqueProfileId(current.profiles);
        const nextName = `调试配置 ${current.profiles.length + 1}`;
        const currentPreset = activePreset({
          profiles: current.profiles,
          activeProfileId: current.activeProfileId,
        });
        const nextPreset = normalizePreset({
          ...clonePreset(currentPreset),
          id: nextId,
          profile: {
            ...current.profile,
            id: nextId,
            name: nextName,
          },
        });
        commit({
          profiles: [...current.profiles, nextPreset],
          activeProfileId: nextId,
        });
      },

      deleteProfile: (profileId) => {
        const current = get();
        if (current.profiles.length <= 1) return;
        const deleteIndex = current.profiles.findIndex(
          (profile) => profile.id === profileId,
        );
        if (deleteIndex < 0) return;
        const nextProfiles = current.profiles.filter(
          (profile) => profile.id !== profileId,
        );
        const nextActiveProfileId =
          current.activeProfileId === profileId
            ? nextProfiles[Math.max(0, deleteIndex - 1)]?.id ??
              nextProfiles[0].id
            : current.activeProfileId;
        commit({
          profiles: nextProfiles,
          activeProfileId: nextActiveProfileId,
        });
      },

      setProfile: (profile) =>
        updateActivePreset((preset) => ({
          ...preset,
          id: profile.id,
          profile: sanitizeProfile(profile, preset.profile),
        })),

      updateProfile: (updates) =>
        updateActivePreset((preset) => ({
          ...preset,
          profile: sanitizeProfile(
            {
              ...preset.profile,
              ...updates,
            },
            preset.profile,
          ),
        })),

      setEntry: (entry) =>
        updateActivePreset((preset) => ({
          ...preset,
          profile: {
            ...preset.profile,
            entry,
          },
        })),

      setResourcePaths: (resourcePaths) =>
        updateActivePreset((preset) => ({
          ...preset,
          profile: {
            ...preset.profile,
            resourcePaths,
          },
        })),

      setAgents: (agents) =>
        updateActivePreset((preset) => ({
          ...preset,
          profile: {
            ...preset.profile,
            agents: agents.map((agent) => sanitizeAgent(agent)),
          },
        })),

      setArtifactPolicy: (artifactPolicy) =>
        updateActivePreset((preset) => ({
          ...preset,
          artifactPolicy: {
            ...defaultArtifactPolicy,
            ...artifactPolicy,
          },
        })),

      buildRunRequest: (mode, targetNodeId, sessionId, input, overrides) => {
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
              sourcePath: snapshotEntry.sourcePath,
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
        const requestInput: DebugRunInput = { ...input };
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
            mode === "action-only"
              ? entry
              : undefined,
          overrides:
            overrides && overrides.length > 0 ? [...overrides] : undefined,
          artifactPolicy: get().artifactPolicy,
          input:
            Object.keys(normalizedInput).length > 0 ? normalizedInput : undefined,
        };
      },
    };
  },
);

function normalizeSnapshot(
  snapshot: PartialDebugRunProfilesSnapshot,
): DebugRunProfilesSnapshot {
  const profiles = Array.isArray(snapshot.profiles)
    ? snapshot.profiles.map((profile, index) =>
        normalizePreset(profile, index),
      )
    : [];
  const normalizedProfiles =
    profiles.length > 0 ? profiles : [createDefaultPreset()];
  const activeProfileId =
    stringFromValue(snapshot.activeProfileId) ?? normalizedProfiles[0].id;
  return {
    profiles: normalizedProfiles,
    activeProfileId: normalizedProfiles.some(
      (profile) => profile.id === activeProfileId,
    )
      ? activeProfileId
      : normalizedProfiles[0].id,
  };
}

function normalizePreset(
  preset: PartialDebugRunProfilePreset | undefined,
  index = 0,
): DebugRunProfilePreset {
  const fallback = createDefaultPreset(
    index === 0 ? "default" : `profile-${index + 1}`,
    index === 0 ? "默认调试配置" : `调试配置 ${index + 1}`,
  );
  const profile = sanitizeProfile(preset?.profile, fallback.profile);
  const id = stringFromValue(preset?.id) ?? profile.id;
  const normalizedProfile = {
    ...profile,
    id,
  };
  return {
    id,
    profile: normalizedProfile,
    artifactPolicy: {
      ...defaultArtifactPolicy,
      ...preset?.artifactPolicy,
    },
  };
}

function sanitizeProfile(
  profile?: Partial<DebugRunProfile>,
  fallback = createDefaultProfile(),
): DebugRunProfile {
  const controller = profile?.controller;
  const entry = isCompleteEntry(profile?.entry)
    ? {
        fileId: profile.entry.fileId,
        nodeId: profile.entry.nodeId,
        runtimeName: profile.entry.runtimeName,
        sourcePath: sanitizeOptionalString(profile.entry.sourcePath),
      }
    : fallback.entry;
  return {
    id: stringFromValue(profile?.id) ?? fallback.id,
    name: stringFromValue(profile?.name) ?? fallback.name,
    resourcePaths: sanitizeStringArray(profile?.resourcePaths),
    controller: {
      type: isControllerType(controller?.type)
        ? controller.type
        : fallback.controller.type,
      options: isRecord(controller?.options)
        ? { ...controller.options }
        : { ...fallback.controller.options },
    },
    agents: Array.isArray(profile?.agents)
      ? profile.agents.map((agent) => sanitizeAgent(agent))
      : fallback.agents,
    entry,
    savePolicy: isSavePolicy(profile?.savePolicy)
      ? profile.savePolicy
      : fallback.savePolicy,
    maaOptions: {
      ...fallback.maaOptions,
      ...(isRecord(profile?.maaOptions) ? profile.maaOptions : {}),
    },
  };
}

function sanitizeAgent(agent: Partial<DebugAgentProfile>): DebugAgentProfile {
  const transport: DebugAgentTransport =
    agent.transport === "tcp" ? "tcp" : "identifier";
  const sanitizedAgent = {
    transport,
    identifier: stringFromValue(agent.identifier),
    tcpPort:
      typeof agent.tcpPort === "number" && Number.isFinite(agent.tcpPort)
        ? agent.tcpPort
        : undefined,
  };

  return {
    id:
      getDebugAgentProfileKey(sanitizedAgent) ??
      stringFromValue(agent.id) ??
      `agent-${Date.now()}`,
    enabled: Boolean(agent.enabled),
    transport,
    identifier: sanitizedAgent.identifier,
    tcpPort: sanitizedAgent.tcpPort,
    bindResources: sanitizeStringArray(agent.bindResources),
    timeoutMs:
      typeof agent.timeoutMs === "number" && Number.isFinite(agent.timeoutMs)
        ? agent.timeoutMs
        : DEFAULT_DEBUG_AGENT_TIMEOUT_MS,
    required: typeof agent.required === "boolean" ? agent.required : undefined,
  };
}

function activePreset(snapshot: DebugRunProfilesSnapshot): DebugRunProfilePreset {
  return (
    snapshot.profiles.find(
      (profile) => profile.id === snapshot.activeProfileId,
    ) ?? snapshot.profiles[0]
  );
}

function clonePreset(preset: DebugRunProfilePreset): DebugRunProfilePreset {
  return {
    id: preset.id,
    profile: {
      ...preset.profile,
      controller: {
        ...preset.profile.controller,
        options: { ...preset.profile.controller.options },
      },
      agents: preset.profile.agents.map((agent) => ({ ...agent })),
      entry: { ...preset.profile.entry },
      maaOptions: { ...preset.profile.maaOptions },
      resourcePaths: [...preset.profile.resourcePaths],
    },
    artifactPolicy: { ...preset.artifactPolicy },
  };
}

function uniqueProfileId(profiles: DebugRunProfilePreset[]): string {
  const taken = new Set(profiles.map((profile) => profile.id));
  let index = profiles.length + 1;
  let id = `profile-${index}`;
  while (taken.has(id)) {
    index += 1;
    id = `profile-${index}`;
  }
  return id;
}

function sanitizeStringArray(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => stringFromValue(value))
    .filter((value): value is string => Boolean(value));
}

function stringFromValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}

function sanitizeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}

function migrateLegacySnapshot(
  snapshot: PartialDebugRunProfilesSnapshot,
): PartialDebugRunProfilesSnapshot {
  if (!Array.isArray(snapshot.profiles)) return snapshot;
  return {
    ...snapshot,
    profiles: snapshot.profiles.map((preset) => ({
      ...preset,
      profile: migrateLegacyProfile(preset.profile),
    })),
  };
}

function migrateLegacyProfile(
  profile?: Partial<DebugRunProfile>,
): Partial<DebugRunProfile> | undefined {
  if (!profile) return profile;
  if (profile.savePolicy !== "save-open-files") return profile;
  return {
    ...profile,
    savePolicy: "sandbox",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isControllerType(
  value: unknown,
): value is DebugRunProfile["controller"]["type"] {
  return (
    value === "adb" ||
    value === "win32" ||
    value === "dbg" ||
    value === "replay" ||
    value === "record"
  );
}

function isSavePolicy(value: unknown): value is DebugRunProfile["savePolicy"] {
  return (
    value === "sandbox" ||
    value === "save-open-files" ||
    value === "use-disk"
  );
}

function isCompleteEntry(value: unknown): value is DebugNodeTarget {
  if (!isRecord(value)) return false;
  return (
    typeof value.fileId === "string" &&
    typeof value.nodeId === "string" &&
    typeof value.runtimeName === "string"
  );
}
