import type { ProjectInterfaceAgentOverride } from "./types";

const STORAGE_KEY = "mpe_pi_debug_preferences_v1";

export interface ProjectInterfaceAgentPreferences {
  enabled: Record<string, boolean>;
  overrides: Record<string, ProjectInterfaceAgentOverride>;
}

interface StoredPreferences {
  projects?: Record<string, unknown>;
}

const emptyPreferences = (): ProjectInterfaceAgentPreferences => ({
  enabled: {},
  overrides: {},
});

export function loadProjectInterfaceAgentPreferences(
  projectId: string,
): ProjectInterfaceAgentPreferences {
  if (!projectId) return emptyPreferences();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyPreferences();
    const stored = JSON.parse(raw) as StoredPreferences;
    return normalizePreferences(stored.projects?.[projectId]);
  } catch {
    return emptyPreferences();
  }
}

export function saveProjectInterfaceAgentPreferences(
  projectId: string,
  preferences: ProjectInterfaceAgentPreferences,
): void {
  if (!projectId) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const stored = raw ? (JSON.parse(raw) as StoredPreferences) : {};
    const projects = isRecord(stored.projects) ? stored.projects : {};
    projects[projectId] = normalizePreferences(preferences);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ projects }));
  } catch {
    // localStorage may be unavailable or contain invalid data.
  }
}

function normalizePreferences(value: unknown): ProjectInterfaceAgentPreferences {
  if (!isRecord(value)) return emptyPreferences();
  const enabled: Record<string, boolean> = {};
  if (isRecord(value.enabled)) {
    Object.entries(value.enabled).forEach(([agentId, agentEnabled]) => {
      if (typeof agentEnabled === "boolean") enabled[agentId] = agentEnabled;
    });
  }
  const overrides: Record<string, ProjectInterfaceAgentOverride> = {};
  if (isRecord(value.overrides)) {
    Object.entries(value.overrides).forEach(([agentId, rawOverride]) => {
      if (!isRecord(rawOverride) || typeof rawOverride.childExec !== "string") {
        return;
      }
      const childExec = rawOverride.childExec.trim();
      if (!childExec) return;
      const childArgs = Array.isArray(rawOverride.childArgs)
        ? rawOverride.childArgs.filter(
            (argument): argument is string => typeof argument === "string",
          )
        : undefined;
      overrides[agentId] = { childExec, childArgs };
    });
  }
  return { enabled, overrides };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
