export interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseNotes: string;
  publishedAt: string;
}

interface GitHubRelease {
  tag_name: string;
  body: string;
  published_at: string;
}

const GITHUB_API_URL =
  "https://api.github.com/repos/kqcoxn/MaaPipelineEditor/releases/latest";

export async function checkUpdateFromFrontend(
  currentVersion: string,
): Promise<UpdateInfo | null> {
  if ("__TAURI_INTERNALS__" in window) return null;
  try {
    const response = await fetch(GITHUB_API_URL, {
      headers: { Accept: "application/vnd.github.v3+json" },
    });
    if (!response.ok) return null;
    const release = (await response.json()) as GitHubRelease;
    const latestVersion = release.tag_name.replace(/^v/, "");
    return {
      hasUpdate:
        compareVersions(latestVersion, currentVersion.replace(/^v/, "")) > 0,
      currentVersion,
      latestVersion: release.tag_name,
      releaseNotes: release.body,
      publishedAt: release.published_at,
    };
  } catch (error) {
    console.error("[UpdateCheck] Failed to check GitHub release:", error);
    return null;
  }
}

function compareVersions(left: string, right: string): number {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}
