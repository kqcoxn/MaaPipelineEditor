import { describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { loadReleaseNotes, noteVersions } from "./releaseNotes";
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("release notes", () => {
  it("includes offline history and installed versions even outside the installable list", async () => {
    expect(
      noteVersions(["2.0.1", "2.0.1"], "2.0.0").filter((v) => v === "2.0.1"),
    ).toHaveLength(1);
    expect(noteVersions([], "2.0.0")).toContain("1.10.1");
    expect(await loadReleaseNotes("2.0.1")).toContain("进度提示");
    expect(invoke).not.toHaveBeenCalled();
  });
  it("retries failed requests and keeps successful notes isolated by version", async () => {
    vi.mocked(invoke)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce("new release notes")
      .mockResolvedValueOnce("another release");
    await expect(loadReleaseNotes("99.0.0")).rejects.toThrow("offline");
    expect(await loadReleaseNotes("99.0.0")).toBe("new release notes");
    expect(await loadReleaseNotes("99.0.1")).toBe("another release");
    expect(await loadReleaseNotes("99.0.0")).toBe("new release notes");
    expect(invoke).toHaveBeenCalledTimes(3);
  });
});
