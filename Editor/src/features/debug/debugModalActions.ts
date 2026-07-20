import { message } from "antd";
import uiT from "../../i18n/translate";
import type { DebugProtocolClient } from "../../services/protocols/DebugProtocolClient";
import { getDebugAgentProfileKey } from "./agentProfile";
import type {
  DebugAgentProfile,
  DebugResourceHealthRequest,
} from "./types";

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

interface ResourceHealthActionContext {
  client: DebugProtocolClient;
  connected: boolean;
  request: DebugResourceHealthRequest;
  requestKey: string;
  setResourceHealthChecking: (requestId: string, requestKey: string) => void;
  setResourceHealthError: (
    requestId: string,
    requestKey: string,
    error: string,
  ) => void;
}

type TestingAgentIdsSetter = (
  updater: (current: Set<string>) => Set<string>,
) => void;

function ensureControllerReady(connected: boolean, controllerId?: string) {
  if (!connected) {
    message.error(uiT("ui.debug.actions.localBridgeDisconnected", "LocalBridge 未连接"));
    return false;
  }
  if (!controllerId) {
    message.error(
      uiT(
        "ui.debug.actions.connectControllerFirst",
        "请先连接 MaaFramework 控制器（Controller）",
      ),
    );
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
    message.error(
      uiT("ui.debug.actions.screenshotRequestFailed", "发送截图请求失败"),
    );
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
  if (!connected || !client.isConnected()) {
    message.error(uiT("ui.debug.actions.localBridgeDisconnected", "LocalBridge 未连接"));
    return;
  }
  if (resourcePaths.length === 0) {
    invalidateResourcePreflight();
    message.warning(
      uiT(
        "ui.debug.actions.configureResourcePaths",
        "请先配置资源路径或等待 LocalBridge 扫描资源包",
      ),
    );
    return;
  }
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  setResourcePreflightChecking(requestId, resourceKey);
  const sent = client.preflightResources({
    requestId,
    resourcePaths,
  });
  if (!sent) {
    const errorMsg = uiT(
      "ui.debug.actions.resourcePreflightRequestFailed",
      "发送资源加载检测请求失败。",
    );
    setResourcePreflightError(requestId, resourceKey, errorMsg);
    message.error(
      uiT(
        "ui.debug.actions.resourcePreflightRequestFailedShort",
        "发送资源加载检测请求失败",
      ),
    );
  }
}

export function testAgentAction({
  agent,
  client,
  connected,
  resourcePaths,
  setTestingAgentIds,
}: {
  agent: DebugAgentProfile;
  client: DebugProtocolClient;
  connected: boolean;
  resourcePaths: string[];
  setTestingAgentIds: TestingAgentIdsSetter;
}): void {
  if (!connected || !client.isConnected()) {
    message.error(uiT("ui.debug.actions.localBridgeDisconnected", "LocalBridge 未连接"));
    return;
  }
  if (agent.transport === "tcp") {
    if (!agent.tcpPort || agent.tcpPort <= 0 || agent.tcpPort > 65535) {
      message.warning(
        uiT("ui.debug.actions.invalidTcpPort", "请输入 1-65535 范围内的 TCP 端口"),
      );
      return;
    }
  } else if (!agent.identifier?.trim()) {
    message.warning(
      uiT("ui.debug.actions.agentIdentifierRequired", "请输入代理标识符（Identifier）"),
    );
    return;
  }
  if (resourcePaths.length === 0) {
    message.warning(
      uiT(
        "ui.debug.actions.configureResourcePaths",
        "请先配置资源路径或等待 LocalBridge 扫描资源包",
      ),
    );
    return;
  }
  const agentId = getDebugAgentProfileKey(agent) ?? "agent";
  setTestingAgentIds((current) => new Set(current).add(agentId));
  const sent = client.testAgent({
    agent: {
      ...agent,
      id: agentId,
      enabled: true,
    },
    resourcePaths,
  });
  if (!sent) {
    setTestingAgentIds((current) => {
      const next = new Set(current);
      next.delete(agentId);
      return next;
    });
    message.error(
      uiT("ui.debug.actions.agentTestRequestFailed", "发送代理连接测试请求失败"),
    );
  }
}

export function requestResourceHealthAction({
  client,
  connected,
  request,
  requestKey,
  setResourceHealthChecking,
  setResourceHealthError,
}: ResourceHealthActionContext): void {
  if (!connected || !client.isConnected()) {
    message.error(uiT("ui.debug.actions.localBridgeDisconnected", "LocalBridge 未连接"));
    return;
  }
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  setResourceHealthChecking(requestId, requestKey);
  const sent = client.checkResourceHealth({
    ...request,
    requestId,
  });
  if (!sent) {
    const errorMsg = uiT(
      "ui.debug.actions.resourceHealthRequestFailed",
      "发送资源体检请求失败。",
    );
    setResourceHealthError(requestId, requestKey, errorMsg);
    message.error(
      uiT(
        "ui.debug.actions.resourceHealthRequestFailedShort",
        "发送资源体检请求失败",
      ),
    );
  }
}
