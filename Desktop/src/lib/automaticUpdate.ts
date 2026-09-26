import { invoke } from "@tauri-apps/api/core";
import type { Snapshot, VersionList } from "../types";
import type { NoticeKind } from "./feedback";

export function newer(a: string, b: string): boolean {
  const x = a.split(".").map(Number),
    y = b.split(".").map(Number);
  return x.some(
    (n, i) =>
      n > (y[i] ?? 0) && x.slice(0, i).every((v, j) => v === (y[j] ?? 0)),
  );
}

export function automaticUpdateBlock(s: Snapshot): string | undefined {
  if (!s.settings.autoInstallMpe) return "MPE 自动安装已关闭";
  if (!s.settings.onboardingDone) return "完成首次配置后检查更新";
  if (s.running || s.service.state !== "stopped")
    return "编辑器或服务运行中，停止后检查更新";
}

export async function updateEnvironment(
  s: Snapshot,
  onVersions: (result: VersionList) => void,
  onStatus: (status: string) => void,
  onNotice: (notice: string, kind?: NoticeKind) => void = () => {},
  allowInstall = true,
): Promise<string> {
  onStatus("正在联网检查 MPE 更新");
  let result: VersionList;
  try {
    result = await invoke<VersionList>("release_versions", { force: true });
    onVersions(result);
  } catch (error) {
    const message = `MPE 版本检查失败：${String(error)}`;
    onNotice(message, "error");
    return message;
  }
  if (result.stale) {
    const message = "MPE 联网检查失败，保留缓存版本列表，不自动安装";
    onNotice(message, "action");
    return message;
  }
  if (!result.versions.length) {
    const message = "暂无适用于当前设备的可安装版本";
    onNotice(message, "action");
    return message;
  }
  const latest = result.versions[0];
  const blocked = s.settings.fixedVersion
    ? `MPE 已固定为 ${s.settings.fixedVersion}，不自动切换版本`
    : !s.environment.ready
      ? "运行环境尚未就绪，请在环境管理中安装或修复"
      : automaticUpdateBlock(s);
  if (!s.environment.version) {
    const message = `可安装 MPE ${latest}（Editor + LB），请在环境管理中安装`;
    onNotice(message, "action");
    return message;
  }
  if (!newer(latest, s.environment.version)) {
    if (!s.environment.ready) {
      const message = "运行环境尚未就绪，请在环境管理中安装或修复";
      onNotice(message, "action");
      return message;
    }
    const message = `MPE ${s.environment.version} 已是最新可用版本`;
    onNotice(allowInstall ? "" : message, "info");
    return message;
  }
  const found = `发现前后端更新：MPE ${s.environment.version} → ${latest}（Editor + LB）`;
  if (blocked || !allowInstall) {
    const summary = [found, blocked, "可在环境管理中选择版本并安装"]
      .filter(Boolean)
      .join("；");
    onNotice(summary, "action");
    return summary;
  }
  onStatus(`发现 MPE ${latest}，正在更新`);
  onNotice(`${found}，正在下载并更新`, "pending");
  try {
    await invoke("install_environment", { version: latest });
    onNotice(`前后端更新完成：Editor 与 LB 已更新至 MPE ${latest}`, "success");
    return `MPE 已更新至 ${latest}`;
  } catch (error) {
    onNotice(`MPE ${latest} 更新失败：${String(error)}`, "error");
    onStatus(`MPE ${latest} 更新失败：${String(error)}`);
    throw error;
  }
}

export async function runAutomaticUpdates(
  s: Snapshot,
  environment: () => Promise<unknown>,
  desktop: () => Promise<unknown>,
  target: "all" | "mpe" | "desktop" = "all",
) {
  const failures: unknown[] = [];
  if (target !== "desktop" && s.settings.autoCheckMpe) {
    try {
      await environment();
    } catch (error) {
      failures.push(error);
    }
  }
  if (
    target !== "mpe" &&
    s.settings.autoUpdateDesktop &&
    s.settings.onboardingDone &&
    !s.running &&
    s.service.state === "stopped"
  ) {
    try {
      await desktop();
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length) throw failures[0];
}
