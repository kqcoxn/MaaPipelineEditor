const GITHUB_API_URL =
  "https://api.github.com/repos/kqcoxn/MaaPipelineEditor/releases/latest";
const RELEASES_URL =
  "https://github.com/kqcoxn/MaaPipelineEditor/releases/latest";

export interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseNotes: string;
  downloadURL: string;
  publishedAt: string;
}

interface GitHubRelease {
  tag_name: string;
  body: string;
  published_at: string;
}

/**
 * 从前端检查 GitHub Release 更新。
 */
export async function checkUpdateFromFrontend(
  currentVersion: string,
): Promise<UpdateInfo | null> {
  try {
    const response = await fetch(GITHUB_API_URL, {
      headers: {
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) {
      console.error("[UpdateCheck] GitHub API error:", response.status);
      return null;
    }

    const release: GitHubRelease = await response.json();
    const latestVersion = release.tag_name.replace(/^v/, "");
    const current = currentVersion.replace(/^v/, "");

    return {
      hasUpdate: compareVersions(latestVersion, current) > 0,
      currentVersion,
      latestVersion: release.tag_name,
      releaseNotes: release.body,
      downloadURL: RELEASES_URL,
      publishedAt: release.published_at,
    };
  } catch (error) {
    console.error("[UpdateCheck] Failed to check update:", error);
    return null;
  }
}

function compareVersions(a: string, b: string): number {
  const partsA = a.split(".").map(Number);
  const partsB = b.split(".").map(Number);
  const maxLen = Math.max(partsA.length, partsB.length);

  for (let index = 0; index < maxLen; index += 1) {
    const numA = partsA[index] || 0;
    const numB = partsB[index] || 0;
    if (numA > numB) return 1;
    if (numA < numB) return -1;
  }

  return 0;
}
