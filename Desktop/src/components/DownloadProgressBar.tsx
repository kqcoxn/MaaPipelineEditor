import type { DownloadProgress } from "../lib/installProgress";

export function DownloadProgressBar({
  progress,
}: {
  progress?: DownloadProgress;
}) {
  if (!progress) return null;
  const percent =
    progress.percent === undefined
      ? undefined
      : Math.min(100, Math.max(0, progress.percent));
  return (
    <span
      className="download-progress"
      role="progressbar"
      aria-label={progress.label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      data-indeterminate={percent === undefined || undefined}
    >
      <span
        className="download-progress-fill"
        aria-hidden="true"
        style={percent === undefined ? undefined : { width: `${percent}%` }}
      />
    </span>
  );
}
