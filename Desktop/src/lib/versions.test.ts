import { describe, expect, it } from "vitest";
import type { VersionList } from "../types";
import { versionListStatus } from "./versions";

const result: VersionList = {
  versions: [],
  source: "github",
  cached: false,
  stale: false,
  checkedAt: 1,
  warning: null,
};

describe("version discovery feedback", () => {
  it("explains an empty successful response, including cached responses", () => {
    expect(versionListStatus(result)).toContain("暂无");
    expect(versionListStatus({ ...result, cached: true })).toContain(
      "配套资源",
    );
  });
  it("preserves the request failure when the fallback cache is also empty", () => {
    const status = versionListStatus({
      ...result,
      stale: true,
      warning: "网络不可用",
    });
    expect(status).toContain("网络不可用");
    expect(status).toContain("暂无");
  });
  it("allows success only when installable versions exist and no warning remains", () => {
    expect(versionListStatus({ ...result, versions: ["1.10.1"] })).toBe("");
  });
});
