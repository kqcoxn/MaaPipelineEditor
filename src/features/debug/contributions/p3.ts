import { debugContributionRegistry } from "./registry";
import type { DebugModalPanel } from "../types";

const modalPanels: Array<{ id: DebugModalPanel; label: string }> = [
  { id: "overview", label: "总览" },
  { id: "profile", label: "Profile" },
  { id: "resources", label: "资源" },
  { id: "controller", label: "控制器" },
  { id: "agent", label: "Agent" },
  { id: "nodes", label: "节点" },
  { id: "timeline", label: "时间线" },
  { id: "images", label: "图像" },
  { id: "diagnostics", label: "诊断" },
  { id: "logs", label: "日志" },
];

export function registerDebugP3Contributions(): void {
  modalPanels.forEach((panel, index) => {
    debugContributionRegistry.registerModalPanel({
      ...panel,
      order: index,
    });
  });

  debugContributionRegistry.registerArtifactViewer({
    id: "json-detail",
    label: "JSON Detail",
    mimePrefix: "application/json",
  });
  debugContributionRegistry.registerArtifactViewer({
    id: "image-preview",
    label: "Image Preview",
    mimePrefix: "image/",
  });

  debugContributionRegistry.registerCanvasOverlay({
    id: "runtime-node-state",
    label: "当前节点与执行结果",
  });
  debugContributionRegistry.registerCanvasOverlay({
    id: "runtime-path",
    label: "已执行路径",
  });

  debugContributionRegistry.registerNodeDebugAction({
    id: "run-from-node",
    label: "从此节点运行",
    runMode: "run-from-node",
  });
}

registerDebugP3Contributions();
