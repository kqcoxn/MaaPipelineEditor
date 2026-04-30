import type { DebugRunMode } from "./types";

const runModeLabels: Partial<Record<DebugRunMode, string>> = {
  "run-from-node": "从指定节点运行",
  "single-node-run": "只运行一个节点",
  "recognition-only": "只执行识别",
  "action-only": "只执行动作",
  "fixed-image-recognition": "固定图片识别",
  replay: "回放",
};

const debugFeatureLabels: Record<string, string> = {
  "trace-replay": "时间线回放",
  "performance-summary": "性能摘要",
  "batch-recognition": "批量图片识别",
  "agent-run-profile": "代理运行配置",
};

const diagnosticLabels: Record<string, string> = {
  preflight: "启动前检查",
  "resource-load": "资源加载诊断",
  "target-node": "目标节点检查",
  "fixed-image": "固定图输入检查",
  agent: "代理连接诊断",
  "agent-run-profile": "代理配置诊断",
  "batch-recognition": "批量识别诊断",
  "performance-summary": "性能摘要诊断",
  "trace-replay": "时间线回放诊断",
};

const artifactLabels: Record<string, string> = {
  "task-detail": "任务详情",
  "recognition-detail": "识别详情",
  "action-detail": "动作详情",
  screenshot: "截图",
  "screenshot/live": "实时截图",
  "performance-summary": "性能摘要",
  "batch-recognition-summary": "批量识别结果",
};

const screenshotSourceLabels: Record<string, string> = {
  manual: "手动截图",
  live: "实时截图",
  "recognition-input": "识别输入截图",
  "fixed-image": "固定图输入",
};

const profileFeatureLabels: Record<string, string> = {
  "multi-resource": "多资源路径",
  "multi-agent": "多代理配置",
  "agent-run-profile": "代理运行配置",
};

const controllerLabels: Record<string, string> = {
  adb: "安卓设备",
  win32: "Windows 窗口",
  dbg: "固定图片调试",
  replay: "回放控制器",
  record: "录制控制器",
};

const unavailableReasonLabels: Record<string, string> = {
  "go-binding-dbg-controller-missing": "当前 Go 绑定未提供该控制器",
};

const taskerApiLabels: Record<string, string> = {
  PostTask: "提交任务",
  PostRecognition: "提交识别",
  PostAction: "提交动作",
  PostStop: "停止任务",
};

const resourceApiLabels: Record<string, string> = {
  PostBundle: "加载资源包",
  OverridePipeline: "覆盖 Pipeline",
  OverrideNext: "覆盖节点后继",
  OverrideImage: "覆盖图像",
  GetNode: "读取节点定义",
  GetNodeJSON: "读取节点 JSON",
  GetNodeList: "读取节点列表",
};

const agentTransportLabels: Record<string, string> = {
  identifier: "标识符连接",
  tcp: "TCP 连接",
};

function fromLabels(value: string, labels: Record<string, string>): string {
  return labels[value] ?? value;
}

export function getRunModeLabel(mode: DebugRunMode): string {
  return runModeLabels[mode] ?? mode;
}

export function getDebugFeatureLabel(value: string): string {
  return fromLabels(value, debugFeatureLabels);
}

export function getDiagnosticCapabilityLabel(value: string): string {
  return fromLabels(value, diagnosticLabels);
}

export function getArtifactCapabilityLabel(value: string): string {
  return fromLabels(value, artifactLabels);
}

export function getScreenshotSourceLabel(value: string): string {
  return fromLabels(value, screenshotSourceLabels);
}

export function getProfileFeatureLabel(value: string): string {
  return fromLabels(value, profileFeatureLabels);
}

export function getControllerLabel(value: string): string {
  return fromLabels(value, controllerLabels);
}

export function getUnavailableReasonLabel(value: string): string {
  return fromLabels(value, unavailableReasonLabels);
}

export function getTaskerApiLabel(value: string): string {
  return fromLabels(value, taskerApiLabels);
}

export function getResourceApiLabel(value: string): string {
  return fromLabels(value, resourceApiLabels);
}

export function getAgentTransportLabel(value: string): string {
  return fromLabels(value, agentTransportLabels);
}

export function getDebugStatusLabel(status: string): string {
  switch (status) {
    case "idle":
      return "未读取";
    case "loading":
      return "读取中";
    case "ready":
      return "已就绪";
    case "error":
      return "读取失败";
    case "checking":
      return "检测中";
    default:
      return status;
  }
}
