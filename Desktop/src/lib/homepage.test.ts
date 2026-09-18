import { describe, expect, it } from "vitest";
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
      preferCurrentHomepage({ ...bundledHomepage, revision: 0 }),
    ).toBe(bundledHomepage);
  });
  it("accepts current and newer remote publications", () => {
    for (const revision of [1, 2]) {
      const publication = { ...bundledHomepage, revision };
      expect(preferCurrentHomepage(publication)).toBe(publication);
    }
  });
  it("serves the built-in report cover locally and preserves other remote images", () => {
    expect(homepageImage(bundledHomepage.slides[0].image)).toBe(reportCover);
    expect(homepageImage("https://example.com/news.png")).toBe(
      "https://example.com/news.png",
    );
  });
});
