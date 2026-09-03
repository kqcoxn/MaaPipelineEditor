import { describe, expect, it } from "vitest";
import { getProviderOptions } from "@/utils/ai/providers";
import { settingsDefinitions, settingsTabs } from "./settingsDefinitions";

describe("node settings", () => {
  it("exposes the node shadow switch", () => {
    const nodeShadowItem = settingsDefinitions.find(
      (item) => item.key === "showNodeShadows",
    );

    expect(nodeShadowItem).toMatchObject({
      category: "node",
      type: "switch",
      checkedChildren: "显示",
      unCheckedChildren: "关闭",
    });
  });
});

describe("canvas settings", () => {
  it("exposes the canvas motion pause switch", () => {
    const motionPauseItem = settingsDefinitions.find(
      (item) => item.key === "enableCanvasMotionPause",
    );

    expect(motionPauseItem).toMatchObject({
      category: "canvas",
      type: "switch",
      checkedChildren: "开启",
      unCheckedChildren: "关闭",
    });
  });
});

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
      "aiContextCompactionThreshold",
      "aiToolCallBudget",
      "aiRequestTimeoutMinutes",
      "__testConnection",
    ]);

    const providerItem = aiItems.find((item) => item.key === "aiProviderType");
    expect(providerItem?.options).toEqual(getProviderOptions());

    const compactionThresholdItem = aiItems.find(
      (item) => item.key === "aiContextCompactionThreshold",
    );
    expect(compactionThresholdItem).toMatchObject({
      type: "inputNumber",
      min: 1_000,
      max: 2_000_000,
      step: 10_000,
      addonAfter: "tokens",
    });

    const toolCallBudgetItem = aiItems.find(
      (item) => item.key === "aiToolCallBudget",
    );
    expect(toolCallBudgetItem).toMatchObject({
      type: "inputNumber",
      min: 1,
      max: 200,
      step: 1,
      addonAfter: "次",
    });

    const requestTimeoutItem = aiItems.find(
      (item) => item.key === "aiRequestTimeoutMinutes",
    );
    expect(requestTimeoutItem).toMatchObject({
      type: "inputNumber",
      min: 1,
      max: 120,
      step: 1,
      addonAfter: "分钟",
    });
  });
});

describe("live screen settings", () => {
  it("uses frames per second for the refresh rate", () => {
    const frameRateItem = settingsDefinitions.find(
      (item) => item.key === "liveScreenRefreshRate",
    );

    expect(frameRateItem).toMatchObject({
      label: "画面刷新率",
      min: 1,
      max: 60,
      step: 1,
      addonAfter: "帧（张/秒）",
    });
  });
});
