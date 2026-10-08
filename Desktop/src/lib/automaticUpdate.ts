import { CHECK_CANCELLED, CHECK_TIMEOUT, UPDATE_CANCELLED, waitForCheck } from "./checkCancellation";
import { invoke } from "@tauri-apps/api/core";
import type { Snapshot, VersionList } from "../types";
import type { NoticeKind } from "./feedback";
import { installEnvironment } from "./environmentInstall";

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
  check?: { signal: AbortSignal; complete: () => void },
): Promise<string> {
  onStatus("正在联网检查 MPE 更新");
  let result: VersionList;
  try {
    const request = invoke<VersionList>("release_versions", { force: true });
    result = await (check ? waitForCheck(request, check.signal) : request);
    if (check?.signal.aborted)
      return check.signal.reason === CHECK_TIMEOUT ? CHECK_TIMEOUT : CHECK_CANCELLED;
    check?.complete();
    onVersions(result);
  } catch (error) {
    check?.complete();
    if (check?.signal.aborted)
      return check.signal.reason === CHECK_TIMEOUT ? CHECK_TIMEOUT : CHECK_CANCELLED;
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
    const message = "MPE 已是最新可用版本";
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
  const installed = await installEnvironment(
    latest,
    onStatus,
    onNotice,
    `${found}，正在下载并更新`,
  );
  return installed ? `MPE 已更新至 ${installed.version}` : UPDATE_CANCELLED;
}

export async function runAutomaticUpdates(
  s: Snapshot,
  environment: () => Promise<unknown>,
  desktop: () => Promise<unknown>,
  target: "all" | "mpe" | "desktop" = "all",
  cancelled: () => boolean = () => false,
) {
  const failures: unknown[] = [];
  // Upgrade the host first so environment installation uses its latest logic.
  // A successful desktop update restarts the app without returning here.
  if (
    !cancelled() &&
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
  if (!cancelled() && target !== "desktop" && s.settings.autoCheckMpe) {
    try {
      await environment();
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length) throw failures[0];
}
