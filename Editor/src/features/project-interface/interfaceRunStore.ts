import { create } from "zustand";
import { interfaceRunProtocol } from "@/services/server";
import { useWSStore } from "@/stores/connection/wsStore";
import { useMFWStore } from "@/stores/connection/mfwStore";
import { usePanelOccupancyStore } from "@/stores/ui/panelOccupancyStore";
import { useProjectInterfaceStore as pi } from "./projectInterfaceStore";
import { scopedValues } from "./projectPreferences";
import { taskUnavailableReason } from "./projectInterfaceState";
import { isInterfaceRunning, type InterfaceRunState } from "./interfaceRunTypes";
import type { ProjectInterfaceContextRequest } from "./types";

type Pending = { id: string; kind: "start" | "stop" | "prepare"; signature: string };
export const useInterfaceRunStore = create<{
  run?: InterfaceRunState;
  pending?: Pending;
  error?: string;
  preparation?: { id: string; signature: string };
}>(() => ({}));
let requestTimer: ReturnType<typeof setTimeout> | undefined;

export function environmentSignature() {
  const { snapshot, preferences } = pi.getState();
  return JSON.stringify([snapshot?.projectId, snapshot?.revision, preferences.controllerName, preferences.resourceName, scopedValues(preferences, "").pretask]);
}
function contextRequest(taskName: string, requestId: string): ProjectInterfaceContextRequest {
  const { snapshot, preferences } = pi.getState();
  if (!snapshot || !useWSStore.getState().connected) throw new Error("请先连接 LocalBridge 并加载项目");
  return { purpose: "interface", requestId, revision: snapshot.revision, language: snapshot.language, controllerName: preferences.controllerName, resourceName: preferences.resourceName, taskName, optionValues: scopedValues(preferences, taskName) };
}
function request(kind: Pending["kind"], send: (id: string) => boolean) {
  const state = useInterfaceRunStore.getState();
  if (state.pending && !(kind === "stop" && state.pending.kind === "prepare")) return;
  clearTimeout(requestTimer);
  const id = crypto.randomUUID();
  useInterfaceRunStore.setState({ pending: { id, kind, signature: environmentSignature() }, error: undefined });
  try {
    if (!send(id)) throw new Error("请求发送失败，请检查 LocalBridge 连接");
    requestTimer = setTimeout(() => {
      useInterfaceRunStore.setState({ pending: undefined, error: "等待运行服务响应超时，正在重新读取运行状态" });
      interfaceRunProtocol.status();
    }, kind === "prepare" ? 310000 : 30000);
  } catch (error) { useInterfaceRunStore.setState({ pending: undefined, error: error instanceof Error ? error.message : "操作失败" }); }
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
export const stopInterfaceRun = () => request("stop", id => interfaceRunProtocol.stop(useInterfaceRunStore.getState().run?.runId ?? "", id));
export function initializeInterfaceRun() {
  const finish = () => { clearTimeout(requestTimer); useInterfaceRunStore.setState({ pending: undefined }); };
  const unsubscribe = interfaceRunProtocol.subscribe(event => {
    const state = useInterfaceRunStore.getState();
    if (event.type === "state") {
      const previous = state.run;
      if (previous?.runId === event.data.runId && previous.sequence > event.data.sequence) return;
      if (previous?.runId !== event.data.runId && previous?.startedAt && event.data.startedAt && Date.parse(previous.startedAt) > Date.parse(event.data.startedAt)) return;
      useInterfaceRunStore.setState({ run: event.data });
      if ((state.pending?.kind === "start" && event.data.requestId === state.pending.id) || (state.pending?.kind === "stop" && !isInterfaceRunning(event.data.status))) finish();
    } else if (event.data.requestId === state.pending?.id) {
      finish();
      if (event.type === "error") useInterfaceRunStore.setState({ error: event.data.message });
      else if (state.pending?.signature === environmentSignature()) useInterfaceRunStore.setState({ preparation: { id: event.data.preparation.id, signature: state.pending.signature } });
      else useInterfaceRunStore.setState({ error: "准备期间配置已变化，请重新准备项目" });
    }
  });
  const disconnect = useWSStore.subscribe(s => s.connected, connected => {
    finish();
    if (connected) { useInterfaceRunStore.setState({ run: undefined, error: undefined }); interfaceRunProtocol.status(); }
    else useInterfaceRunStore.setState({ error: "LocalBridge 连接已断开；恢复连接后将同步运行状态" });
  });
  const statusTimer = setInterval(() => {
    if (useWSStore.getState().connected && (isInterfaceRunning(useInterfaceRunStore.getState().run?.status) || useInterfaceRunStore.getState().pending)) interfaceRunProtocol.status();
  }, 5000);
  if (useWSStore.getState().connected) interfaceRunProtocol.status();
  return () => { unsubscribe(); disconnect(); clearTimeout(requestTimer); clearInterval(statusTimer); };
}
