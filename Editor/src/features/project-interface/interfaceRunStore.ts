import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { interfaceRunProtocol } from "@/services/server";
import { useWSStore } from "@/stores/connection/wsStore";
import { useMFWStore } from "@/stores/connection/mfwStore";
import { usePanelOccupancyStore } from "@/stores/ui/panelOccupancyStore";
import { useProjectInterfaceStore as pi } from "./projectInterfaceStore";
import { scopedValues } from "./projectPreferences";
import { taskUnavailableReason } from "./projectInterfaceState";
import { isInterfaceRunning, type InterfaceRunState } from "./interfaceRunTypes";
import type { ProjectInterfaceContextRequest } from "./types";

type Pending = { id: string; kind: "start" | "stop" | "prepare"; signature: string; runId?: string };
export const useInterfaceRunStore = create<{
  run?: InterfaceRunState;
  pending?: Pending;
  recovery?: Pending;
  stopRequested?: boolean;
  error?: string;
  preparation?: { id: string; signature: string };
}>()(subscribeWithSelector(() => ({})));
let requestTimer: ReturnType<typeof setTimeout> | undefined;
const responseTimeout = "等待运行服务响应超时，正在重新读取运行状态";

export function environmentSignature() {
  const { snapshot, preferences } = pi.getState();
  return JSON.stringify([snapshot?.projectId, snapshot?.revision, preferences.controllerName, preferences.resourceName, scopedValues(preferences, "").pretask]);
}
function contextRequest(taskName: string, requestId: string): ProjectInterfaceContextRequest {
  const { snapshot, preferences } = pi.getState();
  if (!snapshot || !useWSStore.getState().connected) throw new Error("请先连接 LocalBridge 并加载项目");
  return { purpose: "interface", requestId, revision: snapshot.revision, language: snapshot.language, controllerName: preferences.controllerName, resourceName: preferences.resourceName, taskName, optionValues: scopedValues(preferences, taskName) };
}
function request(kind: Pending["kind"], send: (id: string) => boolean, runId?: string) {
  const state = useInterfaceRunStore.getState();
  if (state.pending && !(kind === "stop" && state.pending.kind !== "stop")) return;
  clearTimeout(requestTimer);
  const id = crypto.randomUUID();
  useInterfaceRunStore.setState({ pending: { id, kind, signature: environmentSignature(), runId }, recovery: undefined, stopRequested: false, error: undefined });
  // Arm before sending: a response may settle the request during send().
  requestTimer = setTimeout(() => {
    const pending = useInterfaceRunStore.getState().pending;
    if (pending?.id !== id) return;
    useInterfaceRunStore.setState({ pending: undefined, recovery: pending, error: responseTimeout });
    interfaceRunProtocol.status();
  }, kind === "prepare" ? 310000 : 30000);
  try {
    if (!send(id)) throw new Error("请求发送失败，请检查 LocalBridge 连接");
  } catch (error) {
    if (useInterfaceRunStore.getState().pending?.id !== id) return;
    clearTimeout(requestTimer);
    useInterfaceRunStore.setState({ pending: undefined, stopRequested: false, error: error instanceof Error ? error.message : "操作失败" });
  }
}
export function startInterfaceRun() {
  if (isInterfaceRunning(useInterfaceRunStore.getState().run?.status)) return;
  request("start", id => {
    const { snapshot, preferences } = pi.getState();
    const device = useMFWStore.getState();
    if (device.connectionStatus !== "connected" || !device.controllerId) {
      usePanelOccupancyStore.getState().activate("connection");
      throw new Error("请先连接设备，再开始运行");
    }
    const names = (preferences.taskOrder ?? []).filter(name => preferences.checkedTaskNames?.includes(name));
    if (!names.length) throw new Error("请先勾选要运行的任务");
    for (const name of names) {
      const task = snapshot?.document.task?.find(task => task.name === name);
      if (!task) throw new Error("任务列表已变化，请重新选择");
      const reason = taskUnavailableReason(task, preferences.controllerName, preferences.resourceName);
      if (reason) throw new Error(`${task.label ?? name}：${reason}`);
    }
    const preparation = useInterfaceRunStore.getState().preparation;
    return interfaceRunProtocol.start({ requestId: id, projectId: snapshot!.projectId, controllerId: device.controllerId,
      preparationId: preparation?.signature === environmentSignature() ? preparation.id : undefined,
      tasks: names.map(name => contextRequest(name, id)) });
  });
}
export const prepareInterfaceProject = () => request("prepare", id => interfaceRunProtocol.prepare(contextRequest("", id)));
export function stopInterfaceRun() {
  const { run, pending, stopRequested } = useInterfaceRunStore.getState();
  if (stopRequested || pending?.kind === "stop" || run?.status === "stopping") return;
  if (pending && run?.requestId !== pending.id) {
    useInterfaceRunStore.setState({ stopRequested: true });
    return;
  }
  if (run?.runId && isInterfaceRunning(run.status)) request("stop", id => interfaceRunProtocol.stop(run.runId, id), run.runId);
}
export function initializeInterfaceRun() {
  const finish = () => { clearTimeout(requestTimer); useInterfaceRunStore.setState({ pending: undefined }); };
  const unsubscribe = interfaceRunProtocol.subscribe(event => {
    const state = useInterfaceRunStore.getState();
    if (event.type === "state") {
      const previous = state.run;
      if (previous?.runId === event.data.runId && previous.sequence > event.data.sequence) return;
      if (previous?.runId !== event.data.runId && previous?.startedAt && event.data.startedAt && Date.parse(previous.startedAt) > Date.parse(event.data.startedAt)) return;
      useInterfaceRunStore.setState({ run: event.data });
      const tracked = state.pending ?? state.recovery;
      const sameRequest = tracked?.id === event.data.requestId;
      const terminal = !isInterfaceRunning(event.data.status);
      const settled = (tracked?.kind === "start" && sameRequest)
        || (tracked?.kind === "stop" && tracked.runId === event.data.runId && (terminal || event.data.status === "stopping"))
        || (tracked?.kind === "prepare" && sameRequest && ["stopped", "failed"].includes(event.data.status));
      if (settled) {
        finish();
        useInterfaceRunStore.setState({ recovery: undefined, stopRequested: false, error: state.error === responseTimeout ? undefined : state.error });
      }
      if (state.stopRequested && sameRequest && !terminal) {
        useInterfaceRunStore.setState({ stopRequested: false });
        stopInterfaceRun();
      }
    } else if (event.data.requestId === (state.pending ?? state.recovery)?.id) {
      const tracked = state.pending ?? state.recovery;
      finish();
      useInterfaceRunStore.setState({ stopRequested: false, recovery: undefined });
      if (event.type === "error") useInterfaceRunStore.setState({ error: event.data.message });
      else if (tracked?.signature === environmentSignature()) useInterfaceRunStore.setState({ preparation: { id: event.data.preparation.id, signature: tracked.signature }, error: undefined });
      else useInterfaceRunStore.setState({ error: "准备期间配置已变化，请重新准备项目" });
    }
  });
  const disconnect = useWSStore.subscribe(s => s.connected, connected => {
    finish();
    useInterfaceRunStore.setState({ recovery: undefined, stopRequested: false });
    if (connected) { useInterfaceRunStore.setState({ run: undefined, error: undefined }); interfaceRunProtocol.status(); }
    else useInterfaceRunStore.setState({ error: "LocalBridge 连接已断开；恢复连接后将同步运行状态" });
  });
  const statusTimer = setInterval(() => {
    const state = useInterfaceRunStore.getState();
    if (useWSStore.getState().connected && (isInterfaceRunning(state.run?.status) || state.pending || state.recovery)) interfaceRunProtocol.status();
  }, 5000);
  if (useWSStore.getState().connected) interfaceRunProtocol.status();
  return () => { unsubscribe(); disconnect(); clearTimeout(requestTimer); clearInterval(statusTimer); };
}
