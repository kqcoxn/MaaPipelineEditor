import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { OptionScope, ProjectInterfaceAgentStatus, ProjectInterfaceAgentOverride, ProjectInterfaceRuntimePlan, ProjectInterfaceSnapshot, ProjectInterfaceStatus } from "./types";
import { emptyPreferences, scopeKey, type ProjectPreferences } from "./projectPreferences";

export type ContextChannel = "home" | "debug";
export interface PIContextState { requestId?: string; plan?: ProjectInterfaceRuntimePlan; error?: string; pending: boolean }
interface ProjectInterfaceState {
  address: string;
  status?: ProjectInterfaceStatus;
  snapshot?: ProjectInterfaceSnapshot;
  preferences: ProjectPreferences;
  debugTaskName: string;
  mode: "project_interface" | "manual";
  generation: number;
  notice?: string;
  contexts: Record<ContextChannel, PIContextState>;
  agentStatuses: Record<string, ProjectInterfaceAgentStatus>;
  agentEnabled: Record<string, boolean>;
  agentOverrides: Record<string, ProjectInterfaceAgentOverride>;
}
interface ProjectInterfaceActions {
  setTaskQueue: (order: string[], checked: string[]) => void;
  setControllerName: (name: string) => void;
  setResourceName: (name: string) => void;
  selectTask: (name: string) => void;
  selectDebugTask: (name: string) => void;
  setMode: (mode: ProjectInterfaceState["mode"]) => void;
  setOptionValue: (scope: OptionScope, name: string, value: unknown, channel: ContextChannel) => void;
  resetTask: () => void;
  setAgentEnabled: (id: string, enabled: boolean) => void;
  setAgentOverride: (id: string, override?: ProjectInterfaceAgentOverride) => void;
}
export const emptyContexts = (): ProjectInterfaceState["contexts"] => ({ home: { pending: false }, debug: { pending: false } });
export const useProjectInterfaceStore = create<ProjectInterfaceState & ProjectInterfaceActions>()(subscribeWithSelector((set) => ({
  address: "", preferences: emptyPreferences(), debugTaskName: "", mode: "project_interface", generation: 0,
  contexts: emptyContexts(), agentStatuses: {}, agentEnabled: {}, agentOverrides: {},
  setTaskQueue: (taskOrder, checkedTaskNames) => set(s => ({ preferences: { ...s.preferences, taskOrder, checkedTaskNames }, generation: s.generation + 1 })),
  setControllerName: (controllerName) => set(s => ({ preferences: { ...s.preferences, controllerName }, generation: s.generation + 1 })),
  setResourceName: (resourceName) => set(s => ({ preferences: { ...s.preferences, resourceName }, generation: s.generation + 1 })),
  selectTask: (taskName) => set(s => ({ preferences: { ...s.preferences, taskName }, generation: s.generation + 1 })),
  selectDebugTask: (debugTaskName) => set(s => ({ debugTaskName, generation: s.generation + 1 })),
  setMode: (mode) => set({ mode }),
  setOptionValue: (scope, name, value, channel) => set(s => {
    const key = scopeKey(scope, s.preferences, channel === "home" ? s.preferences.taskName : s.debugTaskName);
    return { preferences: { ...s.preferences, values: { ...s.preferences.values, [key]: { ...s.preferences.values[key], [name]: value } } }, generation: s.generation + 1 };
  }),
  resetTask: () => set(s => {
    const values = { ...s.preferences.values };
    delete values[scopeKey("task", s.preferences, s.preferences.taskName)];
    return { preferences: { ...s.preferences, values }, generation: s.generation + 1 };
  }),
  setAgentEnabled: (id, enabled) => set(s => ({ agentEnabled: { ...s.agentEnabled, [id]: enabled }, generation: s.generation + 1 })),
  setAgentOverride: (id, override) => set(s => {
    const agentOverrides = { ...s.agentOverrides };
    if (override?.childExec.trim()) agentOverrides[id] = override; else delete agentOverrides[id];
    return { agentOverrides, generation: s.generation + 1 };
  }),
})));
