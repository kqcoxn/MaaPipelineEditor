import { describe, expect, it, vi } from "vitest";
import type { Snapshot, VersionList } from "../types";
import { BackgroundUpdates } from "./backgroundUpdates";
import {
  CHECK_INTERVAL,
  FAILURE_COOLDOWN,
  UpdateHistory,
} from "./updateHistory";
import { UPDATE_CANCELLED } from "./checkCancellation";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}
function fixture() {
  let now = CHECK_INTERVAL * 2;
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
  const history = new UpdateHistory(storage, () => now);
  history.setRevision("2.0.2");
  const s: Snapshot = {
    settings: {
      autoCheckMpe: true,
      autoInstallMpe: true,
      autoUpdateDesktop: true,
      onboardingDone: true,
      fixedVersion: null,
    } as Snapshot["settings"],
    environment: { ready: true, version: "2.0.0", directory: "", problems: [] },
    service: { state: "stopped", id: "", root: "" },
    running: false,
    busy: false,
    desktopVersion: "2.0.0",
    desktopRevision: "2.0.2",
  };
  const list = (patch: Partial<VersionList> = {}): VersionList => ({
    versions: ["2.0.1"],
    checkedAt: now / 1000,
    source: "static",
    cached: false,
    stale: false,
    warning: null,
    ...patch,
  });
  let busy = false;
  const installed: string[] = [];
  const ports = {
    snapshot: () => s,
    refresh: vi.fn(async () => s),
    busy: () => busy,
    run: vi.fn(async (action: () => Promise<unknown>) => {
      if (busy) return false;
      busy = true;
      try {
        await action();
        return true;
      } finally {
        busy = false;
      }
    }),
    checkMpe: vi.fn(async (_force: boolean) => list()),
    checkDesktop: vi.fn(async (_cached: boolean) => false),
    installMpe: vi.fn(async (_s: Snapshot, result: VersionList) => {
      s.environment.version = result.versions[0];
      installed.push(`mpe:${s.environment.version}`);
      return "已更新";
    }),
    installDesktop: vi.fn(async () => {
      installed.push("desktop");
      return "已更新";
    }),
    onMpe: vi.fn(),
    onDesktop: vi.fn(),
    onChecking: vi.fn(),
    onError: vi.fn(),
  };
  return {
    history,
    s,
    list,
    ports,
    installed,
    storage,
    data,
    restart: () => new UpdateHistory(storage, () => now),
    advance: (ms: number) => {
      now += ms;
    },
    setBusy: (value: boolean) => {
      busy = value;
    },
    create: (h = history) => new BackgroundUpdates(h, ports),
  };
}

