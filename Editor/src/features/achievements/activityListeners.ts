import { useMFWStore } from "@/stores/connection/mfwStore";
import { useDebugRunProfileStore } from "@/stores/debug/debugRunProfileStore";
import { useFileStore } from "@/stores/project/fileStore";
import { crossFileService } from "@/services/crossFileService";
import type { DebugEvent, DebugRunMode } from "@/features/debug/types";
import { emitAchievementEvent, subscribeAchievementEvents } from "./bus";
import { createDebugAchievementTracker } from "./debugProgress";
import { recordGraphStructure, type CommittedGraph } from "./graphEvents";
import { recordManualConnection, type ManualConnectionGraph } from "./connectionProgress";

export function subscribeAchievementActivity(): () => void {
  const award = (counter: string) => emitAchievementEvent(`achievement:${counter}`);
  const debug = createDebugAchievementTracker(award);
  const disposeBus = subscribeAchievementEvents((event) => {
    if (event.type === "graph:manual-connected") {
      recordManualConnection(event.payload as ManualConnectionGraph);
    } else if (event.type === "graph:committed") {
      const graph = event.payload as CommittedGraph;
      recordGraphStructure(graph);
      const previousEdges = new Map(graph.beforeEdges.map((edge) => [edge.id, edge]));
      const previousNodes = new Map(graph.beforeNodes.map((node) => [node.id, node]));
      const connectedTargets = new Set(graph.edges.map((edge) => edge.target));
      const newlyConnectedTargets = new Set(graph.edges.filter((edge) => {
        const previous = previousEdges.get(edge.id);
        return !previous || previous.target !== edge.target || previous.source !== edge.source;
      }).map((edge) => edge.target));
      const externalTargets = graph.nodes.filter((node) => node.type === "external" && connectedTargets.has(node.id) &&
        (newlyConnectedTargets.has(node.id) || previousNodes.get(node.id)?.data.label !== node.data.label));
      if (externalTargets.length && crossFileService.getAllNodes().some((target) =>
        !target.isCurrentFile && target.nodeType === "pipeline" && externalTargets.some((node) => node.data.label === target.fullName),
      )) award("external_connected");
    } else if (event.type === "graph:node:edited") {
      debug.edit(useFileStore.getState().currentFile.fileName, (event.payload as { nodeId: string }).nodeId);
    } else if (event.type === "debug:live-event") {
      const liveEvent = event.payload as DebugEvent;
      // LocalBridge 在 run_started 确认之前便发送 preparing 事件，快速运行也不会漏计。
      if (liveEvent.kind === "session" && liveEvent.phase === "starting" &&
        typeof liveEvent.data?.mode === "string" && typeof liveEvent.data.entry === "string") {
        debug.start({ runId: liveEvent.runId, sessionId: liveEvent.sessionId,
          mode: liveEvent.data.mode as DebugRunMode, entry: liveEvent.data.entry },
          useFileStore.getState().currentFile.fileName, useDebugRunProfileStore.getState().profile.resourcePaths);
      }
      debug.event(liveEvent);
    } else if (event.type === "debug:failure:focused") {
      const { runId, fileId, nodeId } = event.payload as { runId: string; fileId: string; nodeId: string };
      debug.focusFailure(runId, fileId, nodeId);
    }
  });
  const disposeDevice = useMFWStore.subscribe((state, previous) => {
    if (state.connectionStatus === "connected" && previous.connectionStatus !== "connected") award("device_connected");
  });
  return () => { disposeBus(); disposeDevice(); };
}
