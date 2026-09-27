import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { debugProtocolClient } from "@/services/server";
import { message } from "@/utils/ui/antdAppApi";
import type { useProjectInterfaceDebugContext } from "@/features/project-interface/useProjectInterfaceDebugContext";
import type { DebugAgentTestResult } from "../types";

type PendingTest = { projectContextId: string; agentIndex: number };
type Options = {
  projectInterface: ReturnType<typeof useProjectInterfaceDebugContext>;
  connected: boolean;
  setTestingAgentIds: Dispatch<SetStateAction<Set<string>>>;
  clearProtocolError: () => void;
  clearAgentTestResult: (id: string) => void;
  setAgentTestResult: (result: DebugAgentTestResult) => void;
};

export function useProjectInterfaceAgentTest({ projectInterface: pi, connected, setTestingAgentIds, clearProtocolError, clearAgentTestResult, setAgentTestResult }: Options) {
  const pending = useRef(new Map<string, PendingTest>());
  const [stoppingAgentIds, setStoppingAgentIds] = useState<Set<string>>(() => new Set());
  const contextId = pi.mode === "project_interface" ? pi.context?.contextId : undefined;

  useEffect(() => debugProtocolClient.onAgentTested(result => {
    pending.current.delete(result.agentId);
    setStoppingAgentIds(current => { const next = new Set(current); next.delete(result.agentId); return next; });
  }), []);

  useEffect(() => {
    const tests = pending.current;
    // LocalBridge owns the startup deadline; losing the connection must not
    // leave the UI busy, nor leave a timer that kills a later attempt.
    return () => {
      for (const request of tests.values()) debugProtocolClient.stopAgent(request);
      const ids = new Set(tests.keys());
      tests.clear();
      setTestingAgentIds(current => new Set([...current].filter(id => !ids.has(id))));
      setStoppingAgentIds(new Set());
    };
  }, [connected, contextId, setTestingAgentIds]);

  const testProjectInterfaceAgent = (agentIndex: number) => {
    const agent = pi.context?.agents?.[agentIndex];
    if (!connected || !contextId || !agent) { message.warning("请先连接 LocalBridge 并等待 PI 上下文就绪"); return; }
    if (pending.current.has(agent.id)) return;
    clearProtocolError();
    clearAgentTestResult(agent.id);
    const request = { projectContextId: contextId, agentIndex };
    pending.current.set(agent.id, request);
    setTestingAgentIds(current => new Set(current).add(agent.id));
    if (!debugProtocolClient.testAgent({
      ...request, agent: { id: agent.id, enabled: true, transport: "identifier" }, agentOverride: pi.agentOverrides[agent.id],
    })) {
      pending.current.delete(agent.id);
      setTestingAgentIds(current => { const next = new Set(current); next.delete(agent.id); return next; });
      setAgentTestResult({ agentId: agent.id, success: false, checkedAt: new Date().toISOString(), message: "发送 Agent 连接测试请求失败，请检查 LocalBridge 连接", failureStage: "context" });
    }
  };

  const stopProjectInterfaceAgent = (agentIndex: number) => {
    const agent = pi.context?.agents?.[agentIndex];
    if (!agent || stoppingAgentIds.has(agent.id)) return;
    const request = pending.current.get(agent.id);
    if (!request) return;
    if (debugProtocolClient.stopAgent(request)) {
      // Keep this attempt busy until its result arrives, so a late result or
      // native cleanup cannot interfere with an immediate retry.
      setStoppingAgentIds(current => new Set(current).add(agent.id));
    } else { message.error("发送停止请求失败，请检查 LocalBridge 连接"); }
  };

  return { testProjectInterfaceAgent, stopProjectInterfaceAgent, stoppingAgentIds };
}
