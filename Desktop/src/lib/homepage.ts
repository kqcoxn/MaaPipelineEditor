import fallback from "../../../Landing/public/mpe-desktop.json";
import reportCoverUrl from "../../../Landing/public/reports/mpe-performance-193.png?url";
import type { Homepage } from "../types";

export const bundledHomepage: Homepage = fallback;
export const reportCover = reportCoverUrl;

// Use the bundled copy of this report's cover even before the site is deployed.
export function homepageImage(image?: string): string {
  return image === "https://mpe.codax.site/landing/reports/mpe-performance-193.png" ||
    !image
    ? reportCover
    : image;
}

export function preferCurrentHomepage(candidate: Homepage): Homepage {
  // An old remote feed/cache must not replace newer editorial content in the app.
  const revision = candidate.revision ?? 0;
  return Number.isSafeInteger(revision) && revision >= fallback.revision
    ? candidate
    : bundledHomepage;
}
