import { describe, expect, it } from "vitest";

import type { DebugCapabilityManifest } from "@/features/debug/types";
import { createPipelineNode } from "@/stores/flow";
import {
  getNodeContextMenuConfig,
  type NodeContextMenuItem,
} from "./nodeContextMenu";

const debugRunItemKeys = [
  "debug-run-from-node",
  "debug-single-node-run",
  "debug-recognition-only",
  "debug-action-only",
] as const;

function getDebugRunItems(capabilities?: DebugCapabilityManifest) {
  const node = createPipelineNode("context-node", { label: "Context" });
  const config = getNodeContextMenuConfig(node, {
    debugCapabilities: capabilities,
  });

  return debugRunItemKeys.map((key) => {
    const item = config.find((candidate) => candidate.key === key);
    expect(item).toBeDefined();
    return item as NodeContextMenuItem;
  });
}

function isDisabled(item: NodeContextMenuItem): boolean {
  const node = createPipelineNode("context-node", { label: "Context" });
  return typeof item.disabled === "function"
    ? item.disabled(node)
    : Boolean(item.disabled);
}

function createCapabilities(
  runModes: DebugCapabilityManifest["runModes"],
): DebugCapabilityManifest {
  return {
    generation: "vnext",
    runModes,
    diagnostics: [],
    artifacts: [],
    screenshotSources: [],
    profileFeatures: [],
    maa: {
      mfwVersion: "test",
      supportedControllers: [],
      supportedTaskerApis: [],
      supportedResourceApis: [],
      supportedAgentTransports: [],
    },
  };
}

describe("getNodeContextMenuConfig", () => {
  it("调试能力尚未加载时允许点击运行项，由运行请求触发按需加载", () => {
    expect(getDebugRunItems().map(isDisabled)).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });

  it("调试能力已加载时禁用服务端未声明支持的运行项", () => {
    const items = getDebugRunItems(createCapabilities(["run-from-node"]));

    expect(items.map(isDisabled)).toEqual([false, true, true, true]);
  });
});
