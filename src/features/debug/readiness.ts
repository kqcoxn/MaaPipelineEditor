export interface DebugReadinessInput {
  localBridgeConnected: boolean;
  deviceConnectionStatus?: string | null;
  controllerId?: string | null;
}

export interface DebugReadinessIssue {
  code: "debug.localbridge.disconnected" | "debug.device.disconnected";
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

  return {
    ready: issues.length === 0,
    issues,
  };
}

export function formatDebugReadinessMessage(
  readiness: DebugReadiness,
): string {
  if (readiness.ready) {
    return "LocalBridge 与设备均已连接，可以启动调试。";
  }

  const issueTitles = readiness.issues
    .map((issue) => issue.title)
    .join("、");

  return `需要同时连接 LocalBridge 与设备后才能启动调试。当前：${issueTitles}。`;
}
