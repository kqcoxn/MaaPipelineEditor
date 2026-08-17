import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  configDefaults,
  getExportableConfigs,
  initializeConfigCache,
  useConfigStore,
} from "@/stores/app/configStore";

beforeEach(() => {
  localStorage.clear();
  useConfigStore.getState().resetAllConfigs();
});

describe("config cache", () => {
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
