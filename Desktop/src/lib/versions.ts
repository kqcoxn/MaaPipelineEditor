import type { VersionList } from "../types";

export function versionListStatus(result: VersionList): string {
  return [
    result.warning,
    result.versions.length === 0
      ? "暂无适用于当前桌面端和平台的可安装版本。发布完整配套资源后，版本才会出现在列表中。"
      : null,
  ]
    .filter(Boolean)
    .join("；");
}
