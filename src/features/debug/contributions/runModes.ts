import { debugContributionRegistry } from "./registry";
import type { DebugRunMode } from "../types";

const initialRunModes: Array<{
  id: DebugRunMode;
  label: string;
  description: string;
}> = [
  {
    id: "full-run",
    label: "完整运行",
    description: "从 profile 入口运行完整 pipeline。",
  },
  {
    id: "run-from-node",
    label: "从节点运行",
    description: "以选中节点作为入口运行后续 pipeline。",
  },
  {
    id: "single-node-run",
    label: "单节点运行",
    description: "对选中节点执行一次识别与动作组合。",
  },
  {
    id: "recognition-only",
    label: "仅测试识别",
    description: "只验证选中节点的识别逻辑。",
  },
  {
    id: "action-only",
    label: "仅执行动作",
    description: "跳过识别，直接执行选中节点的动作。",
  },
  {
    id: "fixed-image-recognition",
    label: "固定图识别",
    description: "使用已选择的静态图片测试节点识别。",
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
