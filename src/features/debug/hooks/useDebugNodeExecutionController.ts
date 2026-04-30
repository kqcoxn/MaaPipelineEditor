import { useCallback, useEffect, useMemo, useState } from "react";
import type { DebugArtifactEntry } from "../../../stores/debugArtifactStore";
import { useDebugOverlayStore } from "../../../stores/debugOverlayStore";
import type { NodeType } from "../../../stores/flow";
import { applyDebugNodeTarget } from "../nodeTargetActions";
import { allDebugNodeExecutionAttempts } from "../nodeExecutionAttempts";
import {
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
  type DebugExecutionAttributionMode,
  type DebugNodeExecutionFilters,
  type DebugPerformanceSummary,
  type DebugTraceReplayStatus,
} from "../types";

interface UseDebugNodeExecutionControllerInput {
  artifacts: Record<string, DebugArtifactEntry>;
  flowNodes: NodeType[];
  liveSummary: DebugTraceSummary;
  nodeExecutionAttributionMode: DebugExecutionAttributionMode;
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
  nodeExecutionAttributionMode,
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
  const [selectedNodeExecutionAttemptId, setSelectedNodeExecutionAttemptId] =
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
        {
          attributionMode: nodeExecutionAttributionMode,
          resolverEdges,
          performanceSummary,
        },
      ),
    [
      liveSummary,
      nodeExecutionAttributionMode,
      performanceSummary,
      pipelineNodes,
      resolverEdges,
    ],
  );
  const nodeExecutionRecords = useMemo(
    () =>
      selectDebugNodeExecutionRecords(
        summary,
        pipelineNodes,
        nodeExecutionFilters,
        {
          attributionMode: nodeExecutionAttributionMode,
          resolverEdges,
          performanceSummary,
        },
      ),
    [
      nodeExecutionAttributionMode,
      nodeExecutionFilters,
      performanceSummary,
      pipelineNodes,
      resolverEdges,
      summary,
    ],
  );
  const migratedSelectedNodeExecutionRecordId = useMemo(() => {
    if (
      !selectedNodeExecutionRecordId ||
      allNodeExecutionRecords.some(
        (record) => record.id === selectedNodeExecutionRecordId,
      )
    ) {
      return selectedNodeExecutionRecordId;
    }
    return migrateSelectedRecordId(
      selectedNodeExecutionRecordId,
      allNodeExecutionRecords,
    );
  }, [allNodeExecutionRecords, selectedNodeExecutionRecordId]);
  const selectedNodeExecutionRecord = useMemo(
    () =>
      migratedSelectedNodeExecutionRecordId
        ? allNodeExecutionRecords.find(
            (record) => record.id === migratedSelectedNodeExecutionRecordId,
          )
        : undefined,
    [allNodeExecutionRecords, migratedSelectedNodeExecutionRecordId],
  );
  const selectedNodeExecutionAttempts = useMemo(
    () =>
      selectedNodeExecutionRecord
        ? allDebugNodeExecutionAttempts(selectedNodeExecutionRecord)
        : [],
    [selectedNodeExecutionRecord],
  );
  const migratedSelectedNodeExecutionAttemptId = useMemo(
    () =>
      migrateSelectedAttemptId(
        selectedNodeExecutionAttemptId,
        selectedNodeExecutionAttempts,
      ),
    [selectedNodeExecutionAttemptId, selectedNodeExecutionAttempts],
  );
  const nodeReplayControl = useMemo(
    () => getDebugNodeReplayControl(selectedNodeExecutionRecord, replayStatus),
    [replayStatus, selectedNodeExecutionRecord],
  );
  const batchRecognitionNodeSummaries = useMemo(
    () => selectDebugBatchRecognitionNodeSummaries(artifacts),
    [artifacts],
  );

  useEffect(() => {
    if (migratedSelectedNodeExecutionAttemptId !== selectedNodeExecutionAttemptId) {
      setSelectedNodeExecutionAttemptId(migratedSelectedNodeExecutionAttemptId);
    }
  }, [
    migratedSelectedNodeExecutionAttemptId,
    selectedNodeExecutionAttemptId,
  ]);

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
    nodeReplayControl,
    pipelineNodes,
    resolverEdges,
    resolverEdgeIndex,
    selectedPipelineNode,
    selectedPipelineNodeId,
    selectedNodeExecutionRecord,
    selectedNodeExecutionRecordId: migratedSelectedNodeExecutionRecordId,
    selectedNodeExecutionAttemptId: migratedSelectedNodeExecutionAttemptId,
    setSelectedNodeExecutionRecordId,
    setSelectedNodeExecutionAttemptId,
    openNodeExecutionRecord,
    selectNodeExecutionRecord,
    selectPipelineNode,
    setNodeExecutionFilters: updateNodeExecutionFilters,
  };
}

function migrateSelectedAttemptId(
  attemptId: string | undefined,
  attempts: ReturnType<typeof allDebugNodeExecutionAttempts>,
): string | undefined {
  if (attempts.length === 0) return undefined;
  if (attemptId && attempts.some((attempt) => attempt.id === attemptId)) {
    return attemptId;
  }
  return attempts[0].id;
}

function migrateSelectedRecordId(
  recordId: string,
  records: DebugNodeExecutionRecord[],
): string | undefined {
  const parts = recordId.split(":");
  if (parts.length < 5) return records[0]?.id;
  const runId = parts[1];
  const identity = parts[2];
  const firstSeq = Number(parts[3]);
  const lastSeq = Number(parts[4]);
  const sameIdentity = records.filter(
    (record) =>
      record.runId === runId &&
      (record.nodeId === identity || record.runtimeName === identity),
  );
  const candidates = sameIdentity.length > 0 ? sameIdentity : records;
  const nearest = candidates
    .map((record) => ({
      record,
      distance: Math.min(
        Math.abs(record.firstSeq - firstSeq),
        Math.abs(record.lastSeq - lastSeq),
      ),
    }))
    .sort(
      (a, b) => a.distance - b.distance || a.record.firstSeq - b.record.firstSeq,
    )[0];
  return nearest?.record.id;
}
