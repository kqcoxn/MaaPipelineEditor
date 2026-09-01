import { message } from "antd";
import type { DebugModalPanel, DebugNodeTarget } from "../types";
import {
  buildDebugSnapshotBundle,
  resolveCurrentDebugNodeTarget,
} from "../selectors/snapshot";
import { useDebugModalMemoryStore } from "@/stores/debug/debugModalMemoryStore";
import { useDebugRunProfileStore } from "@/stores/debug/debugRunProfileStore";
import { useDebugSessionStore } from "@/stores/debug/debugSessionStore";
import { useFileStore } from "@/stores/project/fileStore";
import { useFlowStore } from "../../../stores/flow";
import { selectAndCenterNode } from "../../../services/flowNavigationService";

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

  const bundle = buildDebugSnapshotBundle(
    undefined,
    useDebugRunProfileStore.getState().profile.resourcePaths,
  );
  return resolveCurrentDebugNodeTarget(nodeId, bundle.resolverSnapshot);
}

export function applyDebugNodeTarget(
  target: DebugNodeTarget | undefined,
  options: ApplyDebugNodeTargetOptions = {},
): DebugNodeTarget | undefined {
  if (!target) {
    message.warning("请选择可调试的 Pipeline 节点");
    return undefined;
  }

  const sessionState = useDebugSessionStore.getState();
  const memoryState = useDebugModalMemoryStore.getState();
  const isCurrentFile =
    target.fileId === useFileStore.getState().currentFile.fileName;

  sessionState.selectNode(isCurrentFile ? target.nodeId : undefined);

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
  if (options.focusCanvas && isCurrentFile) {
    focusDebugCanvasNode(target.nodeId);
  }
  if (options.successMessage) {
    message.success(options.successMessage);
  }

  return target;
}

export function focusDebugCanvasNode(nodeId: string): boolean {
  const found = selectAndCenterNode(nodeId);
  return found && useFlowStore.getState().instance !== null;
}
