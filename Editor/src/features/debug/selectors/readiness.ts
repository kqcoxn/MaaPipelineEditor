export interface DebugReadinessInput {
  localBridgeConnected: boolean;
  deviceConnectionStatus?: string | null;
  controllerId?: string | null;
  resourceStatus?: string | null;
  resourceError?: string | null;
}

export interface DebugReadinessIssue {
  code:
    | "debug.localbridge.disconnected"
    | "debug.device.disconnected"
    | "debug.resource.not_ready";
  title: string;
  message: string;
}

export interface DebugReadiness {
  ready: boolean;
  issues: DebugReadinessIssue[];
}

export function getDebugReadiness(
  input: DebugReadinessInput,
): DebugReadiness {
  const issues: DebugReadinessIssue[] = [];

  if (!input.localBridgeConnected) {
    issues.push({
      code: "debug.localbridge.disconnected",
      title: "LocalBridge 未连接",
      message: "LocalBridge 未连接，无法启动调试。",
    });
  }

  if (
    input.deviceConnectionStatus !== "connected" ||
    !input.controllerId
  ) {
    issues.push({
      code: "debug.device.disconnected",
      title: "设备未连接",
      message:
        "设备未连接，无法启动调试。请先连接设备并创建 MaaFramework 控制器（Controller）。",
    });
  }

  if (input.resourceStatus !== "ready") {
    issues.push({
      code: "debug.resource.not_ready",
      title:
        input.resourceStatus === "checking" ? "资源正在检测" : "资源未加载成功",
      message:
        input.resourceError ??
        (input.resourceStatus === "checking"
          ? "资源正在加载检测中，请等待检测完成后再启动调试。"
          : "资源尚未通过加载检测，无法启动调试。请先配置并检测资源路径。"),
    });
  }

  return {
    ready: issues.length === 0,
    issues,
  };
}

export function formatDebugReadinessMessage(
  readiness: DebugReadiness,
): string {
  if (readiness.ready) {
    return "LocalBridge、设备与资源均已就绪，可以启动调试。";
  }

  const issueTitles = readiness.issues
    .map((issue) => issue.title)
    .join("、");

  return `需要同时连接 LocalBridge、设备并成功加载资源后才能启动调试。当前：${issueTitles}。`;
}
