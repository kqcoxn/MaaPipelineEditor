import { useCallback, useEffect, useMemo, useState } from "react";
import { useDebugOverlayStore } from "../../../stores/debugOverlayStore";
import { useFileStore } from "../../../stores/fileStore";
import type { EdgeType, NodeType } from "../../../stores/flow";
import { selectProjectPipelineFiles } from "../../project-session/projectPipelineIndex";
import { useProjectSessionStore } from "../../../stores/projectSessionStore";
import { useDebugRunProfileStore } from "../../../stores/debugRunProfileStore";
import { applyDebugNodeTarget } from "../nodeTargetActions";
import { allDebugNodeExecutionAttempts } from "../nodeExecutionAttempts";
import {
  selectDebugNodeExecutionOverlayFromEdges,
  selectDebugNodeExecutionOverlayForSelection,
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
} from "../types";

interface UseDebugNodeExecutionControllerInput {
  flowEdges: EdgeType[];
  flowNodes: NodeType[];
  liveSummary: DebugTraceSummary;
  nodeExecutionAttributionMode: DebugExecutionAttributionMode;
  nodeExecutionFilters: DebugNodeExecutionFilters;
  selectedNodeId?: string;
  selectNode: (nodeId?: string) => void;
  setNodeExecutionFilters: (filters: DebugNodeExecutionFilters) => void;
  summary: DebugTraceSummary;
}

