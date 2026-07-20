import uiT from "../../i18n/translate";

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
      title: uiT("ui.debug.readiness.localBridgeTitle", "LocalBridge 未连接"),
      message: uiT(
        "ui.debug.readiness.localBridgeMessage",
        "LocalBridge 未连接，无法启动调试。",
      ),
    });
  }

  if (
    input.deviceConnectionStatus !== "connected" ||
    !input.controllerId
  ) {
    issues.push({
      code: "debug.device.disconnected",
      title: uiT("ui.debug.readiness.deviceTitle", "设备未连接"),
      message: uiT(
        "ui.debug.readiness.deviceMessage",
        "设备未连接，无法启动调试。请先连接设备并创建 MaaFramework 控制器（Controller）。",
      ),
    });
  }

  if (input.resourceStatus !== "ready") {
    issues.push({
      code: "debug.resource.not_ready",
      title:
        input.resourceStatus === "checking"
          ? uiT("ui.debug.readiness.resourceCheckingTitle", "资源正在检测")
          : uiT("ui.debug.readiness.resourceNotReadyTitle", "资源未加载成功"),
      message:
        input.resourceError ??
        (input.resourceStatus === "checking"
          ? uiT(
              "ui.debug.readiness.resourceCheckingMessage",
              "资源正在加载检测中，请等待检测完成后再启动调试。",
            )
          : uiT(
              "ui.debug.readiness.resourceNotReadyMessage",
              "资源尚未通过加载检测，无法启动调试。请先配置并检测资源路径。",
            )),
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
    return uiT(
      "ui.debug.readiness.allReady",
      "LocalBridge、设备与资源均已就绪，可以启动调试。",
    );
  }

  const issueTitles = readiness.issues
    .map((issue) => issue.title)
    .join("、");

  return uiT(
    "ui.debug.readiness.notReadySummary",
    "需要同时连接 LocalBridge、设备并成功加载资源后才能启动调试。当前：{{issues}}。",
    { issues: issueTitles },
  );
}
