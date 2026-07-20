import uiT from "../../i18n/translate";
import type { DebugRunMode } from "./types";

export function getRunModeLabel(mode: DebugRunMode): string {
  switch (mode) {
    case "run-from-node":
      return uiT("ui.debug.capability.runFromNode", "从指定节点运行");
    case "single-node-run":
      return uiT("ui.debug.capability.singleNodeRun", "只运行一个节点");
    case "recognition-only":
      return uiT("ui.debug.capability.recognitionOnly", "只执行识别");
    case "action-only":
      return uiT("ui.debug.capability.actionOnly", "只执行动作");
    case "replay":
      return uiT("ui.debug.capability.replay", "回放");
    default:
      return mode;
  }
}

export function getDebugFeatureLabel(value: string): string {
  switch (value) {
    case "trace-replay":
      return uiT("ui.debug.capability.traceReplay", "时间线回放");
    case "performance-summary":
      return uiT("ui.debug.capability.performanceSummary", "性能摘要");
    case "agent-run-profile":
      return uiT("ui.debug.capability.agentRunProfile", "代理运行配置");
    default:
      return value;
  }
}

export function getDiagnosticCapabilityLabel(value: string): string {
  switch (value) {
    case "preflight":
      return uiT("ui.debug.capability.preflight", "启动前检查");
    case "resource-health":
      return uiT("ui.debug.capability.resourceHealth", "资源体检");
    case "resource-load":
      return uiT("ui.debug.capability.resourceLoad", "资源加载诊断");
    case "target-node":
      return uiT("ui.debug.capability.targetNode", "目标节点检查");
    case "agent":
      return uiT("ui.debug.capability.agent", "代理连接诊断");
    case "agent-run-profile":
      return uiT("ui.debug.capability.agentProfileDiagnostic", "代理配置诊断");
    case "performance-summary":
      return uiT(
        "ui.debug.capability.performanceSummaryDiagnostic",
        "性能摘要诊断",
      );
    case "trace-replay":
      return uiT("ui.debug.capability.traceReplayDiagnostic", "时间线回放诊断");
    default:
      return value;
  }
}

export function getArtifactCapabilityLabel(value: string): string {
  switch (value) {
    case "task-detail":
      return uiT("ui.debug.capability.taskDetail", "任务详情");
    case "recognition-detail":
      return uiT("ui.debug.capability.recognitionDetail", "识别详情");
    case "action-detail":
      return uiT("ui.debug.capability.actionDetail", "动作详情");
    case "screenshot":
      return uiT("ui.debug.capability.screenshot", "截图");
    case "performance-summary":
      return uiT("ui.debug.capability.performanceSummaryArtifact", "性能摘要");
    default:
      return value;
  }
}

export function getScreenshotSourceLabel(value: string): string {
  switch (value) {
    case "manual":
      return uiT("ui.debug.capability.screenshotManual", "手动截图");
    case "recognition-input":
      return uiT(
        "ui.debug.capability.screenshotRecognitionInput",
        "识别输入截图",
      );
    default:
      return value;
  }
}

export function getProfileFeatureLabel(value: string): string {
  switch (value) {
    case "multi-resource":
      return uiT("ui.debug.capability.multiResource", "多资源路径");
    case "multi-agent":
      return uiT("ui.debug.capability.multiAgent", "多代理配置");
    case "agent-run-profile":
      return uiT("ui.debug.capability.agentRunProfileFeature", "代理运行配置");
    default:
      return value;
  }
}

export function getControllerLabel(value: string): string {
  switch (value) {
    case "adb":
      return uiT("ui.debug.capability.controllerAdb", "安卓设备");
    case "win32":
      return uiT("ui.debug.capability.controllerWin32", "Windows 窗口");
    case "dbg":
      return uiT("ui.debug.capability.controllerDbg", "调试控制器");
    case "replay":
      return uiT("ui.debug.capability.controllerReplay", "回放控制器");
    case "record":
      return uiT("ui.debug.capability.controllerRecord", "录制控制器");
    default:
      return value;
  }
}

export function getUnavailableReasonLabel(value: string): string {
  switch (value) {
    case "go-binding-dbg-controller-missing":
      return uiT(
        "ui.debug.capability.goBindingDbgMissing",
        "当前 Go 绑定未提供该控制器",
      );
    default:
      return value;
  }
}

export function getTaskerApiLabel(value: string): string {
  switch (value) {
    case "PostTask":
      return uiT("ui.debug.capability.postTask", "提交任务");
    case "PostRecognition":
      return uiT("ui.debug.capability.postRecognition", "提交识别");
    case "PostAction":
      return uiT("ui.debug.capability.postAction", "提交动作");
    case "PostStop":
      return uiT("ui.debug.capability.postStop", "停止任务");
    default:
      return value;
  }
}

export function getResourceApiLabel(value: string): string {
  switch (value) {
    case "PostBundle":
      return uiT("ui.debug.capability.postBundle", "加载资源包");
    case "OverridePipeline":
      return uiT("ui.debug.capability.overridePipeline", "覆盖 Pipeline");
    case "OverrideNext":
      return uiT("ui.debug.capability.overrideNext", "覆盖节点后继");
    case "OverrideImage":
      return uiT("ui.debug.capability.overrideImage", "覆盖图像");
    case "GetNode":
      return uiT("ui.debug.capability.getNode", "读取节点定义");
    case "GetNodeJSON":
      return uiT("ui.debug.capability.getNodeJson", "读取节点 JSON");
    case "GetNodeList":
      return uiT("ui.debug.capability.getNodeList", "读取节点列表");
    default:
      return value;
  }
}

export function getAgentTransportLabel(value: string): string {
  switch (value) {
    case "identifier":
      return uiT("ui.debug.capability.agentIdentifier", "标识符连接");
    case "tcp":
      return uiT("ui.debug.capability.agentTcp", "TCP 连接");
    default:
      return value;
  }
}

export function getDebugStatusLabel(status: string): string {
  switch (status) {
    case "idle":
      return uiT("debug.common.status.idle", "未读取");
    case "loading":
      return uiT("debug.common.status.loading", "读取中");
    case "ready":
      return uiT("debug.common.status.ready", "已就绪");
    case "error":
      return uiT("debug.common.status.error", "读取失败");
    case "checking":
      return uiT("debug.common.status.checking", "检测中");
    default:
      return status;
  }
}