export function useDebugNodeExecutionController({
  flowEdges,
  flowNodes,
  liveSummary,
  nodeExecutionAttributionMode,
  nodeExecutionFilters,
  selectedNodeId,
  selectNode,
  setNodeExecutionFilters,
  summary,
}: UseDebugNodeExecutionControllerInput) {
  const [selectedNodeExecutionRecordId, setSelectedNodeExecutionRecordId] =
    useState<string>();
  const [selectedNodeExecutionAttemptId, setSelectedNodeExecutionAttemptId] =
    useState<string>();
  const [includeAllJsonRunTargets, setIncludeAllJsonRunTargets] =
    useState(false);
  const [selectedRunTargetNodeIdState, setSelectedRunTargetNodeId] =
    useState<string>();
  const projectEntries = useProjectSessionStore((state) => state.entriesByPath);
  const projectPipelineFiles = useMemo(
    () => selectProjectPipelineFiles(projectEntries),
    [projectEntries],
  );
  const resourcePaths = useDebugRunProfileStore(
    (state) => state.profile.resourcePaths,
  );
  const fileSnapshotKey = useFileStore((state) =>
    JSON.stringify({
      currentFile: {
        fileName: state.currentFile.fileName,
        filePath: state.currentFile.config.filePath,
        prefix: state.currentFile.config.prefix,
        relativePath: state.currentFile.config.relativePath,
      },
      files: state.files.map((file) => ({
        fileName: file.fileName,
        filePath: file.config.filePath,
        prefix: file.config.prefix,
        relativePath: file.config.relativePath,
        nodeCount: file.nodes.length,
        edgeCount: file.edges.length,
      })),
    }),
  );
  const flowNodeIds = useMemo(
    () => new Set(flowNodes.map((node) => node.id)),
    [flowNodes],
  );
  const flowSnapshotKey = useMemo(
    () =>
      JSON.stringify({
        edges: flowEdges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          sourceHandle: edge.sourceHandle,
          target: edge.target,
          targetHandle: edge.targetHandle,
          jumpBack: edge.attributes?.jump_back,
          anchor: edge.attributes?.anchor,
        })),
        nodes: flowNodes.map((node) => ({
          id: node.id,
          label: node.data.label,
          type: node.type,
        })),
      }),
    [flowEdges, flowNodes],
  );
  const debugResolver = useMemo(() => {
    void fileSnapshotKey;
    void flowSnapshotKey;
    const bundle = buildDebugSnapshotBundle(projectPipelineFiles, resourcePaths);
    return {
      edges: bundle.resolverSnapshot.edges,
      nodes: bundle.resolverSnapshot.nodes.filter((node) =>
        flowNodeIds.has(node.nodeId),
      ),
      allNodes: bundle.resolverSnapshot.nodes,
    };
  }, [
    fileSnapshotKey,
    flowNodeIds,
    flowSnapshotKey,
    projectPipelineFiles,
    resourcePaths,
  ]);
  const resolverEdges = debugResolver.edges;
  const resolverEdgeIndex = useMemo(
    () => createDebugResolverEdgeIndex(resolverEdges),
    [resolverEdges],
  );
  const pipelineNodes = debugResolver.nodes;
  const nodeExecutionResolverNodes = debugResolver.allNodes;
  const runTargetNodes = includeAllJsonRunTargets
    ? nodeExecutionResolverNodes
    : pipelineNodes;
  const selectedPipelineNode = useMemo(
    () => pipelineNodes.find((node) => node.nodeId === selectedNodeId),
    [pipelineNodes, selectedNodeId],
  );
  const selectedPipelineNodeId = selectedPipelineNode?.nodeId;
  const selectedRunTargetNodeId = useMemo(() => {
    if (
      selectedRunTargetNodeIdState &&
      runTargetNodes.some((node) => node.nodeId === selectedRunTargetNodeIdState)
    ) {
      return selectedRunTargetNodeIdState;
    }
    if (
      selectedNodeId &&
      runTargetNodes.some((node) => node.nodeId === selectedNodeId)
    ) {
      return selectedNodeId;
    }
    return undefined;
  }, [runTargetNodes, selectedNodeId, selectedRunTargetNodeIdState]);
  const selectedRunTargetNode = useMemo(
    () =>
      selectedRunTargetNodeId
        ? runTargetNodes.find((node) => node.nodeId === selectedRunTargetNodeId)
        : undefined,
    [runTargetNodes, selectedRunTargetNodeId],
  );
  const allNodeExecutionRecords = useMemo(
    () =>
      selectDebugNodeExecutionRecords(
        liveSummary,
        nodeExecutionResolverNodes,
        DEFAULT_DEBUG_NODE_EXECUTION_FILTERS,
        {
          attributionMode: nodeExecutionAttributionMode,
          resolverEdges,
        },
      ),
    [
      liveSummary,
      nodeExecutionAttributionMode,
      nodeExecutionResolverNodes,
      resolverEdges,
    ],
  );
  const nodeExecutionRecords = useMemo(
    () =>
      selectDebugNodeExecutionRecords(
        summary,
        nodeExecutionResolverNodes,
        nodeExecutionFilters,
        {
          attributionMode: nodeExecutionAttributionMode,
          resolverEdges,
        },
      ),
    [
      nodeExecutionAttributionMode,
      nodeExecutionResolverNodes,
      nodeExecutionFilters,
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
  const selectedNodeExecutionAttempt = useMemo(
    () =>
      selectedNodeExecutionAttempts.find(
        (attempt) => attempt.id === migratedSelectedNodeExecutionAttemptId,
      ),
    [migratedSelectedNodeExecutionAttemptId, selectedNodeExecutionAttempts],
  );
  useEffect(() => {
    if (migratedSelectedNodeExecutionAttemptId !== selectedNodeExecutionAttemptId) {
      setSelectedNodeExecutionAttemptId(migratedSelectedNodeExecutionAttemptId);
    }
  }, [
    migratedSelectedNodeExecutionAttemptId,
    selectedNodeExecutionAttemptId,
  ]);

  useEffect(() => {
    if (selectedNodeId && flowNodeIds.has(selectedNodeId)) {
      setSelectedRunTargetNodeId(selectedNodeId);
    }
  }, [flowNodeIds, selectedNodeId]);

  useEffect(() => {
    if (
      selectedRunTargetNodeIdState &&
      !runTargetNodes.some((node) => node.nodeId === selectedRunTargetNodeIdState)
    ) {
      setSelectedRunTargetNodeId(undefined);
    }
  }, [runTargetNodes, selectedRunTargetNodeIdState]);

  useEffect(() => {
    const overlayStore = useDebugOverlayStore.getState();
    if (!selectedNodeExecutionRecord) {
      overlayStore.clearNodeExecutionOverlay();
      return;
    }
    overlayStore.applyNodeExecutionOverlay(
      selectDebugNodeExecutionOverlayForSelection({
        records: allNodeExecutionRecords,
        selectedRecord: selectedNodeExecutionRecord,
        selectedAttempt: selectedNodeExecutionAttempt,
        resolverEdges,
        resolverNodes: nodeExecutionResolverNodes,
      }),
    );
  }, [
    allNodeExecutionRecords,
    nodeExecutionResolverNodes,
    resolverEdges,
    selectedNodeExecutionAttempt,
    selectedNodeExecutionRecord,
  ]);

  const selectPipelineNode = useCallback(
    (nodeId?: string) => {
      if (!nodeId) {
        setSelectedRunTargetNodeId(undefined);
        selectNode(undefined);
        return;
      }
      setSelectedRunTargetNodeId(nodeId);
      if (flowNodeIds.has(nodeId)) {
        applyDebugNodeTarget(nodeId, { focusCanvas: true });
        return;
      }
      selectNode(undefined);
    },
    [flowNodeIds, selectNode],
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
    nodeExecutionFilters,
    nodeExecutionRecords,
    nodeExecutionResolverNodes,
    pipelineNodes,
    runTargetNodes,
    resolverEdges,
    resolverEdgeIndex,
    includeAllJsonRunTargets,
    selectedPipelineNode,
    selectedPipelineNodeId,
    selectedRunTargetNode,
    selectedRunTargetNodeId,
    selectedNodeExecutionRecord,
    selectedNodeExecutionRecordId: migratedSelectedNodeExecutionRecordId,
    selectedNodeExecutionAttempt,
    selectedNodeExecutionAttemptId: migratedSelectedNodeExecutionAttemptId,
    setSelectedNodeExecutionRecordId,
    setSelectedNodeExecutionAttemptId,
    openNodeExecutionRecord,
    selectNodeExecutionRecord,
    selectPipelineNode,
    setIncludeAllJsonRunTargets,
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
