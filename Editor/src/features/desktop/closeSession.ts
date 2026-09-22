import { hasUnsavedPiSession } from "@/features/pi-editor/closeGuard";
import { modal, message } from "@/utils/ui/antdAppApi";
import { saveFlow, useFileStore } from "@/stores/project/fileStore";
import {
  flushFileCache,
  flushFileCacheSync,
  scheduleFileCache,
} from "@/stores/project/fileCache";
import { useDebugSessionStore } from "@/stores/debug/debugSessionStore";
import { desktopContext, desktopInvoke } from "./host";

function persistSession() {
  const state = useFileStore.getState();
  scheduleFileCache(state.files, state.currentFile.fileName);
  flushFileCacheSync();
  return flushFileCache();
}

export function initializeDesktopSession(): () => void {
  if (!desktopContext || !window.__TAURI__) return () => {};
  let disposed = false;
  let off: (() => void) | undefined;
  let active = false;
  const heartbeat = () =>
    void desktopInvoke("desktop_heartbeat").catch(() => {});
  const timer = setInterval(heartbeat, 10_000);
  const reply = async (accept: boolean) => {
    try {
      if (accept) {
        saveFlow();
        await persistSession();
      }
      await desktopInvoke("desktop_reply", { accept });
    } catch (error) {
      message.error(String(error));
      throw error;
    } finally {
      active = false;
    }
  };
  void window.__TAURI__.event
    .listen("desktop-close-request", () => {
      if (active) return;
      active = true;
      const running = ["running", "stopping"].includes(
        useDebugSessionStore.getState().session?.status ?? "",
      );
      const unsavedPi = hasUnsavedPiSession();
      if (!running && !unsavedPi) {
        void reply(true).catch(() => {
          active = false;
        });
        return;
      }
      modal.confirm({
        title: "结束编辑会话",
        content: unsavedPi ? "PI 文件有未保存草稿，退出会丢弃这些修改。请取消并返回编辑器保存，或明确放弃草稿。" + (running ? "当前任务也会停止。" : "") : "当前任务将随服务一起停止。",
        okText: unsavedPi ? "放弃 PI 草稿并退出" : "停止任务并退出",
        cancelText: "取消",
        closable: false,
        maskClosable: false,
        keyboard: false,
        onCancel: () => reply(false),
        onOk: () => reply(true),
      });
    })
    .then((unlisten) => {
      if (disposed) unlisten();
      else {
        off = unlisten;
        heartbeat();
      }
    });
  const external = (event: MouseEvent) => {
    const a =
      event.target instanceof Element
        ? event.target.closest<HTMLAnchorElement>("a[href]")
        : null;
    if (a && a.href.startsWith("https://") && !a.hasAttribute("download")) {
      event.preventDefault();
      void desktopInvoke("open_link", { url: a.href }).catch((error) =>
        message.error(String(error)),
      );
    }
  };
  document.addEventListener("click", external);
  return () => {
    disposed = true;
    clearInterval(timer);
    off?.();
    document.removeEventListener("click", external);
  };
}
