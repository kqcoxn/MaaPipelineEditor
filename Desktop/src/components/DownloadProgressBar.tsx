import type { DownloadProgress } from "../lib/installProgress";

export function DownloadProgressBar({
  progress,
}: {
  progress?: DownloadProgress;
}) {
  if (!progress) return null;
  return (
    <progress
      className="download-progress"
      aria-label={progress.label}
      max={100}
      value={progress.percent}
    />
  );
}
