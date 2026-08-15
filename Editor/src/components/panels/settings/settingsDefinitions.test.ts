import { describe, expect, it } from "vitest";
import { getProviderOptions } from "@/utils/ai/providers";
import { settingsDefinitions, settingsTabs } from "./settingsDefinitions";

describe("AI settings", () => {
  it("exposes the persisted AI configuration fields", () => {
    const aiItems = settingsDefinitions.filter((item) => item.category === "ai");
    const aiKeys = aiItems.map((item) => item.key);

    expect(settingsTabs).toContainEqual({
      key: "ai",
      label: "AI",
      icon: "RobotOutlined",
    });
    expect(aiKeys).toEqual([
      "aiProviderType",
      "aiApiUrl",
      "aiApiKey",
      "aiModel",
      "aiTemperature",
      "aiUseProxy",
      "__testConnection",
    ]);

    const providerItem = aiItems.find((item) => item.key === "aiProviderType");
    expect(providerItem?.options).toEqual(getProviderOptions());
  });
});
