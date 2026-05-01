import type { DebugAgentProfile } from "./types";

export const DEFAULT_DEBUG_AGENT_TIMEOUT_MS = 2000;

export function getDebugAgentProfileKey(
  agent: Pick<DebugAgentProfile, "transport" | "identifier" | "tcpPort">,
): string | undefined {
  if (agent.transport === "tcp") {
    return typeof agent.tcpPort === "number" && Number.isFinite(agent.tcpPort)
      ? `tcp:${agent.tcpPort}`
      : undefined;
  }

  const identifier = agent.identifier?.trim();
  return identifier ? identifier : undefined;
}
