import { initializeInterfaceRun } from "./interfaceRunStore";
import { interfaceProtocol, localServer } from "@/services/server";
import { useWSStore } from "@/stores/connection/wsStore";
import { asObjectArray, compatibleResources, reconcileNamedSelection, taskUnavailableReason } from "./projectInterfaceState";
import { useProjectInterfaceStore as store, emptyContexts, type ContextChannel } from "./projectInterfaceStore";
import { emptyPreferences, loadProjectPreferences, reconcilePreferences, saveProjectPreferences, scopedValues } from "./projectPreferences";
import { loadProjectInterfaceAgentPreferences, saveProjectInterfaceAgentPreferences } from "./projectInterfaceDebugPreferences";
import type { ProjectInterfaceStatus } from "./types";


export function initializeProjectInterface(): () => void {
  let snapshotRequestId = "";
  let stopped = false;
  let loadedProjectId = "";
  const retiredContextIds = new Set<string>();
  const disposeRetired = () => { retiredContextIds.forEach(id => interfaceProtocol.disposeContext(id)); retiredContextIds.clear(); };
  const disposePlans = () => {
    for (const context of Object.values(store.getState().contexts)) {
      if (context.plan?.contextId) interfaceProtocol.disposeContext(context.plan.contextId);
    }
  };
  const refresh = (status: ProjectInterfaceStatus) => {
    disposePlans();
    disposeRetired();
    snapshotRequestId = crypto.randomUUID();
    store.setState(s => ({ status, contexts: emptyContexts(), snapshot: undefined, generation: s.generation + 1 }));
    if (status.state === "ready") interfaceProtocol.requestSnapshot("zh_cn", snapshotRequestId);
  };
  const resolve = () => {
    const state = store.getState();
    if (stopped || !useWSStore.getState().connected || !state.snapshot || state.status?.state !== "ready") return;
    const { snapshot } = state;
    const preferences = { ...state.preferences };
    preferences.controllerName = reconcileNamedSelection(asObjectArray(snapshot.document.controller), preferences.controllerName);
    preferences.resourceName = reconcileNamedSelection(compatibleResources(asObjectArray(snapshot.document.resource), preferences.controllerName), preferences.resourceName);
    if (preferences.controllerName !== state.preferences.controllerName || preferences.resourceName !== state.preferences.resourceName) store.setState({ preferences });
    // The backend adopts reusable Agents when resolving a replacement. Release
    // previous contexts only after that response, so typing does not restart them.
    Object.values(state.contexts).forEach(context => { if (context.plan?.contextId) retiredContextIds.add(context.plan.contextId); });
    const contexts = emptyContexts();
    for (const channel of ["home", "debug"] as const) contexts[channel] = { requestId: crypto.randomUUID(), pending: true, plan: state.contexts[channel].plan ? { ...state.contexts[channel].plan!, contextId: "" } : undefined };
    store.setState({ contexts });
    saveProjectPreferences(state.address, snapshot, preferences);
    saveProjectInterfaceAgentPreferences(JSON.stringify([state.address, snapshot.projectId]), { enabled: state.agentEnabled, overrides: state.agentOverrides });
    for (const channel of ["home", "debug"] as const) {
      const taskName = channel === "home" ? preferences.taskName : state.debugTaskName;
      const sent = interfaceProtocol.resolveContext({
        purpose: channel === "home" ? "interface" : "debug", requestId: contexts[channel].requestId!, revision: snapshot.revision, language: snapshot.language || "zh_cn",
        controllerName: preferences.controllerName, resourceName: preferences.resourceName, taskName,
        optionValues: scopedValues(preferences, taskName),
        agentEnabled: channel === "debug" ? state.agentEnabled : undefined, agentOverrides: channel === "debug" ? state.agentOverrides : undefined,
      });
      if (!sent) store.setState(s => ({ contexts: { ...s.contexts, [channel]: { pending: false, error: "无法发送 PI 配置解析请求" } } }));
    }
  };
  const disposers = [
    initializeInterfaceRun(),
    interfaceProtocol.onStatus(refresh),
    interfaceProtocol.onChanged(({ status }) => refresh(status)),
    interfaceProtocol.onSnapshot(({ requestId, snapshot }) => {
      if (requestId !== snapshotRequestId || snapshot.revision !== store.getState().status?.revision) return;
      const state = store.getState();
      const address = localServer.getAddress();
      const sameProject = state.address === address && loadedProjectId === snapshot.projectId;
      let preferences = sameProject
        ? reconcilePreferences(state.preferences, snapshot) : loadProjectPreferences(address, snapshot);
      const referencesChanged = sameProject && JSON.stringify(preferences.values) !== JSON.stringify(state.preferences.values);
      const previousController = preferences.controllerName;
      const previousResource = preferences.resourceName;
      preferences.controllerName = reconcileNamedSelection(asObjectArray(snapshot.document.controller), preferences.controllerName);
      preferences.resourceName = reconcileNamedSelection(compatibleResources(asObjectArray(snapshot.document.resource), preferences.controllerName), preferences.resourceName);
      const tasks = snapshot.document.task ?? [];
      const selectionLost = Boolean(preferences.taskName && !tasks.some(task => task.name === preferences.taskName));
      if (!tasks.some(task => task.name === preferences.taskName)) preferences = { ...preferences, taskName: tasks.find(task => !taskUnavailableReason(task, preferences.controllerName, preferences.resourceName))?.name ?? tasks[0]?.name ?? "" };
      loadedProjectId = snapshot.projectId;
      const agents = loadProjectInterfaceAgentPreferences(JSON.stringify([address, snapshot.projectId]));
      store.setState({
        address, snapshot, preferences, agentEnabled: agents.enabled, agentOverrides: agents.overrides,
        debugTaskName: sameProject && tasks.some(task => task.name === state.debugTaskName) ? state.debugTaskName : "",
        notice: selectionLost ? "之前选择的任务已不存在，已更新任务选择。" : referencesChanged || (previousController && previousController !== preferences.controllerName) || (previousResource && previousResource !== preferences.resourceName) ? "PI 配置已更新，已移除失效的选择或选项引用。" : undefined,
        generation: state.generation + 1,
      });
    }),
    interfaceProtocol.onContext(plan => {
      const state = store.getState();
      const channel = (["home", "debug"] as ContextChannel[]).find(key => state.contexts[key].requestId === plan.requestId);
      if (!channel || plan.revision !== state.snapshot?.revision) {
        if (plan.contextId) interfaceProtocol.disposeContext(plan.contextId);
        return;
      }
      disposeRetired();
      store.setState({ contexts: { ...state.contexts, [channel]: { requestId: plan.requestId, plan, pending: false, error: plan.diagnostics?.find(item => item.severity === "error")?.message } } });
    }),
    interfaceProtocol.onError(error => {
      const state = store.getState();
      if (error.requestId === snapshotRequestId) store.setState({ notice: error.message });
      const channel = (["home", "debug"] as ContextChannel[]).find(key => state.contexts[key].requestId === error.requestId);
      if (channel) { disposeRetired(); store.setState({ contexts: { ...state.contexts, [channel]: { requestId: error.requestId, pending: false, error: error.message } } }); }
    }),
    interfaceProtocol.onContextDisposed(({ contextId }) => {
      const state = store.getState();
      const contexts = { ...state.contexts };
      for (const channel of ["home", "debug"] as const) {
        if (contexts[channel].plan?.contextId === contextId) contexts[channel] = { ...contexts[channel], plan: undefined };
      }
      store.setState({ contexts });
    }),
    interfaceProtocol.onAgent(agent => store.setState(s => ({ agentStatuses: { ...s.agentStatuses, [agent.agentId]: agent } }))),
    store.subscribe(s => s.generation, resolve),
    useWSStore.subscribe(s => s.connected, connected => {
      snapshotRequestId = "";
      loadedProjectId = "";
      disposePlans();
      disposeRetired();
      store.setState({ status: undefined, snapshot: undefined, contexts: emptyContexts(), preferences: emptyPreferences(), debugTaskName: "", agentStatuses: {}, address: localServer.getAddress(), generation: store.getState().generation + 1 });
      if (connected) interfaceProtocol.requestStatus();
    }),
  ];
  if (useWSStore.getState().connected) interfaceProtocol.requestStatus();
  return () => { stopped = true; disposers.forEach(dispose => dispose()); disposePlans(); disposeRetired(); store.setState({ contexts: emptyContexts() }); };
}
