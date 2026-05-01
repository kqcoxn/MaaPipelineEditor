import { message } from "antd";
import type { DebugProtocolClient } from "../../services/protocols/DebugProtocolClient";
import type { DebugAgentProfile } from "./types";

interface ScreenshotActionContext {
  client: DebugProtocolClient;
  connected: boolean;
  controllerId?: string;
  sessionId?: string;
}

interface ResourcePreflightActionContext {
  client: DebugProtocolClient;
  connected: boolean;
  invalidateResourcePreflight: () => void;
  resourceKey: string;
  resourcePaths: string[];
  setResourcePreflightChecking: (requestId: string, resourceKey: string) => void;
  setResourcePreflightError: (
    requestId: string,
    resourceKey: string,
    error: string,
  ) => void;
}

type TestingAgentIdsSetter = (
  updater: (current: Set<string>) => Set<string>,
) => void;

function ensureControllerReady(connected: boolean, controllerId?: string) {
  if (!connected) {
    message.error("LocalBridge 未连接");
    return false;
  }
  if (!controllerId) {
    message.error("请先连接 MaaFramework 控制器（Controller）");
    return false;
  }
  return true;
}

export function captureScreenshotAction(
  context: ScreenshotActionContext,
  onSuccess: () => void,
): void {
  if (!ensureControllerReady(context.connected, context.controllerId)) return;
  const sent = context.client.captureScreenshot({
    sessionId: context.sessionId,
    controllerId: context.controllerId,
    force: true,
  });
  if (!sent) {
    message.error("发送截图请求失败");
    return;
  }
  onSuccess();
}

export function requestResourcePreflightAction({
  client,
  connected,
  invalidateResourcePreflight,
  resourceKey,
  resourcePaths,
  setResourcePreflightChecking,
  setResourcePreflightError,
}: ResourcePreflightActionContext): void {
  if (!connected) {
    message.error("LocalBridge 未连接");
    return;
  }
  if (resourcePaths.length === 0) {
    invalidateResourcePreflight();
    message.warning("请先配置资源路径或等待 LocalBridge 扫描资源包");
    return;
  }
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  setResourcePreflightChecking(requestId, resourceKey);
  const sent = client.preflightResources({
    requestId,
    resourcePaths,
  });
  if (!sent) {
    setResourcePreflightError(
      requestId,
      resourceKey,
      "发送资源加载检测请求失败。",
    );
    message.error("发送资源加载检测请求失败");
  }
}

export function testAgentAction({
  agent,
  client,
  connected,
  setTestingAgentIds,
}: {
  agent: DebugAgentProfile;
  client: DebugProtocolClient;
  connected: boolean;
  setTestingAgentIds: TestingAgentIdsSetter;
}): void {
  if (!connected) {
    message.error("LocalBridge 未连接");
    return;
  }
  if (agent.transport === "tcp") {
    if (!agent.tcpPort || agent.tcpPort <= 0 || agent.tcpPort > 65535) {
      message.warning("请输入 1-65535 范围内的 TCP 端口");
      return;
    }
  } else if (!agent.identifier?.trim()) {
    message.warning("请输入代理标识符（Identifier）");
    return;
  }
  const agentId = agent.id.trim() || "agent";
  setTestingAgentIds((current) => new Set(current).add(agentId));
  const sent = client.testAgent({
    agent: {
      ...agent,
      id: agentId,
      enabled: true,
    },
  });
  if (!sent) {
    setTestingAgentIds((current) => {
      const next = new Set(current);
      next.delete(agentId);
      return next;
    });
    message.error("发送代理连接测试请求失败");
  }
}
