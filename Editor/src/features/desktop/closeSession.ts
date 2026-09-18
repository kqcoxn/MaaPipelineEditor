import { createElement } from "react";
import { Button, Space } from "antd";
import { modal, message } from "@/utils/ui/antdAppApi";
import { saveFlow, useFileStore } from "@/stores/project/fileStore";
import { hasUnsavedContent } from "@/stores/project/fileDirtyState";
import {
  discardDesktopFilesOnClose,
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
  let saving = false;
  const heartbeat = () =>
    void desktopInvoke("desktop_heartbeat").catch(() => {});
  const timer = setInterval(heartbeat, 10_000);
  const reply = async (accept: boolean) => {
    try {
      await desktopInvoke("desktop_reply", { accept });
      active = false;
    } catch (error) {
      discardDesktopFilesOnClose([]);
      await persistSession();
      message.error(String(error));
      throw error;
    }
  };
  void window.__TAURI__.event
    .listen("desktop-close-request", () => {
      if (active) return;
      active = true;
      saveFlow();
      const dirty = useFileStore.getState().files.filter(hasUnsavedContent);
      const running = ["running", "stopping"].includes(
        useDebugSessionStore.getState().session?.status ?? "",
      );
      if (!dirty.length && !running) {
        void reply(true).catch(() => {
          active = false;
        });
        return;
      }
      const dialog = modal.confirm({
        title: "结束编辑会话",
        content: `${dirty.length ? `有 ${dirty.length} 个文件尚未保存。` : ""}${running ? "当前任务将随服务一起停止。" : ""}`,
        okText: dirty.length ? "保存后退出" : "停止任务并退出",
        cancelText: "取消",
        closable: false,
        maskClosable: false,
        keyboard: false,
        onCancel: () => {
          if (saving) return Promise.reject(new Error("请等待保存完成"));
          return reply(false);
        },
        onOk: async () => {
          if (saving) return;
          saving = true;
          dialog.update({ cancelButtonProps: { disabled: true } });
          try {
            saveFlow();
            for (const file of useFileStore
              .getState()
              .files.filter(hasUnsavedContent)) {
              const path =
                file.config.filePath ||
                (await desktopInvoke<string | null>("desktop_save_path", {
                  name: `${file.fileName}.json`,
                }));
              if (!path) throw new Error("已取消保存，编辑会话仍保留");
              if (!(await useFileStore.getState().saveFileToLocal(path, file)))
                throw new Error(`保存 ${file.fileName} 失败，编辑会话仍保留`);
            }
            await persistSession();
            await reply(true);
          } catch (error) {
            message.error(String(error));
            throw error;
          } finally {
            saving = false;
            dialog.update({ cancelButtonProps: { disabled: false } });
          }
        },
        footer: (_, { OkBtn, CancelBtn }) =>
          createElement(
            Space,
            {},
            createElement(CancelBtn),
            ...(dirty.length
              ? [
                  createElement(
                    Button,
                    {
                      key: "discard",
                      danger: true,
                      disabled: saving,
                      onClick: async () => {
                        if (saving) return;
                        saving = true;
                        dialog.update({
                          okButtonProps: { loading: true },
                          cancelButtonProps: { disabled: true },
                        });
                        try {
                          saveFlow();
                          discardDesktopFilesOnClose(
                            useFileStore
                              .getState()
                              .files.filter(hasUnsavedContent)
                              .map((file) => file.fileName),
                          );
                          await persistSession();
                          await reply(true);
                          dialog.destroy();
                        } catch {
                          /* The host error is already displayed and the cache is restored. */
                        } finally {
                          saving = false;
                          dialog.update({
                            okButtonProps: { loading: false },
                            cancelButtonProps: { disabled: false },
                          });
                        }
                      },
                    },
                    "放弃修改并退出",
                  ),
                ]
              : []),
            createElement(OkBtn),
          ),
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
