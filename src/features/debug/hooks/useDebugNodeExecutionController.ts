import { useCallback, useMemo, useState } from "react";
import type { NodeType } from "../../../stores/flow";
import { applyDebugNodeTarget } from "../nodeTargetActions";
import {
  createDebugResolverEdgeIndex,
  selectDebugNodeExecutionRecords,
  type DebugNodeExecutionRecord,
} from "../nodeExecutionSelector";
import { buildDebugSnapshotBundle } from "../snapshot";
import type { DebugTraceSummary } from "../traceReducer";
import {
  DEFAULT_DEBUG_NODE_EXECUTION_FILTERS,
  type DebugNodeExecutionFilters,
  type DebugPerformanceSummary,
} from "../types";

interface UseDebugNodeExecutionControllerInput {
  flowNodes: NodeType[];
  nodeExecutionFilters: DebugNodeExecutionFilters;
  performanceSummary?: DebugPerformanceSummary;
  selectedNodeId?: string;
  selectNode: (nodeId?: string) => void;
  setNodeExecutionFilters: (filters: DebugNodeExecutionFilters) => void;
  summary: DebugTraceSummary;
}

export function useDebugNodeExecutionController({
  flowNodes,
  nodeExecutionFilters,
  performanceSummary,
  selectedNodeId,
  selectNode,
  setNodeExecutionFilters,
  summary,
}: UseDebugNodeExecutionControllerInput) {
  const [selectedNodeExecutionRecordId, setSelectedNodeExecutionRecordId] =
    useState<string>();
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
  const allNodeExecutionRecords = useMemo(
    () =>
      selectDebugNodeExecutionRecords(
        summary,
        pipelineNodes,
        DEFAULT_DEBUG_NODE_EXECUTION_FILTERS,
        { performanceSummary },
      ),
    [performanceSummary, pipelineNodes, summary],
  );
  const nodeExecutionRecords = useMemo(
    () =>
      selectDebugNodeExecutionRecords(
        summary,
        pipelineNodes,
        nodeExecutionFilters,
        { performanceSummary },
      ),
    [nodeExecutionFilters, performanceSummary, pipelineNodes, summary],
  );
  const selectedNodeExecutionRecord = useMemo(
    () =>
      selectedNodeExecutionRecordId
        ? allNodeExecutionRecords.find(
            (record) => record.id === selectedNodeExecutionRecordId,
          )
        : undefined,
    [allNodeExecutionRecords, selectedNodeExecutionRecordId],
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
      setSelectedNodeExecutionRecordId(record.id);
      if (!record.nodeId) {
        selectNode(undefined);
        return;
      }
      applyDebugNodeTarget(record.nodeId, { focusCanvas: true });
    },
    [selectNode],
  );
  const openNodeExecutionRecord = useCallback(
    (record: DebugNodeExecutionRecord) => {
      setSelectedNodeExecutionRecordId(record.id);
      if (record.nodeId) {
        applyDebugNodeTarget(record.nodeId, { focusCanvas: true });
      }
    },
    [],
  );

  return {
    allNodeExecutionRecords,
    nodeExecutionFilters,
    nodeExecutionRecords,
    pipelineNodes,
    resolverEdges,
    resolverEdgeIndex,
    selectedPipelineNode,
    selectedPipelineNodeId,
    selectedNodeExecutionRecord,
    selectedNodeExecutionRecordId,
    setSelectedNodeExecutionRecordId,
    openNodeExecutionRecord,
    selectNodeExecutionRecord,
    selectPipelineNode,
    setNodeExecutionFilters: updateNodeExecutionFilters,
  };
}
