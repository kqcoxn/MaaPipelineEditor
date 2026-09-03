import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  configDefaults,
  DEFAULT_LIVE_SCREEN_FRAME_RATE,
  DEFAULT_AI_REQUEST_TIMEOUT_MINUTES,
  DEFAULT_AI_TOOL_CALL_BUDGET,
  DEFAULT_AI_CONTEXT_COMPACTION_THRESHOLD,
  getExportableConfigs,
  getLiveScreenFrameInterval,
  initializeConfigCache,
  useConfigStore,
} from "@/stores/app/configStore";

beforeEach(() => {
  localStorage.clear();
  useConfigStore.getState().resetAllConfigs();
});

describe("config cache", () => {
  it("shows node shadows by default", () => {
    expect(configDefaults.showNodeShadows).toBe(true);
  });

  it("enables canvas motion pausing by default", () => {
    expect(configDefaults.enableCanvasMotionPause).toBe(true);
    expect(useConfigStore.getState().configs.enableCanvasMotionPause).toBe(true);
  });

  it("defaults the live screen to 15 frames per second", () => {
    expect(configDefaults.liveScreenRefreshRate).toBe(
      DEFAULT_LIVE_SCREEN_FRAME_RATE,
    );
    expect(getLiveScreenFrameInterval(15)).toBeCloseTo(1000 / 15);
  });

  it("bounds invalid live screen frame rates", () => {
    expect(getLiveScreenFrameInterval(0)).toBeCloseTo(1000 / 15);
    expect(getLiveScreenFrameInterval(60)).toBeCloseTo(1000 / 60);
    expect(getLiveScreenFrameInterval(61)).toBeCloseTo(1000 / 15);
    expect(getLiveScreenFrameInterval(Number.NaN)).toBeCloseTo(1000 / 15);
  });

  it("resets the legacy millisecond refresh value to 15 fps", () => {
    localStorage.setItem(
      "_mpe_config",
      JSON.stringify({ liveScreenRefreshRate: 1000 }),
    );

    const unsubscribe = initializeConfigCache();

    expect(useConfigStore.getState().configs.liveScreenRefreshRate).toBe(15);
    unsubscribe();
  });

  it("defaults the Harness context compaction threshold to 200k", () => {
    expect(configDefaults.aiContextCompactionThreshold).toBe(
      DEFAULT_AI_CONTEXT_COMPACTION_THRESHOLD,
    );
    expect(
      useConfigStore.getState().configs.aiContextCompactionThreshold,
    ).toBe(200_000);
  });

  it("defaults the Harness tool call budget to 50", () => {
    expect(configDefaults.aiToolCallBudget).toBe(DEFAULT_AI_TOOL_CALL_BUDGET);
    expect(useConfigStore.getState().configs.aiToolCallBudget).toBe(50);
  });

  it("defaults each AI request timeout to 10 minutes", () => {
    expect(configDefaults.aiRequestTimeoutMinutes).toBe(
      DEFAULT_AI_REQUEST_TIMEOUT_MINUTES,
    );
    expect(useConfigStore.getState().configs.aiRequestTimeoutMinutes).toBe(10);
  });

  it("restores cached global configs during initialization", () => {
    localStorage.setItem(
      "_mpe_config",
      JSON.stringify({
        configHandlingMode: "separated",
        jsonIndent: 2,
        __configuredKeys: ["configHandlingMode", "jsonIndent"],
      }),
    );

    const unsubscribe = initializeConfigCache();

    expect(useConfigStore.getState().configs.configHandlingMode).toBe(
      "separated",
    );
    expect(useConfigStore.getState().configs.jsonIndent).toBe(2);
    expect(useConfigStore.getState().configuredKeys).toEqual(
      new Set(["configHandlingMode", "jsonIndent"]),
    );

    unsubscribe();
  });

  it("persists config changes after initialization", () => {
    const unsubscribe = initializeConfigCache();

    useConfigStore.getState().setConfig("jsonIndent", 2);

    expect(JSON.parse(localStorage.getItem("_mpe_config") ?? "{}")).toMatchObject(
      {
        jsonIndent: 2,
        __configuredKeys: expect.arrayContaining(["jsonIndent"]),
      },
    );

    unsubscribe();
  });

  it("stops persisting config changes after cleanup", () => {
    const unsubscribe = initializeConfigCache();
    useConfigStore.getState().setConfig("jsonIndent", 2);
    const cachedConfig = localStorage.getItem("_mpe_config");

    unsubscribe();
    useConfigStore.getState().setConfig("jsonIndent", 8);

    expect(localStorage.getItem("_mpe_config")).toBe(cachedConfig);
  });

  it("keeps subscribing when restoring a malformed cache fails", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    localStorage.setItem("_mpe_config", "invalid-json");

    const unsubscribe = initializeConfigCache();
    useConfigStore.getState().setConfig("jsonIndent", 2);

    expect(consoleError).toHaveBeenCalledOnce();
    expect(JSON.parse(localStorage.getItem("_mpe_config") ?? "{}")).toMatchObject(
      { jsonIndent: 2 },
    );

    unsubscribe();
    consoleError.mockRestore();
  });
});

describe("config export", () => {
  it("exports the node shadow preference", () => {
    const configs = {
      ...configDefaults,
      showNodeShadows: false,
    };

    expect(getExportableConfigs(configs).showNodeShadows).toBe(false);
  });

  it("exports the canvas motion pause preference", () => {
    const configs = {
      ...configDefaults,
      enableCanvasMotionPause: false,
    };

    expect(getExportableConfigs(configs).enableCanvasMotionPause).toBe(false);
  });

  it("does not include the AI API key", () => {
    const configs = {
      ...configDefaults,
      aiApiKey: "ENC:secret",
    };

    const exported = getExportableConfigs(configs);
    expect(exported).not.toHaveProperty("aiApiKey");
    expect(exported.aiApiUrl).toBe(configs.aiApiUrl);
  });

  it("ignores an unencrypted AI API key during config replacement", () => {
    useConfigStore.getState().resetAllConfigs();
    useConfigStore.getState().replaceConfig({ aiApiKey: "plain-key" });

    expect(useConfigStore.getState().configs.aiApiKey).toBe("");
  });
});
