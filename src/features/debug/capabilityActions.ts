import { debugProtocolClient } from "../../services/server";
import { useDebugSessionStore } from "../../stores/debugSessionStore";
import { useWSStore } from "../../stores/wsStore";

export function ensureDebugCapabilitiesRequested(): boolean {
  const sessionState = useDebugSessionStore.getState();
  if (
    sessionState.capabilities ||
    sessionState.capabilityStatus === "loading"
  ) {
    return true;
  }
  if (!useWSStore.getState().connected) {
    return false;
  }

  sessionState.setCapabilitiesLoading();
  const sent = debugProtocolClient.requestCapabilities();
  if (!sent) {
    sessionState.setCapabilitiesError("LocalBridge 未连接，暂时无法读取调试能力。");
  }
  return sent;
}
