import { invoke } from "@tauri-apps/api/core";
import type { Snapshot } from "../types";
import type { NoticeKind } from "./feedback";
import { UPDATE_CANCELLED } from "./checkCancellation";

/** All installation entry points replace the previous operation's status. */
export async function installEnvironment(
  version: string,
  onStatus: (status: string) => void,
  onNotice: (notice: string, kind?: NoticeKind) => void,
  pending = "正在下载并安装 MPE",
): Promise<Snapshot["environment"] | undefined> {
  onStatus(pending);
  onNotice(pending, "pending");
  try {
    const installed = await invoke<
      Snapshot["environment"] | { cancelled: true }
    >("install_environment", { version });
    if ("cancelled" in installed) {
      onStatus(UPDATE_CANCELLED);
      onNotice(UPDATE_CANCELLED, "info");
      return;
    }
    if (!installed.ready || !installed.version) {
      throw new Error(
        `安装后环境检查未通过：${installed.problems.join("；") || "环境未就绪"}`,
      );
    }
    onStatus(`MPE 已更新至 ${installed.version}`);
    onNotice(
      `前后端更新完成：Editor 与 LB 已更新至 MPE ${installed.version}`,
      "success",
    );
    return installed;
  } catch (error) {
    const message = `MPE ${version === "latest" ? "最新稳定版" : version} 更新失败：${String(error)}`;
    onStatus(message);
    onNotice(message, "error");
    throw error;
  }
}
