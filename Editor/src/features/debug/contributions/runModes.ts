import uiT from "../../../i18n/translate";
import { debugContributionRegistry } from "./registry";
import type { DebugRunMode } from "../types";

const initialRunModes: Array<{
  id: DebugRunMode;
  label: string;
  description: string;
}> = [
  {
    id: "run-from-node",
    label: uiT("ui.debug.runMode.runFromNode.label", "从节点运行"),
    description: uiT(
      "ui.debug.runMode.runFromNode.description",
      "以选中节点作为入口运行后续 pipeline。",
    ),
  },
  {
    id: "single-node-run",
    label: uiT("ui.debug.runMode.singleNodeRun.label", "单节点运行"),
    description: uiT(
      "ui.debug.runMode.singleNodeRun.description",
      "对选中节点执行一次识别与动作组合。",
    ),
  },
  {
    id: "recognition-only",
    label: uiT("ui.debug.runMode.recognitionOnly.label", "仅测试识别"),
    description: uiT(
      "ui.debug.runMode.recognitionOnly.description",
      "只验证选中节点的识别逻辑。",
    ),
  },
  {
    id: "action-only",
    label: uiT("ui.debug.runMode.actionOnly.label", "仅执行动作"),
    description: uiT(
      "ui.debug.runMode.actionOnly.description",
      "跳过识别，直接执行选中节点的动作。",
    ),
  },
];

export function registerDebugRunModes(): void {
  initialRunModes.forEach((runMode) => {
    debugContributionRegistry.registerRunMode({
      ...runMode,
      p0Available: false,
    });
  });
}

registerDebugRunModes();
