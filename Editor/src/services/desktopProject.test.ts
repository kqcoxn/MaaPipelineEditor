import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  openDesktopProject,
  shouldPreserveProjectStateOnDisconnect,
  type DesktopProjectDependencies,
} from "./desktopProject";

function dependencies(
  overrides: Partial<DesktopProjectDependencies> = {},
): DesktopProjectDependencies {
  return {
    selectDirectory: vi.fn(async () => "C:/next"),
    confirmSwitch: vi.fn(async () => true),
    switchWorkspace: vi.fn(async () => undefined),
    resetSession: vi.fn(),
    reconnect: vi.fn(),
    ...overrides,
  };
}

describe("desktopProject", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("does nothing when the native directory picker is cancelled", async () => {
    const deps = dependencies({ selectDirectory: vi.fn(async () => null) });

    const result = await openDesktopProject(deps);

    expect(result).toEqual({ status: "cancelled" });
    expect(deps.confirmSwitch).not.toHaveBeenCalled();
    expect(deps.switchWorkspace).not.toHaveBeenCalled();
    expect(deps.reconnect).not.toHaveBeenCalled();
  });

  it("reports native picker failures without changing the project", async () => {
    const error = new Error("picker failed");
    const deps = dependencies({
      selectDirectory: vi.fn(async () => {
        throw error;
      }),
    });

    const result = await openDesktopProject(deps);

    expect(result).toEqual({ status: "failed", error });
    expect(deps.confirmSwitch).not.toHaveBeenCalled();
    expect(deps.switchWorkspace).not.toHaveBeenCalled();
    expect(deps.reconnect).not.toHaveBeenCalled();
  });

  it("asks for confirmation before switching and leaves state untouched on decline", async () => {
    const deps = dependencies({ confirmSwitch: vi.fn(async () => false) });

    const result = await openDesktopProject(deps);

    expect(result).toEqual({ status: "declined", path: "C:/next" });
    expect(deps.switchWorkspace).not.toHaveBeenCalled();
    expect(deps.resetSession).not.toHaveBeenCalled();
  });

  it("reports confirmation failures without switching", async () => {
    const error = new Error("confirm failed");
    const deps = dependencies({
      confirmSwitch: vi.fn(async () => {
        throw error;
      }),
    });

    const result = await openDesktopProject(deps);

    expect(result).toEqual({ status: "failed", path: "C:/next", error });
    expect(deps.switchWorkspace).not.toHaveBeenCalled();
    expect(deps.reconnect).not.toHaveBeenCalled();
  });

  it("resets the editor only after a successful switch", async () => {
    const order: string[] = [];
    const deps = dependencies({
      switchWorkspace: vi.fn(async () => {
        expect(shouldPreserveProjectStateOnDisconnect()).toBe(true);
        order.push("switch");
      }),
      resetSession: vi.fn(() => order.push("reset")),
      reconnect: vi.fn(() => order.push("reconnect")),
    });

    const result = await openDesktopProject(deps);

    expect(result).toEqual({ status: "success", path: "C:/next" });
    expect(order).toEqual(["switch", "reset", "reconnect"]);
    expect(shouldPreserveProjectStateOnDisconnect()).toBe(false);
  });

  it("keeps the editor state and reconnects the rolled-back project on failure", async () => {
    const deps = dependencies({
      switchWorkspace: vi.fn(async () => {
        throw new Error("rollback");
      }),
    });

    const result = await openDesktopProject(deps);

    expect(result.status).toBe("failed");
    expect(deps.resetSession).not.toHaveBeenCalled();
    expect(deps.reconnect).toHaveBeenCalledTimes(1);
  });
});
