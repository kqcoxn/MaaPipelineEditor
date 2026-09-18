import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Settings, Snapshot, Homepage, VersionList } from "./types";
import { bundledHomepage, preferCurrentHomepage } from "./lib/homepage";
import { versionListStatus } from "./lib/versions";

export const openLink = (url: string) => invoke("open_link", { url });
export function newer(a: string, b: string): boolean {
  const x = a.split(".").map(Number),
    y = b.split(".").map(Number);
  return x.some(
    (n, i) =>
      n > (y[i] ?? 0) && x.slice(0, i).every((v, j) => v === (y[j] ?? 0)),
  );
}
export function useLauncher() {
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [progress, setProgress] = useState("");
  const [content, setContent] = useState<Homepage>(bundledHomepage);
  const [versions, setVersions] = useState<string[]>([]);
  const [versionInfo, setVersionInfo] = useState<VersionList>();
  const [updateStatus, setUpdateStatus] = useState("");
  const gate = useRef(false);
  const refresh = useCallback(async () => {
    const next = await invoke<Snapshot>("snapshot");
    setSnapshot(next);
    return next;
  }, []);
  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      if (gate.current) return false;
      gate.current = true;
      setBusy(true);
      setError("");
      try {
        await action();
        await refresh();
        return true;
      } catch (e) {
        setError(String(e));
        await refresh().catch(() => {});
        return false;
      } finally {
        setBusy(false);
        gate.current = false;
        setProgress("");
      }
    },
    [refresh],
  );
  const automatic = useCallback(
    async (s: Snapshot) => {
      if (
        !s.settings.autoUpdate ||
        !s.settings.onboardingDone ||
        s.running ||
        s.service.state !== "stopped"
      )
        return;
      await run(async () => {
        if (s.environment.ready && !s.settings.fixedVersion) {
          let result: VersionList | undefined;
          try {
            result = await invoke<VersionList>("release_versions", {
              force: false,
            });
            setVersions(result.versions);
            setVersionInfo(result);
            setUpdateStatus(versionListStatus(result));
          } catch (error) {
            setUpdateStatus(`版本检查未完成：${String(error)}`);
          }
          if (
            result &&
            !result.stale &&
            result.versions[0] &&
            newer(result.versions[0], s.environment.version)
          ) {
            await invoke("install_environment", {
              version: result.versions[0],
            });
            setNotice(`MPE 已更新至 ${result.versions[0]}`);
          }
        }
        try {
          await invoke("update_desktop");
        } catch (error) {
          setUpdateStatus((previous) =>
            [previous, `桌面端更新检查未完成：${String(error)}`]
              .filter(Boolean)
              .join("；"),
          );
        }
      });
    },
    [run],
  );
  useEffect(() => {
    let disposed = false;
    const disposers: Array<() => void> = [];
    const subscribe = <T>(name: string, cb: (value: T) => void) => {
      void listen<T>(name, (e) => cb(e.payload)).then((off) =>
        disposed ? off() : disposers.push(off),
      );
    };
    void refresh()
      .then((s) => {
        if (!disposed) void automatic(s);
      })
      .catch((e) => setError(String(e)));
    void invoke<Homepage>("homepage")
      .then((value) => setContent(preferCurrentHomepage(value)))
      .catch(() => {});
    subscribe<string>("engine-progress", (value) => {
      try {
        const phase = JSON.parse(value).phase;
        setProgress(
          (
            {
              downloading: "正在下载配套资源",
              verifying: "正在校验与解压",
              installing: "正在切换版本",
              validating: "正在验证已安装环境",
              complete: "环境已准备完成",
            } as Record<string, string>
          )[phase] ?? value,
        );
      } catch {
        setProgress(value);
      }
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
    return () => {
      disposed = true;
      disposers.forEach((off) => off());
    };
  }, [refresh, automatic]);
  const save = async (patch: Partial<Settings>) => {
    if (!snapshot) return;
    const settings = { ...snapshot.settings, ...patch };
    await run(async () => {
      await invoke("save_settings", { settings });
      // Apply saved appearance preferences without waiting for environment checks.
      setSnapshot((current) => (current ? { ...current, settings } : current));
    });
  };
  const checkVersions = () =>
    run(async () => {
      try {
        const result = await invoke<VersionList>("release_versions", {
          force: true,
        });
        setVersions(result.versions);
        setVersionInfo(result);
        const status = versionListStatus(result);
        setUpdateStatus(status);
        setNotice(
          status || `版本列表已刷新，共 ${result.versions.length} 个可安装版本`,
        );
      } catch (error) {
        setUpdateStatus(String(error));
        throw error;
      }
    });
  return {
    snapshot,
    busy,
    error,
    notice,
    progress,
    content,
    versions,
    versionInfo,
    updateStatus,
    run,
    save,
    refresh,
    checkVersions,
    setNotice,
    setError,
  };
}
