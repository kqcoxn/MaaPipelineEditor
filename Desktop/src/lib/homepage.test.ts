import { describe, expect, it } from "vitest";
import journeyCoverUrl from "../../../Landing/public/reports/mpe-2-journey-v2.png?url";
import {
  bundledHomepage,
  homepageImage,
  preferCurrentHomepage,
  reportCover,
} from "./homepage";

describe("homepage editorial content", () => {
  it("keeps bundled reports when remote content or cache is older", () => {
    expect(
      preferCurrentHomepage({ ...bundledHomepage, revision: undefined }),
    ).toBe(bundledHomepage);
    expect(
      preferCurrentHomepage({
        ...bundledHomepage,
        revision: bundledHomepage.revision! - 1,
      }),
    ).toBe(bundledHomepage);
  });
  it("accepts current and newer remote publications", () => {
    for (const revision of [
      bundledHomepage.revision!,
      bundledHomepage.revision! + 1,
    ]) {
      const publication = { ...bundledHomepage, revision };
      expect(preferCurrentHomepage(publication)).toBe(publication);
    }
  });
  it("serves the built-in report cover locally and preserves other remote images", () => {
    expect(
      homepageImage(
        "https://mpe.codax.site/landing/reports/mpe-performance-193.png",
      ),
    ).toBe(reportCover);
    expect(
      homepageImage(
        "https://mpe.codax.site/landing/reports/mpe-2-journey-v2.png",
      ),
    ).toBe(journeyCoverUrl);
    expect(homepageImage("https://example.com/news.png")).toBe(
      "https://example.com/news.png",
    );
  });
});
