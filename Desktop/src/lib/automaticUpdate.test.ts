import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import {
  automaticUpdateBlock,
  runAutomaticUpdates,
  updateEnvironment,
} from "./automaticUpdate";
import type { Snapshot, VersionList } from "../types";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
const snapshot = (): Snapshot => ({
  settings: {
    autoCheckMpe: true,
    autoInstallMpe: true,
    autoUpdateDesktop: true,
    onboardingDone: true,
    fixedVersion: null,
  } as Snapshot["settings"],
  environment: { ready: true, version: "2.0.0", directory: "", problems: [] },
  service: { id: "", state: "stopped", root: "" },
  running: false,
  busy: false,
  desktopVersion: "2.0.0",
  desktopRevision: 1,
});
const result = (patch: Partial<VersionList> = {}): VersionList => ({
  versions: ["2.0.1"],
  cached: false,
  stale: false,
  source: "static",
  checkedAt: 100,
  warning: null,
  ...patch,
});

describe("automatic environment updates", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  it("discovers a release even when the existing cache is fresh, then installs it", async () => {
    const installed: string[] = [];
    vi.mocked(invoke).mockImplementation(async (command, args) => {
      const input = args as Record<string, unknown>;
      if (command === "release_versions")
        return result({ versions: input.force ? ["2.0.1"] : ["2.0.0"] });
      installed.push(String(input.version));
    });
    const statuses: string[] = [];
    const notices: string[] = [];
    const kinds: Array<string | undefined> = [];
    const summary = await updateEnvironment(
      snapshot(),
      () => {},
      (value) => statuses.push(value),
      (value, kind) => {
        notices.push(value);
        kinds.push(kind);
      },
    );
    expect(summary).toBe("MPE 已更新至 2.0.1");
    expect(installed).toEqual(["2.0.1"]);
    expect(notices[0]).toContain("2.0.0 → 2.0.1（Editor + LB）");
    expect(notices.at(-1)).toContain("前后端更新完成");
    expect(kinds).toEqual(["pending", "success"]);
    expect(statuses).toEqual([
      "正在联网检查 MPE 更新",
      "发现 MPE 2.0.1，正在更新",
    ]);
  });

  it("keeps offline cache visible without installing its newer version", async () => {
    const cached = result({ cached: true, stale: true, warning: "offline" });
    vi.mocked(invoke).mockResolvedValueOnce(cached);
    const onVersions = vi.fn();
    const summary = await updateEnvironment(snapshot(), onVersions, () => {});
    expect(summary).toContain("联网检查失败");
    expect(summary).toContain("不自动安装");
    expect(onVersions).toHaveBeenCalledWith(cached);
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("reports current versions and lookup failures without a success message", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(
      result({
        versions: ["2.0.0"],
        warning: "GitHub Token 无效；已改用静态索引",
      }),
    );
    expect(
      await updateEnvironment(
        snapshot(),
        () => {},
        () => {},
      ),
    ).toBe("MPE 2.0.0 已是最新可用版本");
    vi.mocked(invoke).mockRejectedValueOnce(new Error("offline"));
    expect(
      await updateEnvironment(
        snapshot(),
        () => {},
        () => {},
      ),
    ).toContain("版本检查失败");
  });

  it("preserves fixed versions and reports installation failure before aborting", async () => {
    const fixed = snapshot();
    fixed.settings.fixedVersion = "2.0.0";
    vi.mocked(invoke).mockResolvedValueOnce(result());
    expect(
      await updateEnvironment(
        fixed,
        () => {},
        () => {},
      ),
    ).toContain("已固定为 2.0.0");
    expect(invoke).toHaveBeenCalledTimes(1);
    vi.mocked(invoke)
      .mockResolvedValueOnce(result())
      .mockRejectedValueOnce(new Error("checksum mismatch"));
    const statuses: string[] = [];
    await expect(
      updateEnvironment(
        snapshot(),
        () => {},
        (text) => statuses.push(text),
      ),
    ).rejects.toThrow("checksum mismatch");
    expect(statuses.at(-1)).toContain("更新失败");
  });

  it.each(["disabled", "first-run", "missing", "running"])(
    "loads the list and announces updates without installing when %s",
    async (mode) => {
      const state = snapshot();
      if (mode === "disabled") state.settings.autoInstallMpe = false;
      if (mode === "first-run") state.settings.onboardingDone = false;
      if (mode === "missing") state.environment.ready = false;
      if (mode === "running") state.running = true;
      const list = result();
      vi.mocked(invoke).mockResolvedValueOnce(list);
      const lists: VersionList[] = [];
      const notices: string[] = [];
      const kinds: Array<string | undefined> = [];
      const summary = await updateEnvironment(
        state,
        (value) => lists.push(value),
        () => {},
        (value, kind) => {
          notices.push(value);
          kinds.push(kind);
        },
      );
      expect(lists).toEqual([list]);
      expect(summary).toContain("发现前后端更新");
      expect(notices).toEqual([summary]);
      expect(kinds).toEqual(["action"]);
      expect(invoke).toHaveBeenCalledTimes(1);
    },
  );

  it("loads versions on first installation and leaves manual refresh read-only", async () => {
    vi.mocked(invoke).mockResolvedValue(result());
    const empty = snapshot();
    empty.environment.ready = false;
    empty.environment.version = "";
    const lists: VersionList[] = [];
    expect(
      await updateEnvironment(
        empty,
        (value) => lists.push(value),
        () => {},
      ),
    ).toContain("可安装 MPE 2.0.1");
    expect(lists[0].versions).toEqual(["2.0.1"]);
    const summary = await updateEnvironment(
      snapshot(),
      () => {},
      () => {},
      () => {},
      false,
    );
    expect(summary).toContain("可在环境管理中选择版本并安装");
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it("allows checks after enabling auto-update but blocks running sessions", () => {
    const state = snapshot();
    state.settings.autoInstallMpe = false;
    expect(automaticUpdateBlock(state)).toBe("MPE 自动安装已关闭");
    state.settings.autoInstallMpe = true;
    expect(automaticUpdateBlock(state)).toBeUndefined();
    state.running = true;
    expect(automaticUpdateBlock(state)).toContain("停止后检查");
    state.running = false;
    state.service.state = "running";
    expect(automaticUpdateBlock(state)).toContain("停止后检查");
  });
});

describe("independent update preferences", () => {
  it.each([
    [false, false],
    [false, true],
    [true, false],
    [true, true],
  ])("runs enabled checks (MPE %s, Desktop %s)", async (mpe, desktop) => {
    const state = snapshot();
    state.settings.autoCheckMpe = mpe;
    state.settings.autoUpdateDesktop = desktop;
    const completed: string[] = [];
    await runAutomaticUpdates(
      state,
      async () => {
        completed.push("mpe");
      },
      async () => {
        completed.push("desktop");
      },
    );
    expect(completed).toEqual([
      ...(mpe ? ["mpe"] : []),
      ...(desktop ? ["desktop"] : []),
    ]);
  });
  it("checks Desktop after MPE failure and targets newly enabled preferences only", async () => {
    const completed: string[] = [];
    const environment = async () => {
      throw new Error("download failed");
    };
    const desktop = async () => {
      completed.push("desktop");
    };
    await expect(
      runAutomaticUpdates(snapshot(), environment, desktop),
    ).rejects.toThrow("download failed");
    await runAutomaticUpdates(snapshot(), environment, desktop, "desktop");
    expect(completed).toEqual(["desktop", "desktop"]);
  });
  it("keeps MPE discovery during editing without updating Desktop", async () => {
    const state = snapshot();
    state.running = true;
    const completed: string[] = [];
    await runAutomaticUpdates(
      state,
      async () => {
        completed.push("mpe");
      },
      async () => {
        completed.push("desktop");
      },
    );
    expect(completed).toEqual(["mpe"]);
  });
});
