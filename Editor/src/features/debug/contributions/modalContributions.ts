import uiT from "../../../i18n/translate";
import { debugContributionRegistry } from "./registry";
import type { DebugModalPanel } from "../types";

const modalPanels: Array<{ id: DebugModalPanel; label: string }> = [
  { id: "overview", label: uiT("ui.debug.modal.panel.overview", "中控台") },
  { id: "node-execution", label: uiT("ui.debug.modal.panel.nodeExecution", "节点线") },
  { id: "debug-log", label: uiT("ui.debug.modal.panel.debugLog", "调试日志") },
  { id: "ai-summary", label: uiT("ui.debug.modal.panel.aiSummary", "AI 总结") },
  {
    id: "resource-health",
    label: uiT("ui.debug.modal.panel.resourceHealth", "资源体检"),
  },
  { id: "setup", label: uiT("ui.debug.modal.panel.setup", "运行配置") },
];

export function registerDebugModalContributions(): void {
  modalPanels.forEach((panelItem, index) => {
    debugContributionRegistry.registerModalPanel({
      ...panelItem,
      order: index,
    });
  });

  debugContributionRegistry.registerArtifactViewer({
    id: "json-detail",
    label: uiT("ui.debug.modal.artifact.jsonDetail", "JSON 详情"),
    mimePrefix: "application/json",
  });
  debugContributionRegistry.registerArtifactViewer({
    id: "image-preview",
    label: uiT("ui.debug.modal.artifact.imagePreview", "图像预览"),
    mimePrefix: "image/",
  });

  debugContributionRegistry.registerCanvasOverlay({
    id: "runtime-node-state",
    label: uiT("ui.debug.modal.overlay.runtimeNodeState", "当前节点与执行结果"),
  });
  debugContributionRegistry.registerCanvasOverlay({
    id: "runtime-path",
    label: uiT("ui.debug.modal.overlay.runtimePath", "已执行路径"),
  });

  debugContributionRegistry.registerNodeDebugAction({
    id: "run-from-node",
    label: uiT("ui.debug.modal.action.runFromNode", "从此节点运行"),
    runMode: "run-from-node",
  });
  debugContributionRegistry.registerNodeDebugAction({
    id: "single-node-run",
    label: uiT("ui.debug.modal.action.singleNodeRun", "单节点运行"),
    runMode: "single-node-run",
  });
  debugContributionRegistry.registerNodeDebugAction({
    id: "recognition-only",
    label: uiT("ui.debug.modal.action.recognitionOnly", "仅识别"),
    runMode: "recognition-only",
  });
  debugContributionRegistry.registerNodeDebugAction({
    id: "action-only",
    label: uiT("ui.debug.modal.action.actionOnly", "仅动作"),
    runMode: "action-only",
  });
}

registerDebugModalContributions();
