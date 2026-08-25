import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { interfaceProtocol } from "@/services/server";
import type {
  ProjectInterfaceAgentStatus,
  ProjectInterfaceAgentOverride,
  ProjectInterfaceRuntimePlan,
  ProjectInterfaceSnapshot,
  ProjectInterfaceStatus,
} from "./types";
import {
  asObjectArray,
  compatibleResources,
  effectiveConfigurationSource,
  reconcileNamedSelection,
  sameJSON,
  stringValue,
} from "./projectInterfaceState";
import {
  loadProjectInterfaceAgentPreferences,
  saveProjectInterfaceAgentPreferences,
  type ProjectInterfaceAgentPreferences,
} from "./projectInterfaceDebugPreferences";

export type DebugConfigurationSource = "project_interface" | "manual";

const MODE_STORAGE_KEY = "mpe_debug_configuration_source_v1";

function initialMode(): DebugConfigurationSource {
  try {
    return localStorage.getItem(MODE_STORAGE_KEY) === "manual"
      ? "manual"
      : "project_interface";
  } catch {
    return "project_interface";
  }
}

export function useProjectInterfaceDebugContext(connected: boolean) {
  const [modePreference, setModePreference] = useState<DebugConfigurationSource>(initialMode);
  const [status, setStatus] = useState<ProjectInterfaceStatus>();
  const [snapshot, setSnapshot] = useState<ProjectInterfaceSnapshot>();
  const [context, setContext] = useState<ProjectInterfaceRuntimePlan>();
  const [controllerName, setControllerName] = useState("");
  const [resourceName, setResourceName] = useState("");
  const [optionValues, setOptionValues] = useState<Record<string, unknown>>({});
  const [agentStatuses, setAgentStatuses] = useState<Record<string, ProjectInterfaceAgentStatus>>({});
  const [agentPreferences, setAgentPreferences] = useState<ProjectInterfaceAgentPreferences>({ enabled: {}, overrides: {} });
  const [error, setError] = useState<string>();

  const mode = effectiveConfigurationSource(modePreference, status?.state);

  const controllerRef = useRef(controllerName);
  const resourceRef = useRef(resourceName);
  const contextRef = useRef<ProjectInterfaceRuntimePlan>();
  const projectIdRef = useRef("");
  controllerRef.current = controllerName;
  resourceRef.current = resourceName;
  contextRef.current = context;
  projectIdRef.current = snapshot?.projectId ?? "";

  const disposeCurrentContext = useCallback(() => {
    const current = contextRef.current;
    if (current) {
      contextRef.current = undefined;
      void interfaceProtocol.disposeContext(current.contextId);
      setContext(undefined);
    }
  }, []);

  const controllers = useMemo(
    () => asObjectArray(snapshot?.document.controller),
    [snapshot],
  );
  const resources = useMemo(
    () => compatibleResources(asObjectArray(snapshot?.document.resource), controllerName),
    [controllerName, snapshot],
  );

  useEffect(() => {
    const disposers = [
      interfaceProtocol.onStatus((next) => {
        setStatus(next);
        setError(next.diagnostics?.find((item) => item.severity === "error")?.message);
        if (next.state === "ready") interfaceProtocol.requestSnapshot("zh_cn");
        else { setSnapshot(undefined); disposeCurrentContext(); }
      }),
      interfaceProtocol.onChanged(({ status: next }) => {
        setStatus(next);
        disposeCurrentContext();
        if (next.state === "ready") interfaceProtocol.requestSnapshot("zh_cn");
        else setSnapshot(undefined);
      }),
      interfaceProtocol.onSnapshot((next) => {
        setSnapshot(next);
        setAgentPreferences(loadProjectInterfaceAgentPreferences(next.projectId));
        const nextControllers = asObjectArray(next.document.controller);
        const firstController = stringValue(nextControllers[0]?.name);
        setControllerName((current) => reconcileNamedSelection(nextControllers, current) || firstController);
        setOptionValues({});
        setError(undefined);
      }),
      interfaceProtocol.onContext((next) => {
        if (next.controllerName !== controllerRef.current || next.resourceName !== resourceRef.current) return;
        setContext((previous) => {
          if (previous && previous.contextId !== next.contextId) interfaceProtocol.disposeContext(previous.contextId);
          return next;
        });
        setOptionValues((current) => sameJSON(current, next.optionValues ?? {}) ? current : (next.optionValues ?? {}));
        setError(undefined);
      }),
      interfaceProtocol.onContextDisposed(({ contextId }) => {
        setContext((current) => current?.contextId === contextId ? undefined : current);
      }),
      interfaceProtocol.onAgent((next) => {
        if (next.contextId !== contextRef.current?.contextId) return;
        setAgentStatuses((current) => ({ ...current, [next.agentId]: next }));
      }),
      interfaceProtocol.onError((next) => setError(next.message)),
    ];
    return () => {
      disposers.forEach((dispose) => dispose());
      disposeCurrentContext();
    };
  }, [disposeCurrentContext]);

  useEffect(() => {
    if (connected) interfaceProtocol.requestStatus();
    else { setStatus(undefined); setSnapshot(undefined); disposeCurrentContext(); }
  }, [connected, disposeCurrentContext]);

  useEffect(() => {
    if (!resources.length) { setResourceName(""); return; }
    const next = reconcileNamedSelection(resources, resourceName);
    if (next !== resourceName) setResourceName(next);
  }, [resourceName, resources]);

  useEffect(() => {
    if (mode !== "project_interface" || status?.state !== "ready" || !snapshot || !controllerName || !resourceName) return;
    interfaceProtocol.resolveContext({ revision: snapshot.revision, language: snapshot.language || "zh_cn", controllerName, resourceName, optionValues, agentEnabled: agentPreferences.enabled, agentOverrides: agentPreferences.overrides });
  }, [agentPreferences, controllerName, mode, optionValues, resourceName, snapshot, status?.state]);

  useEffect(() => setAgentStatuses({}), [controllerName, resourceName, snapshot?.revision]);

  const setMode = useCallback((next: DebugConfigurationSource) => {
    if (next !== "project_interface") disposeCurrentContext();
    setModePreference(next);
    try { localStorage.setItem(MODE_STORAGE_KEY, next); } catch { /* localStorage may be unavailable */ }
  }, [disposeCurrentContext]);
  const setOptionValue = useCallback((name: string, value: unknown) => setOptionValues((current) => ({ ...current, [name]: value })), []);
  const setAgentEnabled = useCallback((agentId: string, enabled: boolean) => {
    setAgentPreferences((current) => {
      const next = { ...current, enabled: { ...current.enabled, [agentId]: enabled } };
      saveProjectInterfaceAgentPreferences(projectIdRef.current, next);
      return next;
    });
  }, []);
  const setAgentOverride = useCallback((agentId: string, override: ProjectInterfaceAgentOverride | undefined) => {
    setAgentPreferences((current) => {
      const overrides = { ...current.overrides };
      if (!override || !override.childExec.trim()) delete overrides[agentId];
      else overrides[agentId] = { childExec: override.childExec.trim(), childArgs: override.childArgs };
      const next = { ...current, overrides };
      saveProjectInterfaceAgentPreferences(projectIdRef.current, next);
      return next;
    });
  }, []);

  return {
    mode,
    setMode,
    status,
    snapshot,
    context,
    controllers,
    resources,
    controllerName,
    setControllerName,
    resourceName,
    setResourceName,
    optionValues,
    setOptionValue,
    agentStatuses,
    agentEnabled: agentPreferences.enabled,
    setAgentEnabled,
    agentOverrides: agentPreferences.overrides,
    setAgentOverride,
    error,
    active: mode === "project_interface" && status?.state === "ready" && Boolean(context),
  };
}
