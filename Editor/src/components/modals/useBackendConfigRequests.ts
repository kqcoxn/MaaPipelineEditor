import { useCallback, useEffect, useRef, useState } from "react";
import { localServer } from "@/services/server";
import { useWSStore } from "@/stores/connection/wsStore";
import { message } from "@/utils/ui/antdAppApi";

type RequestKind = "loading" | "saving" | "reloading";
const labels: Record<RequestKind, string> = { loading: "读取配置", saving: "保存配置", reloading: "重载配置" };
const idle = { loading: false, saving: false, reloading: false };

/** Keep failed sends, disconnects and missing responses from blocking the form. */
export function useBackendConfigRequests(open: boolean) {
  const [busy, setBusy] = useState(idle);
  const timers = useRef<Partial<Record<RequestKind, ReturnType<typeof setTimeout>>>>({});
  const connected = useWSStore(state => state.connected);
  const clearTimers = useCallback(() => {
    Object.values(timers.current).forEach(clearTimeout);
    timers.current = {};
  }, []);
  const finishRequest = useCallback((kind: RequestKind) => {
    clearTimeout(timers.current[kind]);
    delete timers.current[kind];
    setBusy(state => ({ ...state, [kind]: false }));
  }, []);
  const startRequest = useCallback((kind: RequestKind, send: () => boolean) => {
    if (!localServer.isConnected()) {
      finishRequest(kind);
      message.warning("请先连接本地服务");
      return;
    }
    clearTimeout(timers.current[kind]);
    setBusy(state => ({ ...state, [kind]: true }));
    timers.current[kind] = setTimeout(() => {
      finishRequest(kind);
      message.error(`${labels[kind]}超时，请检查 LocalBridge 连接后重试。`);
    }, 10000);
    if (!send()) {
      finishRequest(kind);
      message.error(`发送${labels[kind]}请求失败`);
    }
  }, [finishRequest]);

  useEffect(() => {
    if (!open || !connected) {
      clearTimers();
      setBusy(idle);
    }
    return clearTimers;
  }, [open, connected, clearTimers]);

  return { ...busy, startRequest, finishRequest };
}
