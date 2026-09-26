export type DownloadProgress = {
  label: string;
  percent?: number;
};

export type InstallProgress = { text: string; download?: DownloadProgress };

const phases: Record<string, string> = {
  downloading: "正在连接下载服务器",
  verifying: "正在校验与解压",
  installing: "正在切换版本",
  validating: "正在验证已安装环境",
  complete: "环境已准备完成",
};

function size(bytes: number): string {
  for (const unit of ["B", "KiB", "MiB", "GiB"]) {
    if (bytes < 1024 || unit === "GiB") return `${bytes.toFixed(1)} ${unit}`;
    bytes /= 1024;
  }
  return "";
}

const nonnegative = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

export function parseInstallProgress(value: string): InstallProgress {
  try {
    const event = JSON.parse(value);
    if (event.phase === "downloading" && nonnegative(event.downloaded)) {
      const total = nonnegative(event.total) ? event.total : 0;
      const percent =
        total > 0 ? Math.min(100, (event.downloaded / total) * 100) : undefined;
      const label = event.artifact === "editor" ? "Editor" : "运行环境";
      const amount =
        total > 0
          ? `${size(event.downloaded)} / ${size(total)}（${percent!.toFixed(1)}%）`
          : `${size(event.downloaded)}（总大小未知）`;
      const speed = size(
        nonnegative(event.bytesPerSecond) ? event.bytesPerSecond : 0,
      );
      const elapsed = nonnegative(event.elapsedSeconds)
        ? Math.floor(event.elapsedSeconds)
        : 0;
      const waiting =
        total === 0 && event.downloaded === 0 ? "等待下载响应 · " : "";
      return {
        text: `${label}：${waiting}${amount} · ${speed}/s · 已用 ${elapsed}s`,
        download: { label: `${label}下载进度`, percent },
      };
    }
    return { text: phases[event.phase] ?? value };
  } catch {
    return { text: value };
  }
}