describe("background update scheduling", () => {
  it.each([
    [false, false],
    [false, true],
    [true, false],
    [true, true],
  ])(
    "respects independent MPE (%s) and Desktop (%s) preferences",
    async (mpe, desktop) => {
      const f = fixture();
      f.s.settings.autoCheckMpe = mpe;
      f.s.settings.autoUpdateDesktop = desktop;
      f.s.settings.autoInstallMpe = false;
      await f.create().request();
      expect(f.ports.checkMpe).toHaveBeenCalledTimes(mpe ? 1 : 0);
      expect(f.ports.checkDesktop).toHaveBeenCalledTimes(desktop ? 1 : 0);
      expect(f.installed).toEqual([]);
      expect(f.s.environment.version).toBe("2.0.0");
    },
  );

  it("checks both targets once per 24 hours across launcher restarts", async () => {
    const f = fixture();
    const updates = f.create();
    await updates.request();
    expect(f.installed).toEqual(["mpe:2.0.1"]);
    f.advance(CHECK_INTERVAL - 1000);
    await f.create(f.restart()).request();
    expect(f.ports.checkMpe).toHaveBeenCalledTimes(1);
    expect(f.ports.checkDesktop).toHaveBeenCalledTimes(1);
    f.advance(1000);
    await f.create(f.restart()).request();
    expect(f.ports.checkMpe).toHaveBeenCalledTimes(2);
    expect(f.ports.checkDesktop).toHaveBeenCalledTimes(2);
    expect(f.installed).toEqual(["mpe:2.0.1"]);
    expect(f.ports.checkMpe).toHaveBeenCalledWith(false);
  });

  it("permits editor launch during both checks and defers installation until editing ends", async () => {
    const f = fixture();
    const mpe = deferred<VersionList>();
    const desktop = deferred<boolean>();
    f.ports.checkMpe.mockReturnValueOnce(mpe.promise);
    f.ports.checkDesktop.mockReturnValueOnce(desktop.promise);
    const updates = f.create();
    const checking = updates.request();
    // An unrelated operation can acquire the same gate while networking is pending.
    await f.ports.run(async () => {
      f.s.running = true;
    });
    expect(f.s.running).toBe(true);
    mpe.resolve(f.list());
    desktop.resolve(true);
    await checking;
    expect(f.installed).toEqual([]);
    f.s.running = false;
    f.ports.checkDesktop.mockResolvedValue(true);
    await updates.request();
    expect(f.installed).toEqual(["desktop", "mpe:2.0.1"]);
    expect(f.ports.checkMpe).toHaveBeenCalledTimes(1);
    expect(f.ports.checkDesktop.mock.calls).toEqual([[false], [true]]);
  });

  it("persists failed-first-check cooldowns and stale cache without installing", async () => {
    const f = fixture();
    f.ports.checkMpe.mockResolvedValue(f.list({ stale: true, cached: true }));
    f.ports.checkDesktop.mockRejectedValue(new Error("offline"));
    await f.create().request();
    f.advance(FAILURE_COOLDOWN - 1);
    await f.create(f.restart()).request();
    expect(f.ports.checkMpe).toHaveBeenCalledTimes(1);
    expect(f.ports.checkDesktop).toHaveBeenCalledTimes(1);
    expect(f.installed).toEqual([]);
    f.advance(1);
    f.ports.checkMpe.mockImplementation(async () => f.list());
    f.ports.checkDesktop.mockResolvedValue(false);
    await f.create(f.restart()).request();
    expect(f.installed).toEqual(["mpe:2.0.1"]);
    expect(f.ports.checkDesktop).toHaveBeenCalledTimes(2);
  });

  it("rechecks only the newly enabled target immediately", async () => {
    const f = fixture();
    const updates = f.create();
    await updates.request();
    await updates.request("desktop", true);
    expect(f.ports.checkDesktop).toHaveBeenCalledTimes(2);
    expect(f.ports.checkMpe).toHaveBeenCalledTimes(1);
    await updates.request("mpe", true);
    expect(f.ports.checkMpe.mock.calls).toEqual([[false], [true]]);
  });

  it.each(["running", "service", "fixed", "disabled", "install-disabled"])(
    "rechecks current state before installation: %s",
    async (change) => {
      const f = fixture();
      const response = deferred<VersionList>();
      f.ports.checkMpe.mockReturnValueOnce(response.promise);
      const checking = f.create().request();
      if (change === "running") f.s.running = true;
      if (change === "service") f.s.service.state = "running";
      if (change === "fixed") f.s.settings.fixedVersion = "2.0.0";
      if (change === "disabled") f.s.settings.autoCheckMpe = false;
      if (change === "install-disabled") f.s.settings.autoInstallMpe = false;
      response.resolve(f.list());
      await checking;
      expect(f.installed).toEqual([]);
    },
  );

  it("resumes an installation deferred by another operation without another network check", async () => {
    const f = fixture();
    f.setBusy(true);
    const updates = f.create();
    await updates.request();
    expect(f.installed).toEqual([]);
    f.setBusy(false);
    updates.resume();
    await updates.request();
    expect(f.installed).toEqual(["mpe:2.0.1"]);
    expect(f.ports.checkMpe).toHaveBeenCalledTimes(1);
  });

  it("checks the live session again after acquiring the frontend operation gate", async () => {
    const f = fixture();
    f.ports.checkDesktop.mockResolvedValue(true);
    f.ports.refresh.mockImplementationOnce(async () => {
      f.s.running = true;
      return f.s;
    });
    await f.create().request();
    expect(f.installed).toEqual([]);
    expect(f.history.desktop).toBe(true);
    expect(f.history.mpe?.versions).toEqual(["2.0.1"]);
  });

  it("keeps expired cached update candidates read-only when only the other target is checked", async () => {
    const f = fixture();
    f.history.recordMpe(f.list());
    f.advance(CHECK_INTERVAL);
    await f.create().request("desktop");
    expect(f.installed).toEqual([]);
    expect(f.history.mpe?.versions).toEqual(["2.0.1"]);
  });

  it("ignores an earlier background result after a manual check supersedes it", async () => {
    const f = fixture();
    const response = deferred<VersionList>();
    f.ports.checkMpe.mockReturnValueOnce(response.promise);
    const updates = f.create();
    const checking = updates.request();
    updates.supersede("mpe");
    f.history.recordMpe(f.list({ versions: ["2.0.2"] }));
    response.resolve(f.list());
    await checking;
    expect(f.history.mpe?.versions).toEqual(["2.0.2"]);
    expect(f.ports.onMpe).not.toHaveBeenCalled();
    expect(f.installed).toEqual([]);
  });

  it("stops the installation chain after cancellation and preserves cooldown across restart", async () => {
    const f = fixture();
    f.ports.checkDesktop.mockResolvedValue(true);
    f.ports.installDesktop.mockResolvedValue(UPDATE_CANCELLED);
    await f.create().request();
    await f.create(f.restart()).request();
    expect(f.installed).toEqual([]);
    expect(f.ports.installDesktop).toHaveBeenCalledTimes(1);
    expect(f.ports.installMpe).not.toHaveBeenCalled();
  });

  it("continues MPE installation after a Desktop failure without retrying Desktop immediately", async () => {
    const f = fixture();
    f.ports.checkDesktop.mockResolvedValue(true);
    f.ports.installDesktop.mockRejectedValue(new Error("download failed"));
    const updates = f.create();
    await updates.request();
    await updates.request();
    expect(f.installed).toEqual(["mpe:2.0.1"]);
    expect(f.ports.installDesktop).toHaveBeenCalledTimes(1);
  });

  it("restores a known Desktop update in the background after restarting", async () => {
    const f = fixture();
    f.history.recordDesktop(true);
    f.history.recordMpe(f.list({ versions: ["2.0.0"] }));
    const response = deferred<boolean>();
    const started = deferred<void>();
    f.ports.checkDesktop.mockImplementationOnce(() => {
      started.resolve();
      return response.promise;
    });
    const updates = f.create(f.restart());
    const checking = updates.request();
    await started.promise;
    await f.ports.run(async () => {
      f.s.running = true;
    });
    response.resolve(true);
    await checking;
    expect(f.installed).toEqual([]);
    expect(f.ports.checkDesktop.mock.calls).toEqual([[true]]);
  });

  it("does not install after disposal while a network response is pending", async () => {
    const f = fixture();
    const response = deferred<VersionList>();
    f.ports.checkMpe.mockReturnValueOnce(response.promise);
    const updates = f.create();
    const checking = updates.request();
    updates.stop();
    response.resolve(f.list());
    await checking;
    expect(f.installed).toEqual([]);
    expect(f.history.mpe).toBeUndefined();
  });
});

describe("update history recovery", () => {
  it("recovers from damaged storage and clock rollback", () => {
    const f = fixture();
    f.history.recordMpe(f.list());
    f.history.recordDesktop(false);
    f.advance(-1);
    const restarted = f.restart();
    expect(restarted.due("mpe")).toBe(true);
    expect(restarted.due("desktop")).toBe(true);
    f.data.forEach((_value, key) => f.data.set(key, "{invalid"));
    expect(f.restart().due("mpe")).toBe(true);
  });
  it("invalidates Desktop history after upgrading the host", () => {
    const f = fixture();
    f.history.recordDesktop(true);
    const restarted = f.restart();
    restarted.setRevision("2.0.3");
    expect(restarted.desktop).toBeUndefined();
    expect(restarted.due("desktop")).toBe(true);
  });
});
