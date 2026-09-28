import { desktopContext, desktopInvoke } from "@/features/desktop/host";
import { localServer } from "@/services/server";

/** null means cancelled; browser downloads cannot report a filesystem path. */
export async function saveLogArchive(
  downloadPath: string,
  name: string,
): Promise<{ path?: string } | null> {
  if (desktopContext) {
    const path = await desktopInvoke<string | null>("desktop_save_archive", {
      name,
      downloadPath,
    });
    return path === null ? null : { path };
  }
  if (!/^\/diagnostics\/[A-Za-z0-9]+$/.test(downloadPath)) {
    throw new Error("无效的日志下载地址");
  }
  const address = new URL(localServer.getAddress());
  address.protocol = address.protocol === "wss:" ? "https:" : "http:";
  address.pathname = downloadPath;
  address.search = "";
  address.hash = "";
  const response = await fetch(address, { credentials: "omit", cache: "no-store" });
  if (!response.ok) throw new Error("日志下载失败，请重新导出");
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return {};
}
