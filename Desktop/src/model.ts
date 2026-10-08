import { CHECK_TIMEOUT, UPDATE_CANCELLED } from "./lib/checkCancellation";
import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Settings, Snapshot, Homepage, VersionList } from "./types";
import { bundledHomepage, preferCurrentHomepage } from "./lib/homepage";
import { runAutomaticUpdates, updateEnvironment } from "./lib/automaticUpdate";
import { updateDesktop } from "./lib/desktopUpdate";
import { installEnvironment } from "./lib/environmentInstall";
import {
  clearFeedback,
  setError,
  setNotice,
  type FeedbackScope,
} from "./lib/feedback";
export { newer } from "./lib/automaticUpdate";
import {
  parseInstallProgress,
  type InstallProgress,
} from "./lib/installProgress";

export const openLink = (url: string) => invoke("open_link", { url });
export function useLauncher() {
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [busy, setBusy] = useState(false);
  const [installationProgress, setInstallationProgress] =
    useState<InstallProgress>({ text: "" });
  const { text: progress, download: downloadProgress } = installationProgress;
  const [content, setContent] = useState<Homepage>(bundledHomepage);
  const [versions, setVersions] = useState<string[]>([]);
  const [versionInfo, setVersionInfo] = useState<VersionList>();
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [updateStatus, setUpdateStatus] = useState("");
  const [desktopUpdateStatus, setDesktopUpdateStatus] = useState("");
  const [desktopUpdateProgress, setDesktopUpdateProgress] =
    useState<InstallProgress>();
  const gate = useRef(false);
  const [canCancelCheck, setCanCancelCheck] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const cancellationPending = useRef(false);
  const operationEpoch = useRef(0);
  const checkController = useRef<AbortController | undefined>(undefined);
  const checksCancelled = useRef(false);
  const cancelCheck = async () => {
    if (cancellationPending.current) return;
    const epoch = operationEpoch.current;
    // Stop the automatic chain immediately, even if the cancel IPC reply arrives
    // after the update command has already completed.
    checksCancelled.current = true;
    cancellationPending.current = true;
    setCancelling(true);
    setCanCancelCheck(false);
    if (checkController.current) {
      checksCancelled.current = true;
      checkController.current.abort();
      setCanCancelCheck(false);
    } else {
      try {
        const cancelled = await invoke<boolean>("cancel_update_check");
        if (epoch !== operationEpoch.current || !gate.current) return;
        if (cancelled) checksCancelled.current = true;
        else {
          cancellationPending.current = false;
          setCancelling(false);
        }
      } catch (error) {
        if (epoch !== operationEpoch.current || !gate.current) return;
        cancellationPending.current = false;
        setCancelling(false);
        setError(String(error));
      }
    }
  };
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
      operationEpoch.current += 1;
      cancellationPending.current = false;
      setCancelling(false);
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
        setCanCancelCheck(false);
        setCancelling(false);
        cancellationPending.current = false;
        setBusy(false);
        gate.current = false;
        setInstallationProgress({ text: "" });
      }
    },
    [refresh],
  );
  const loadEnvironmentVersions = useCallback(
    async (s: Snapshot, allowInstall: boolean) => {
      const controller = new AbortController();
      checkController.current = controller;
      setCanCancelCheck(true);
      setVersionsLoading(true);
      const timer = setTimeout(() => controller.abort(CHECK_TIMEOUT), 30_000);
      const complete = () => {
        clearTimeout(timer);
        setCanCancelCheck(false);
        checkController.current = undefined;
      };
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
          { signal: controller.signal, complete },
        );
      } finally {
        if (controller.signal.aborted) checksCancelled.current = true;
        complete();
        setVersionsLoading(false);
      }
    },
    [],
  );
  const checkDesktopUpdate = useCallback(async () => {
    clearFeedback("desktop");
    setDesktopUpdateStatus("正在检查桌面端更新");
    setDesktopUpdateProgress({ text: "正在检查桌面端更新" });
    try {
      const status = await updateDesktop((progress) => {
        setCanCancelCheck(
          !cancellationPending.current && progress.cancellable === true,
        );
        setDesktopUpdateProgress(progress);
        setDesktopUpdateStatus(progress.text);
      });
      if (status === UPDATE_CANCELLED) checksCancelled.current = true;
      setDesktopUpdateStatus(status);
      clearFeedback("desktop");
    } catch (error) {
      setDesktopUpdateStatus(`桌面端更新失败：${String(error)}`);
      setError(`桌面端更新失败：${String(error)}`, "desktop");
    } finally {
      setCanCancelCheck(false);
      setDesktopUpdateProgress(undefined);
    }
  }, []);
  const automatic = useCallback(
    async (s: Snapshot, target: "all" | "mpe" | "desktop" = "all") => {
      await run(() => {
        checksCancelled.current = false;
        return runAutomaticUpdates(
          s,
          async () => setUpdateStatus(await loadEnvironmentVersions(s, true)),
          checkDesktopUpdate,
          target,
          () => checksCancelled.current,
        );
      }, "environment");
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
      if (!gate.current) return;
      const progress = parseInstallProgress(value);
      setInstallationProgress(progress);
      setCanCancelCheck(
        !cancellationPending.current && progress.cancellable === true,
      );
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
    canCancelCheck,
    cancelling,
    cancelCheck,
    progress,
    downloadProgress,
    content,
    versions,
    versionInfo,
    versionsLoading,
    updateStatus,
    desktopUpdateStatus,
    desktopUpdateProgress,
    checkDesktopUpdate,
    run,
    save,
    refresh,
    checkVersions,
    installEnvironment: (version: string) =>
      installEnvironment(version, setUpdateStatus, (message, kind) =>
        setNotice(message, kind, "environment"),
      ),
    setNotice,
    setError,
  };
}
