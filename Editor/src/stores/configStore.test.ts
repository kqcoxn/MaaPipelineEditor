import { describe, expect, it } from "vitest";
import {
  configDefaults,
  getExportableConfigs,
  useConfigStore,
} from "./configStore";

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
