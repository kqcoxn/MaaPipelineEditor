import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Settings, Snapshot, Homepage, VersionList } from "./types";
import { bundledHomepage, preferCurrentHomepage } from "./lib/homepage";
import { runAutomaticUpdates, updateEnvironment } from "./lib/automaticUpdate";
import type { FeedbackScope, NoticeKind } from "./lib/feedback";
export { newer } from "./lib/automaticUpdate";
import {
  parseInstallProgress,
  type InstallProgress,
} from "./lib/installProgress";

export const openLink = (url: string) => invoke("open_link", { url });
export function useLauncher() {
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [busy, setBusy] = useState(false);
  const [error, saveError] = useState("");
  const [notice, saveNotice] = useState("");
  const setError = useCallback((message: string, _scope?: FeedbackScope) => saveError(message), []);
  const setNotice = useCallback((message: string, kind?: NoticeKind, _scope?: FeedbackScope) => {
    if (kind === "error") saveError(message);
    else saveNotice(message);
  }, []);
  const clearFeedback = useCallback((_scope?: FeedbackScope) => saveError(""), []);

  const [installationProgress, setInstallationProgress] =
    useState<InstallProgress>({ text: "" });
  const { text: progress, download: downloadProgress } = installationProgress;
  const [content, setContent] = useState<Homepage>(bundledHomepage);
  const [versions, setVersions] = useState<string[]>([]);
  const [versionInfo, setVersionInfo] = useState<VersionList>();
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [updateStatus, setUpdateStatus] = useState("");
  const [desktopUpdateStatus, setDesktopUpdateStatus] = useState("");
  const gate = useRef(false);
  const refresh = useCallback(async () => {
    const next = await invoke<Snapshot>("snapshot");
    setSnapshot(next);
    return next;
  }, []);
  const run = useCallback(
    async (
      action: () => Promise<unknown>,
      scope: FeedbackScope = "operation",
    ) => {
      if (gate.current) return false;
      gate.current = true;
      setBusy(true);
      try {
        await action();
        await refresh();
        return true;
      } catch (e) {
        setError(String(e), scope);
        await refresh().catch(() => {});
        return false;
      } finally {
        setBusy(false);
        gate.current = false;
        setInstallationProgress({ text: "" });
      }
    },
    [refresh],
  );
  const loadEnvironmentVersions = useCallback(
    async (s: Snapshot, allowInstall: boolean) => {
      setVersionsLoading(true);
      try {
        return await updateEnvironment(
          s,
          (result) => {
            setVersions(result.versions);
            setVersionInfo(result);
            setVersionsLoading(false);
          },
          setUpdateStatus,
          (message, kind) => setNotice(message, kind, "environment"),
          allowInstall,
        );
      } finally {
        setVersionsLoading(false);
      }
    },
    [],
  );
  const checkDesktopUpdate = useCallback(async () => {
    setDesktopUpdateStatus("正在检查桌面端更新");
    try {
      setDesktopUpdateStatus(await invoke<string>("update_desktop"));
      clearFeedback("desktop");
    } catch (error) {
      setDesktopUpdateStatus(`桌面端更新检查失败：${String(error)}`);
      setError(`桌面端更新检查失败：${String(error)}`, "desktop");
    }
  }, []);
  const automatic = useCallback(
    async (s: Snapshot, target: "all" | "mpe" | "desktop" = "all") => {
      await run(
        () =>
          runAutomaticUpdates(
            s,
            async () => setUpdateStatus(await loadEnvironmentVersions(s, true)),
            checkDesktopUpdate,
            target,
          ),
        "environment",
      );
    },
    [run, loadEnvironmentVersions, checkDesktopUpdate],
  );
  useEffect(() => {
    let disposed = false;
    const disposers: Array<() => void> = [];
    const subscriptions: Promise<unknown>[] = [];
    const subscribe = <T>(name: string, cb: (value: T) => void) => {
      subscriptions.push(
        listen<T>(name, (e) => cb(e.payload)).then((off) =>
          disposed ? off() : disposers.push(off),
        ),
      );
    };
    void invoke<Homepage>("homepage")
      .then((value) => setContent(preferCurrentHomepage(value)))
      .catch(() => {});
    subscribe<string>("engine-progress", (value) => {
      setInstallationProgress(parseInstallProgress(value));
    });
    subscribe<boolean>("session-changed", (running) => {
      void refresh().then((s) => {
        if (!running) void automatic(s);
      });
    });
    subscribe<string>("session-error", (value) => {
      setError(value);
      void refresh();
    });
    // Subscribe before installation can start, so early progress is not lost.
    void Promise.all(subscriptions)
      .then(() => (disposed ? undefined : refresh()))
      .then((s) => {
        if (s && !disposed) return automatic(s);
      })
      .catch((e) => setError(String(e)));
    return () => {
      disposed = true;
      disposers.forEach((off) => off());
    };
  }, [refresh, automatic]);
  const save = async (patch: Partial<Settings>) => {
    if (!snapshot) return;
    const settings = { ...snapshot.settings, ...patch };
    const saved = await run(async () => {
      await invoke("save_settings", { settings });
      // Apply saved appearance preferences without waiting for environment checks.
      setSnapshot((current) => (current ? { ...current, settings } : current));
    });
    if (!saved) return;
    const mpeEnabled =
      (patch.autoCheckMpe === true && !snapshot.settings.autoCheckMpe) ||
      (patch.autoInstallMpe === true && !snapshot.settings.autoInstallMpe);
    const desktopEnabled =
      patch.autoUpdateDesktop === true && !snapshot.settings.autoUpdateDesktop;
    if (mpeEnabled || desktopEnabled) {
      await refresh()
        .then((current) =>
          automatic(
            current,
            mpeEnabled && desktopEnabled
              ? "all"
              : mpeEnabled
                ? "mpe"
                : "desktop",
          ),
        )
        .catch((e) => setError(String(e)));
    }
  };
  const checkVersions = () =>
    run(async () => {
      const current = await refresh();
      const status = await loadEnvironmentVersions(current, false);
      setUpdateStatus(status);
    }, "environment");
  return {
    snapshot,
    busy,
    error,
    notice,
    progress,
    downloadProgress,
    content,
    versions,
    versionInfo,
    versionsLoading,
    updateStatus,
    desktopUpdateStatus,
    checkDesktopUpdate,
    run,
    save,
    refresh,
    checkVersions,
    setNotice,
    setError,
  };
}
