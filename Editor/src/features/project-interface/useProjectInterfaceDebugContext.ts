import { useMemo } from "react";
import { useShallow } from "zustand/shallow";
import { useProjectInterfaceStore } from "./projectInterfaceStore";
import { asObjectArray, compatibleResources, effectiveConfigurationSource } from "./projectInterfaceState";
import type { OptionScope } from "./types";

export type DebugConfigurationSource = "project_interface" | "manual";

export function useProjectInterfaceDebugContext(_connected: boolean) {
  const state = useProjectInterfaceStore(useShallow(s => ({
    modePreference: s.mode, status: s.status, snapshot: s.snapshot, contextState: s.contexts.debug,
    preferences: s.preferences, taskName: s.debugTaskName, selectTask: s.selectDebugTask,
    setMode: s.setMode, setControllerName: s.setControllerName, setResourceName: s.setResourceName,
    setOption: s.setOptionValue, agentStatuses: s.agentStatuses, agentEnabled: s.agentEnabled,
    agentOverrides: s.agentOverrides, setAgentEnabled: s.setAgentEnabled, setAgentOverride: s.setAgentOverride,
  })));
  const controllers = useMemo(() => asObjectArray(state.snapshot?.document.controller), [state.snapshot]);
  const resources = useMemo(() => compatibleResources(asObjectArray(state.snapshot?.document.resource), state.preferences.controllerName), [state.snapshot, state.preferences.controllerName]);
  const mode = effectiveConfigurationSource(state.modePreference, state.status?.state);
  const context = state.contextState.plan;
  return {
    ...state, mode, context, controllers, resources,
    controllerName: state.preferences.controllerName, resourceName: state.preferences.resourceName,
    optionValues: context?.optionValues,
    setOptionValue: (scope: OptionScope, name: string, value: unknown) => state.setOption(scope, name, value, "debug"),
    error: state.contextState.error,
    active: mode === "project_interface" && Boolean(context?.contextId),
  };
}
