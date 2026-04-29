import { useCallback, useMemo } from "react";
import type { NodeType } from "../../../stores/flow";
import { applyDebugNodeTarget } from "../nodeTargetActions";
import {
  createDebugResolverEdgeIndex,
  selectDebugNodeExecutionRecords,
  type DebugNodeExecutionRecord,
} from "../nodeExecutionSelector";
import { buildDebugSnapshotBundle } from "../snapshot";
import type { DebugTraceSummary } from "../traceReducer";
import type { DebugNodeExecutionFilters } from "../types";

interface UseDebugNodeExecutionControllerInput {
  flowNodes: NodeType[];
  nodeExecutionFilters: DebugNodeExecutionFilters;
  selectedNodeId?: string;
  selectNode: (nodeId?: string) => void;
  setNodeExecutionFilters: (filters: DebugNodeExecutionFilters) => void;
  summary: DebugTraceSummary;
}

export function useDebugNodeExecutionController({
  flowNodes,
  nodeExecutionFilters,
  selectedNodeId,
  selectNode,
  setNodeExecutionFilters,
  summary,
}: UseDebugNodeExecutionControllerInput) {
  const debugResolver = useMemo(() => {
    const bundle = buildDebugSnapshotBundle();
    const flowNodeIds = new Set(flowNodes.map((node) => node.id));
    return {
      edges: bundle.resolverSnapshot.edges,
      nodes: bundle.resolverSnapshot.nodes.filter((node) =>
        flowNodeIds.has(node.nodeId),
      ),
    };
  }, [flowNodes]);
  const resolverEdges = debugResolver.edges;
  const resolverEdgeIndex = useMemo(
    () => createDebugResolverEdgeIndex(resolverEdges),
    [resolverEdges],
  );
  const pipelineNodes = debugResolver.nodes;
  const selectedPipelineNode = useMemo(
    () => pipelineNodes.find((node) => node.nodeId === selectedNodeId),
    [pipelineNodes, selectedNodeId],
  );
  const selectedPipelineNodeId = selectedPipelineNode?.nodeId;
  const nodeExecutionRecords = useMemo(
    () =>
      selectDebugNodeExecutionRecords(
        summary,
        pipelineNodes,
        nodeExecutionFilters,
      ),
    [nodeExecutionFilters, pipelineNodes, summary],
  );

  const selectPipelineNode = useCallback(
    (nodeId?: string) => {
      if (!nodeId) {
        selectNode(undefined);
        return;
      }
      applyDebugNodeTarget(nodeId, { focusCanvas: true });
    },
    [selectNode],
  );

  const updateNodeExecutionFilters = useCallback(
    (filters: DebugNodeExecutionFilters) => {
      setNodeExecutionFilters(filters);
    },
    [setNodeExecutionFilters],
  );

  const selectNodeExecutionRecord = useCallback(
    (record: DebugNodeExecutionRecord) => {
      if (!record.nodeId) {
        selectNode(undefined);
        return;
      }
      applyDebugNodeTarget(record.nodeId, { focusCanvas: true });
    },
    [selectNode],
  );

  return {
    nodeExecutionFilters,
    nodeExecutionRecords,
    pipelineNodes,
    resolverEdges,
    resolverEdgeIndex,
    selectedPipelineNode,
    selectedPipelineNodeId,
    selectNodeExecutionRecord,
    selectPipelineNode,
    setNodeExecutionFilters: updateNodeExecutionFilters,
  };
}
