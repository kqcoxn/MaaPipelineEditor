import fallback from "../../../Landing/public/mpe-desktop.json";
import reportCoverUrl from "../../../Landing/public/reports/mpe-performance-193.png?url";
import journeyCoverUrl from "../../../Landing/public/reports/mpe-2-journey-v2.png?url";
import type { Homepage } from "../types";

export const bundledHomepage: Homepage = fallback;
export const reportCover = reportCoverUrl;

const bundledCovers: Record<string, string> = {
  "https://mpe.codax.site/landing/reports/mpe-performance-193.png":
    reportCoverUrl,
  "https://mpe.codax.site/landing/reports/mpe-2-journey-v2.png":
    journeyCoverUrl,
};

// Use bundled report covers even before the site is deployed.
export function homepageImage(image?: string): string {
  return image ? (bundledCovers[image] ?? image) : reportCover;
}

export function preferCurrentHomepage(candidate: Homepage): Homepage {
  // An old remote feed/cache must not replace newer editorial content in the app.
  const revision = candidate.revision ?? 0;
  return Number.isSafeInteger(revision) && revision >= fallback.revision
    ? candidate
    : bundledHomepage;
}
