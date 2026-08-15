import { useEmbedStore } from "@/stores/embed/embedStore";
import {
  createEmbedRequestId,
  sendToParent,
  type EmbedSaveRequestPayload,
} from "../../utils/embedBridge";

const OPERATION_TIMEOUT_MS = 10_000;
const operationTimers = new Map<string, ReturnType<typeof setTimeout>>();

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
