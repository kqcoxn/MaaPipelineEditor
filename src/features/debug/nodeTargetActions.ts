import { message } from "antd";
import type { DebugModalPanel, DebugNodeTarget } from "./types";
import {
  buildDebugSnapshotBundle,
  resolveDebugNodeTarget,
} from "./snapshot";
import { useDebugModalMemoryStore } from "../../stores/debugModalMemoryStore";
import { useDebugRunProfileStore } from "../../stores/debugRunProfileStore";
import { useDebugSessionStore } from "../../stores/debugSessionStore";
import {
  useFlowStore,
  getRuntimeNodeAbsoluteRect,
  type NodeType,
} from "../../stores/flow";

interface ApplyDebugNodeTargetOptions {
  focusCanvas?: boolean;
  openPanel?: DebugModalPanel;
  rememberPanel?: boolean;
  rememberEntryNodeId?: boolean;
  setEntry?: boolean;
  successMessage?: string;
}

export function getDebugNodeTarget(
  nodeId: string | undefined,
): DebugNodeTarget | undefined {
  if (!nodeId) return undefined;

  const bundle = buildDebugSnapshotBundle();
  return resolveDebugNodeTarget(nodeId, bundle.resolverSnapshot);
}

export function applyDebugNodeTarget(
  nodeId: string | undefined,
  options: ApplyDebugNodeTargetOptions = {},
): DebugNodeTarget | undefined {
  const target = getDebugNodeTarget(nodeId);
  if (!target) {
    message.warning("请选择可调试的 Pipeline 节点");
    return undefined;
  }

  const sessionState = useDebugSessionStore.getState();
  const memoryState = useDebugModalMemoryStore.getState();

  sessionState.selectNode(target.nodeId);

  if (options.setEntry) {
    useDebugRunProfileStore.getState().setEntry(target);
  }
  if (options.rememberEntryNodeId || options.setEntry) {
    memoryState.setLastEntryNodeId(target.nodeId);
  }
  if (options.openPanel) {
    sessionState.openModal(options.openPanel);
  }
  if (options.openPanel && options.rememberPanel) {
    memoryState.setLastPanel(options.openPanel);
  }
  if (options.focusCanvas) {
    focusDebugCanvasNode(target.nodeId);
  }
  if (options.successMessage) {
    message.success(options.successMessage);
  }

  return target;
}

export function focusDebugCanvasNode(nodeId: string): boolean {
  const flowState = useFlowStore.getState();
  const targetNode = flowState.nodes.find((node) => node.id === nodeId);
  if (!targetNode) return false;

  flowState.updateNodes(
    flowState.nodes.map((node: NodeType) => ({
      type: "select" as const,
      id: node.id,
      selected: node.id === targetNode.id,
    })),
  );
  flowState.updateSelection([targetNode], []);

  if (!flowState.instance) return false;

  const rect = getRuntimeNodeAbsoluteRect(
    flowState.instance,
    targetNode.id,
    targetNode,
    flowState.nodes,
  );
  if (!rect) return false;

  flowState.instance.setCenter(rect.x + rect.width / 2, rect.y + rect.height / 2, {
    duration: 500,
    zoom: 1.5,
  });

  return true;
}
