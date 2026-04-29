import { useCallback, useMemo, useState } from "react";
import type { DebugArtifactEntry } from "../../../stores/debugArtifactStore";
import { useDebugOverlayStore } from "../../../stores/debugOverlayStore";
import type { NodeType } from "../../../stores/flow";
import { applyDebugNodeTarget } from "../nodeTargetActions";
import {
  compareDebugNodeExecutionRuns,
  getDebugNodeReplayControl,
  selectDebugBatchRecognitionNodeSummaries,
  selectDebugNodeExecutionOverlayFromEdges,
} from "../nodeExecutionAnalysis";
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
  type DebugTraceReplayStatus,
} from "../types";

interface UseDebugNodeExecutionControllerInput {
  artifacts: Record<string, DebugArtifactEntry>;
  flowNodes: NodeType[];
  liveSummary: DebugTraceSummary;
  nodeExecutionFilters: DebugNodeExecutionFilters;
  performanceSummary?: DebugPerformanceSummary;
  replayStatus?: DebugTraceReplayStatus;
  selectedNodeId?: string;
  selectNode: (nodeId?: string) => void;
  setNodeExecutionFilters: (filters: DebugNodeExecutionFilters) => void;
  summary: DebugTraceSummary;
}

export function useDebugNodeExecutionController({
  artifacts,
  flowNodes,
  liveSummary,
  nodeExecutionFilters,
  performanceSummary,
  replayStatus,
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
        liveSummary,
        pipelineNodes,
        DEFAULT_DEBUG_NODE_EXECUTION_FILTERS,
        { performanceSummary },
      ),
    [liveSummary, performanceSummary, pipelineNodes],
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
  const nodeReplayControl = useMemo(
    () => getDebugNodeReplayControl(selectedNodeExecutionRecord, replayStatus),
    [replayStatus, selectedNodeExecutionRecord],
  );
  const batchRecognitionNodeSummaries = useMemo(
    () => selectDebugBatchRecognitionNodeSummaries(artifacts),
    [artifacts],
  );
  const nodeExecutionRunComparisons = useMemo(() => {
    const runIds = nodeExecutionFilters.comparisonRunIds;
    if (!runIds) return [];
    return compareDebugNodeExecutionRuns(allNodeExecutionRecords, runIds);
  }, [allNodeExecutionRecords, nodeExecutionFilters.comparisonRunIds]);

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
      useDebugOverlayStore
        .getState()
        .applyNodeExecutionOverlay(
          selectDebugNodeExecutionOverlayFromEdges(
            allNodeExecutionRecords,
            record,
            resolverEdges,
          ),
        );
      if (!record.nodeId) {
        selectNode(undefined);
        return;
      }
      applyDebugNodeTarget(record.nodeId, { focusCanvas: true });
    },
    [allNodeExecutionRecords, resolverEdges, selectNode],
  );
  const openNodeExecutionRecord = useCallback(
    (record: DebugNodeExecutionRecord) => {
      setSelectedNodeExecutionRecordId(record.id);
      useDebugOverlayStore
        .getState()
        .applyNodeExecutionOverlay(
          selectDebugNodeExecutionOverlayFromEdges(
            allNodeExecutionRecords,
            record,
            resolverEdges,
          ),
        );
      if (record.nodeId) {
        applyDebugNodeTarget(record.nodeId, { focusCanvas: true });
      }
    },
    [allNodeExecutionRecords, resolverEdges],
  );

  return {
    allNodeExecutionRecords,
    batchRecognitionNodeSummaries,
    nodeExecutionFilters,
    nodeExecutionRecords,
    nodeExecutionRunComparisons,
    nodeReplayControl,
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
