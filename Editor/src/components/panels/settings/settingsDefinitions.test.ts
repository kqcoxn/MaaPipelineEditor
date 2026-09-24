import { describe, expect, it } from "vitest";
import { getProviderOptions } from "@/utils/ai/providers";
import { settingsDefinitions } from "./settingsDefinitions";

describe("AI settings", () => {
  it("declares supported providers and AI input bounds", () => {
    const providerItem = settingsDefinitions.find((item) => item.key === "aiProviderType");
    expect(providerItem?.options).toEqual(getProviderOptions());

    const compactionThresholdItem = settingsDefinitions.find(
      (item) => item.key === "aiContextCompactionThreshold",
    );
    expect(compactionThresholdItem).toMatchObject({
      min: 1_000,
      max: 2_000_000,
    });

    const toolCallBudgetItem = settingsDefinitions.find(
      (item) => item.key === "aiToolCallBudget",
    );
    expect(toolCallBudgetItem).toMatchObject({
      min: 1,
      max: 200,
    });

    const requestTimeoutItem = settingsDefinitions.find(
      (item) => item.key === "aiRequestTimeoutMinutes",
    );
    expect(requestTimeoutItem).toMatchObject({
      min: 1,
      max: 120,
    });
  });
});

describe("live screen settings", () => {
  it("bounds the configurable frame rate", () => {
    const frameRateItem = settingsDefinitions.find(
      (item) => item.key === "liveScreenRefreshRate",
    );

    expect(frameRateItem).toMatchObject({
      min: 1,
      max: 60,
    });
  });
});
