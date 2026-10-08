import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import {
  automaticUpdateBlock,
  runAutomaticUpdates,
  updateEnvironment,
} from "./automaticUpdate";
import type { Snapshot, VersionList } from "../types";
import { installEnvironment } from "./environmentInstall";

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
  desktopRevision: "2.0.2",
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
      return { ...snapshot().environment, version: input.version };
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
      "发现前后端更新：MPE 2.0.0 → 2.0.1（Editor + LB），正在下载并更新",
      "MPE 已更新至 2.0.1",
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

  it("replaces an automatic-update error throughout a manual retry", async () => {
    let status = "";
    let notice = "";
    let kind: string | undefined;
    const onStatus = (value: string) => { status = value; };
    const onNotice = (value: string, nextKind?: string) => {
      notice = value;
      kind = nextKind;
    };
    vi.mocked(invoke)
      .mockResolvedValueOnce(result())
      .mockRejectedValueOnce(new Error("request timed out"));
    await expect(updateEnvironment(snapshot(), () => {}, onStatus, onNotice))
      .rejects.toThrow("request timed out");
    expect(status).toContain("更新失败");
    expect(kind).toBe("error");

    let finish!: (value: Snapshot["environment"]) => void;
    vi.mocked(invoke).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const pending = installEnvironment("latest", onStatus, onNotice);
    expect(status).toBe("正在下载并安装 MPE");
    expect(notice).toBe(status);
    expect(kind).toBe("pending");
    finish({ ...snapshot().environment, version: "2.0.1" });
    await pending;
    expect(status).toBe("MPE 已更新至 2.0.1");
    expect(notice).toContain("Editor 与 LB 已更新至 MPE 2.0.1");
    expect(kind).toBe("success");

    vi.mocked(invoke).mockResolvedValueOnce({
      ...snapshot().environment, ready: false, problems: ["Editor 版本不匹配"],
    });
    await expect(installEnvironment("latest", onStatus, onNotice))
      .rejects.toThrow("Editor 版本不匹配");
    expect(status).toContain("更新失败");
    expect(notice).toBe(status);
    expect(kind).toBe("error");
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
    ).toBe("MPE 已是最新可用版本");
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
      ...(desktop ? ["desktop"] : []),
      ...(mpe ? ["mpe"] : []),
    ]);
  });
  it("checks MPE after Desktop failure", async () => {
    const completed: string[] = [];
    const environment = async () => {
      completed.push("mpe");
    };
    const desktop = async () => {
      completed.push("desktop");
      throw new Error("download failed");
    };
    await expect(
      runAutomaticUpdates(snapshot(), environment, desktop),
    ).rejects.toThrow("download failed");
    expect(completed).toEqual(["desktop", "mpe"]);
  });
  it.each(["mpe", "desktop"] as const)("only checks the requested %s target", async (target) => {
    const completed: string[] = [];
    await runAutomaticUpdates(
      snapshot(),
      async () => { completed.push("mpe"); },
      async () => { completed.push("desktop"); },
      target,
    );
    expect(completed).toEqual([target]);
  });
  it("waits for Desktop to finish before checking and installing MPE", async () => {
    let finish!: () => void;
    const desktop = new Promise<void>(resolve => { finish = resolve; });
    const installed: string[] = [];
    vi.mocked(invoke).mockReset();
    vi.mocked(invoke).mockImplementation(async (command, args) => {
      if (command === "release_versions") return result();
      const { version } = args as { version: string };
      installed.push(version);
      return { ...snapshot().environment, version };
    });
    const pending = runAutomaticUpdates(
      snapshot(),
      () => updateEnvironment(snapshot(), () => {}, () => {}),
      () => desktop,
    );
    await Promise.resolve();
    expect(invoke).not.toHaveBeenCalled();
    finish();
    await pending;
    expect(installed).toEqual(["2.0.1"]);
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

describe("cancelling version checks", () => {
  it("reports cancelled installation without success or failure and allows retry", async () => {
    vi.mocked(invoke).mockReset();
    vi.mocked(invoke).mockResolvedValueOnce({ cancelled: true });
    const statuses: string[] = [];
    const notices: Array<[string, string | undefined]> = [];
    const status = (value: string) => { statuses.push(value); };
    const notice = (value: string, kind?: string) => { notices.push([value, kind]); };
    expect(await installEnvironment("2.0.1", status, notice)).toBeUndefined();
    expect(statuses.at(-1)).toBe("已取消更新，可启动当前版本");
    expect(notices.map(([, kind]) => kind)).toEqual(["pending", "info"]);
    vi.mocked(invoke).mockResolvedValueOnce({ ...snapshot().environment, version: "2.0.1" });
    expect((await installEnvironment("2.0.1", status, notice))?.version).toBe("2.0.1");
    expect(notices.at(-1)?.[1]).toBe("success");
  });

  it("ends an automatic environment update normally after cancelling download", async () => {
    vi.mocked(invoke).mockReset();
    vi.mocked(invoke).mockResolvedValueOnce(result()).mockResolvedValueOnce({ cancelled: true });
    expect(await updateEnvironment(snapshot(), () => {}, () => {}))
      .toBe("已取消更新，可启动当前版本");
  });

  it("releases the wait and ignores a late version response without installing", async () => {
    let finish!: (value: VersionList) => void;
    vi.mocked(invoke).mockReset();
    vi.mocked(invoke).mockReturnValue(new Promise<VersionList>(resolve => { finish = resolve; }));
    const controller = new AbortController();
    const versions = vi.fn();
    const pending = updateEnvironment(snapshot(), versions, vi.fn(), vi.fn(), true,
      { signal: controller.signal, complete: vi.fn() });
    controller.abort();
    expect(await pending).toContain("已取消检测");
    finish(result());
    await Promise.resolve();
    expect(versions).not.toHaveBeenCalled();
    expect(vi.mocked(invoke).mock.calls.map(([command]) => command)).toEqual(["release_versions"]);
  });

  it("does not start either check when already cancelled", async () => {
    const environment = vi.fn();
    const desktop = vi.fn();
    await runAutomaticUpdates(snapshot(), environment, desktop, "all", () => true);
    expect(desktop).not.toHaveBeenCalled();
    expect(environment).not.toHaveBeenCalled();
  });

  it("does not continue to MPE updates after cancelling the Desktop check", async () => {
    let cancelled = false;
    const environment = vi.fn();
    await runAutomaticUpdates(
      snapshot(), environment, async () => { cancelled = true; },
      "all", () => cancelled,
    );
    expect(environment).not.toHaveBeenCalled();
  });
});
