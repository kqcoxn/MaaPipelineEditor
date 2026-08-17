import { useEmbedStore } from "@/stores/embed/embedStore";
import {
  createEmbedRequestId,
  sendToParent,
  type EmbedNodeNavigationResultPayload,
  type EmbedSaveRequestPayload,
} from "../../../utils/embedBridge";

const OPERATION_TIMEOUT_MS = 10_000;
const operationTimers = new Map<string, ReturnType<typeof setTimeout>>();

export interface HostNodeNavigationResult {
  success: boolean;
  message: string;
}

interface PendingHostNodeNavigation {
  nodeName: string;
  timer: ReturnType<typeof setTimeout>;
  resolve: (result: HostNodeNavigationResult) => void;
}

const pendingHostNodeNavigations = new Map<
  string,
  PendingHostNodeNavigation
>();

function startTimeout(
  requestId: string,
  onTimeout: (requestId: string) => void,
): void {
  clearOperationTimeout(requestId);
  operationTimers.set(
    requestId,
    setTimeout(() => {
      operationTimers.delete(requestId);
      onTimeout(requestId);
    }, OPERATION_TIMEOUT_MS),
  );
}

export function clearOperationTimeout(requestId: string | undefined): void {
  if (!requestId) return;
  const timer = operationTimers.get(requestId);
  if (timer) clearTimeout(timer);
  operationTimers.delete(requestId);
}

export function clearEmbedOperationTimeouts(): void {
  operationTimers.forEach((timer) => clearTimeout(timer));
  operationTimers.clear();
  pendingHostNodeNavigations.forEach(({ timer, resolve }) => {
    clearTimeout(timer);
    resolve({
      success: false,
      message: "嵌入协议已销毁，节点导航已取消",
    });
  });
  pendingHostNodeNavigations.clear();
}

export function requestHostNodeNavigation(
  nodeName: string,
): Promise<HostNodeNavigationResult> {
  const store = useEmbedStore.getState();
  if (!store.isReady) {
    return Promise.resolve({
      success: false,
      message: "嵌入协议尚未就绪，无法请求宿主节点导航",
    });
  }
  if (!store.capabilities.hostNodeNavigation) {
    return Promise.resolve({
      success: false,
      message: "当前宿主未声明节点导航能力",
    });
  }

  const requestId = createEmbedRequestId("navigate-node");
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingHostNodeNavigations.delete(requestId);
      resolve({
        success: false,
        message: "等待宿主节点导航响应超时",
      });
    }, OPERATION_TIMEOUT_MS);

    pendingHostNodeNavigations.set(requestId, { nodeName, timer, resolve });
    sendToParent("mpe:navigateNodeRequest", { nodeName }, requestId);
  });
}

export function resolveHostNodeNavigationResult(
  payload: Partial<EmbedNodeNavigationResultPayload>,
  requestId: string | undefined,
): boolean {
  if (!requestId) return false;
  const pending = pendingHostNodeNavigations.get(requestId);
  if (!pending) return false;

  clearTimeout(pending.timer);
  pendingHostNodeNavigations.delete(requestId);
  const nodeName = payload.nodeName || pending.nodeName;
  const success = payload.success === true;
  pending.resolve({
    success,
    message:
      payload.message?.trim() ||
      (success ? `已定位到节点: ${nodeName}` : `未找到节点: ${nodeName}`),
  });
  return true;
}

export function requestHostSave(
  options: Partial<EmbedSaveRequestPayload> = {},
): string | null {
  const store = useEmbedStore.getState();
  if (
    !store.isReady ||
    store.saveOperation.status === "pending" ||
    store.reloadOperation.status === "pending"
  ) {
    return null;
  }

  const requestId = createEmbedRequestId("save");
  store.beginSave(requestId);
  sendToParent(
    "mpe:saveRequest",
    {
      hint: options.hint ?? "user-triggered",
      force: options.force === true,
    },
    requestId,
  );
  startTimeout(requestId, (timedOutRequestId) => {
    useEmbedStore
      .getState()
      .finishSave(
        timedOutRequestId,
        false,
        "",
        "等待宿主保存响应超时",
      );
  });
  return requestId;
}

export function requestHostReload(): string | null {
  const store = useEmbedStore.getState();
  if (
    !store.isReady ||
    store.reloadOperation.status === "pending" ||
    store.saveOperation.status === "pending"
  ) {
    return null;
  }

  const requestId = createEmbedRequestId("reload");
  store.beginReload(requestId);
  sendToParent("mpe:reloadRequest", {}, requestId);
  startTimeout(requestId, (timedOutRequestId) => {
    useEmbedStore
      .getState()
      .finishReload(timedOutRequestId, false, "等待宿主同步响应超时");
  });
  return requestId;
}
