import { describe, expect, it, vi } from "vitest";

import { handleDesktopCloseRequest } from "./desktopCloseGuard";

describe("desktopCloseGuard", () => {
  it("keeps the application open when the user continues editing", async () => {
    const exitApplication = vi.fn(async () => undefined);

    await expect(
      handleDesktopCloseRequest({
        confirmExit: vi.fn(async () => false),
        exitApplication,
      }),
    ).resolves.toBe(false);

    expect(exitApplication).not.toHaveBeenCalled();
  });

  it("exits only after the editor guard confirms", async () => {
    const exitApplication = vi.fn(async () => undefined);

    await expect(
      handleDesktopCloseRequest({
        confirmExit: vi.fn(async () => true),
        exitApplication,
      }),
    ).resolves.toBe(true);

    expect(exitApplication).toHaveBeenCalledOnce();
  });
});
