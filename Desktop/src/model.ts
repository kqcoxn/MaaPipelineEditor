import { CHECK_TIMEOUT, UPDATE_CANCELLED } from "./lib/checkCancellation";
import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Settings, Snapshot, Homepage, VersionList } from "./types";
import { bundledHomepage, preferCurrentHomepage } from "./lib/homepage";
import {
  applyEnvironmentUpdate,
  newer,
  updateEnvironment,
} from "./lib/automaticUpdate";
import { BackgroundUpdates } from "./lib/backgroundUpdates";
import { UpdateHistory } from "./lib/updateHistory";
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
  const currentSnapshot = useRef<Snapshot | undefined>(undefined);
  const background = useRef<BackgroundUpdates | undefined>(undefined);
  const [history] = useState(() => new UpdateHistory());
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
  const cancelCheck = async () => {
    if (cancellationPending.current) return;
    background.current?.cancel();
    const epoch = operationEpoch.current;
    cancellationPending.current = true;
    setCancelling(true);
    setCanCancelCheck(false);
    if (checkController.current) {
      checkController.current.abort();
      setCanCancelCheck(false);
    } else {
      try {
        const cancelled = await invoke<boolean>("cancel_update_check");
        if (epoch !== operationEpoch.current || !gate.current) return;
        if (!cancelled) {
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
    currentSnapshot.current = next;
    history.setRevision(next.desktopRevision);
    setSnapshot(next);
    return next;
  }, [history]);
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
        background.current?.resume();
      }
    },
    [refresh],
  );
  const loadEnvironmentVersions = useCallback(
    async (s: Snapshot, allowInstall: boolean) => {
      background.current?.supersede("mpe");
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
            history.recordMpe(result);
            setVersions(result.versions);
            setVersionInfo(result);
            setVersionsLoading(false);
          },
          setUpdateStatus,
          (message, kind) => setNotice(message, kind, "environment"),
          allowInstall,
          {
            signal: controller.signal,
            complete,
            failed: () => history.fail("mpe"),
          },
        );
      } finally {
        if (controller.signal.aborted) {
          history.fail("mpe");
        }
        complete();
        setVersionsLoading(false);
      }
    },
    [history],
  );
  const checkDesktopUpdate = useCallback(
    async (cached = false) => {
      if (!cached) background.current?.supersede("desktop");
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
        }, cached);
        if (status === UPDATE_CANCELLED) history.fail("desktop");
        else history.recordDesktop(false);
        setDesktopUpdateStatus(status);
        clearFeedback("desktop");
        return status;
      } catch (error) {
        setDesktopUpdateStatus(`桌面端更新失败：${String(error)}`);
        setError(`桌面端更新失败：${String(error)}`, "desktop");
        history.fail("desktop");
        throw error;
      } finally {
        setCanCancelCheck(false);
        setDesktopUpdateProgress(undefined);
      }
    },
    [history],
  );
  if (!background.current) {
    background.current = new BackgroundUpdates(history, {
      snapshot: () => currentSnapshot.current,
      refresh,
      busy: () => gate.current,
      run: (action) => run(action, "environment"),
      checkMpe: (force) => invoke<VersionList>("release_versions", { force }),
      checkDesktop: (cached) =>
        invoke<boolean>("check_desktop_update", { cached }),
      installDesktop: () => checkDesktopUpdate(true),
      installMpe: async (s, list) => {
        const status = await applyEnvironmentUpdate(
          s,
          list,
          setUpdateStatus,
          (message, kind) => setNotice(message, kind, "environment"),
        );
        setUpdateStatus(status);
        return status;
      },
      onMpe: (list) => {
        setVersions(list.versions);
        setVersionInfo(list);
        const s = currentSnapshot.current;
        if (s)
          void applyEnvironmentUpdate(
            s,
            list,
            setUpdateStatus,
            (message, kind) => {
              if (
                kind === "action" &&
                !list.stale &&
                s.settings.autoCheckMpe &&
                list.versions[0] &&
                newer(list.versions[0], s.environment.version)
              )
                setNotice(message, kind, "environment");
            },
            false,
          ).then(setUpdateStatus);
      },
      onDesktop: (available) =>
        setDesktopUpdateStatus(
          available
            ? "发现桌面端更新，空闲时自动安装"
            : "未发现可用的桌面端更新",
        ),
      onChecking: (target) => {
        if (target === "desktop")
          setDesktopUpdateStatus("正在后台检查桌面端更新，可启动编辑器");
        else setUpdateStatus("正在后台检查 MPE 更新，可启动编辑器");
      },
      onError: (target, error) => {
        const message = `后台更新失败：${String(error)}；保留当前版本，稍后重试`;
        if (target === "desktop") setDesktopUpdateStatus(message);
        else setUpdateStatus(message);
      },
    });
  }
  const automatic = useCallback(
    async (
      _s: Snapshot,
      target: "all" | "mpe" | "desktop" = "all",
      force = false,
    ) => {
      await background.current?.request(target, force);
    },
    [],
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
      background.current?.stop();
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
            true,
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
    checkDesktopUpdate: () => checkDesktopUpdate(false),
    run,
    save,
    refresh,
    checkVersions,
    installEnvironment: (version: string) => {
      background.current?.supersede("mpe");
      return installEnvironment(version, setUpdateStatus, (message, kind) =>
        setNotice(message, kind, "environment"),
      );
    },
    setNotice,
    setError,
  };
}
