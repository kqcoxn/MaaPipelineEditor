import { describe, expect, it } from "vitest";
import {
  collectPerformanceSnapshot,
  createPerformanceLogFixtures,
} from "./performanceBaseline";

describe("performance baseline fixtures", () => {
  it("creates deterministic backend and embed log volumes", () => {
    const first = createPerformanceLogFixtures();
    const second = createPerformanceLogFixtures();

    expect(first).toEqual(second);
    expect(first.backendLogs).toHaveLength(1000);
    expect(first.embedLogs).toHaveLength(200);
    expect(first.importantBackendLogs.length).toBeGreaterThan(0);
    expect(first.importantBackendLogs.every((log) => log.level !== "INFO")).toBe(
      true,
    );
  });

  it("captures DOM count without requiring the non-standard memory API", () => {
    const element = document.createElement("div");
    document.body.appendChild(element);

    const snapshot = collectPerformanceSnapshot();

    expect(snapshot.domElements).toBeGreaterThan(0);
    expect(snapshot.usedJSHeapBytes === null || snapshot.usedJSHeapBytes >= 0).toBe(
      true,
    );
    element.remove();
  });
});
