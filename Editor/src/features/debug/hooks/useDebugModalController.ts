import { useCallback, useEffect, useMemo, useState } from "react";
import { message } from "antd";
import { useShallow } from "zustand/shallow";
import {
  debugProtocolClient,
  fileProtocol,
} from "../../../services/server";
import { useDebugSessionStore } from "../../../stores/debugSessionStore";
import { useDebugModalMemoryStore } from "../../../stores/debugModalMemoryStore";
import { useDebugTraceStore } from "../../../stores/debugTraceStore";
import { useDebugArtifactStore } from "../../../stores/debugArtifactStore";
import { useDebugDiagnosticsStore } from "../../../stores/debugDiagnosticsStore";
import { useDebugRunProfileStore } from "../../../stores/debugRunProfileStore";
import { useDebugOverrideStore } from "../../../stores/debugOverrideStore";
import {
  useMFWStore,
} from "../../../stores/mfwStore";
import { useWSStore } from "../../../stores/wsStore";
import { useWorkspaceStore } from "../../../stores/workspaceStore";
import { useFlowStore } from "../../../stores/flow";
import {
  saveOpenedLocalFilesForDebug,
  useFileStore,
} from "../../../stores/fileStore";
import { ensureDebugCapabilitiesRequested } from "../capabilityActions";
import { debugContributionRegistry } from "../contributions/registry";
import { getControllerDisplayName } from "../controllerDisplay";
import {
  captureScreenshotAction,
  testAgentAction,
} from "../debugModalActions";
import { debugCommandBus } from "../debugCommandBus";
import {
  applyDebugNodeTarget,
  focusDebugCanvasNode,
} from "../nodeTargetActions";
import {
  formatDebugReadinessMessage,
  getDebugReadiness,
} from "../readiness";
import { getCurrentDebugReadiness } from "../readinessState";
import {
  runnableModes,
  targetRunModes,
  validateRunRequest,
} from "../modalUtils";
import {
  DEBUG_PIPELINE_OVERRIDE_ERROR_CODE,
  parseDebugPipelineOverrideDraft,
} from "../pipelineOverride";
import { ensureDebugSession } from "../sessionActions";
import { useDebugResourceChecks } from "./useDebugResourceChecks";
import { useDebugNodeExecutionController } from "./useDebugNodeExecutionController";
import type {
  DebugAgentProfile,
  DebugModalPanel,
  DebugRunMode,
  DebugRunRequest,
} from "../types";
import "../contributions/runModes";
import "../contributions/modalContributions";

export function useDebugModalController() {
  const [testingAgentIds, setTestingAgentIds] = useState<Set<string>>(
    () => new Set(),
  );
  const {
    modalOpen,
    activePanel,
    capabilities,
    capabilityStatus,
    capabilityError,
    session,
    activeRun,
    agentTestResults,
    lastError,
    selectedNodeId,
    closeModal,
    setActivePanel,
    selectNode,
    clearProtocolError,
    setProtocolError,
  } = useDebugSessionStore(
    useShallow((state) => ({
      modalOpen: state.modalOpen,
      activePanel: state.activePanel,
      capabilities: state.capabilities,
      capabilityStatus: state.capabilityStatus,
      capabilityError: state.capabilityError,
      session: state.session,
      activeRun: state.activeRun,
      agentTestResults: state.agentTestResults,
      lastError: state.lastError,
      selectedNodeId: state.selectedNodeId,
      closeModal: state.closeModal,
      setActivePanel: state.setActivePanel,
      selectNode: state.selectNode,
      clearProtocolError: state.clearProtocolError,
      setProtocolError: state.setProtocolError,
    })),
  );
  const overrideDraft = useDebugOverrideStore((state) => state.draft);
  const setOverrideDraftState = useDebugOverrideStore((state) => state.setDraft);
  const resetOverrideDraftState = useDebugOverrideStore(
    (state) => state.resetDraft,
  );
  const connected = useWSStore((state) => state.connected);
  const workspaceState = useWorkspaceStore((state) => state.state);
  const {
    lastRunMode,
    nodeExecutionAttributionMode,
    nodeExecutionDetailMode,
    nodeExecutionFilters,
    setLastPanel,
    setLastRunMode,
    setNodeExecutionFilters,
    setNodeExecutionAttributionMode,
    setNodeExecutionDetailMode,
  } = useDebugModalMemoryStore();
  const {
    allEvents,
    displaySessions,
    events,
    latestDisplaySessionId,
    selectAllDisplaySessions,
    selectDisplaySessions,
    selectLatestDisplaySession,
    selectedDisplaySessionIds,
    summary,
    liveSummary,
  } = useDebugTraceStore(
    useShallow((state) => ({
      allEvents: state.events,
      displaySessions: state.displaySessions,
      events: state.displayEvents,
      latestDisplaySessionId: state.latestDisplaySessionId,
      selectAllDisplaySessions: state.selectAllDisplaySessions,
      selectDisplaySessions: state.selectDisplaySessions,
      selectLatestDisplaySession: state.selectLatestDisplaySession,
      selectedDisplaySessionIds: state.selectedDisplaySessionIds,
      summary: state.summary,
      liveSummary: state.liveSummary,
    })),
  );
  const diagnosticsState = useDebugDiagnosticsStore(
    useShallow((state) => ({
      diagnostics: state.diagnostics,
      setPreflightDiagnostics: state.setPreflightDiagnostics,
    })),
  );
  const artifacts = useDebugArtifactStore((state) => state.artifacts);
  const selectedArtifactId = useDebugArtifactStore(
    (state) => state.selectedArtifactId,
  );
  const artifactActions = useDebugArtifactStore(
    useShallow((state) => ({
      setLoading: state.setLoading,
      selectArtifact: state.selectArtifact,
    })),
  );
  const profileState = useDebugRunProfileStore();
  const mfwState = useMFWStore(
    useShallow((state) => ({
      connectionStatus: state.connectionStatus,
      controllerType: state.controllerType,
      controllerId: state.controllerId,
      deviceInfo: state.deviceInfo,
    })),
  );
  const { flowEdges, flowNodes } = useFlowStore(
    useShallow((state) => ({
      flowEdges: state.edges,
      flowNodes: state.nodes,
    })),
  );
  const selectedFlowNodeId = useFlowStore((state) =>
    state.selectedNodes.length === 1 ? state.selectedNodes[0]?.id : undefined,
  );
  const resourceChecks = useDebugResourceChecks({
    modalOpen,
    activePanel,
    connected,
    profileState,
    selectedFlowNodeId,
  });
  const controllerDisplayName = useMemo(
    () =>
      getControllerDisplayName(
        mfwState.deviceInfo,
        mfwState.controllerId,
        mfwState.controllerType,
      ),
    [mfwState.controllerId, mfwState.controllerType, mfwState.deviceInfo],
  );

  const {
    resourceBundles,
    resolvedResourcePaths,
    resourceKey,
    resourcePreflight,
    resourcePreflightStatus,
    resourceHealthRequest,
    resourceHealthDraftError,
    resourceHealthResult,
    resourceHealthError,
    resourceHealthStatus,
    requestResourcePreflight,
    invalidateResourcePreflight,
    requestResourceHealth,
    updateResourcePaths,
  } = resourceChecks;
  const debugReadiness = useMemo(
    () =>
      getDebugReadiness({
        localBridgeConnected: connected,
        workspaceState,
        deviceConnectionStatus: mfwState.connectionStatus,
        controllerId: mfwState.controllerId,
        resourceStatus: resourcePreflightStatus,
        resourceError: resourcePreflight.error,
      }),
    [
      connected,
      workspaceState,
      mfwState.connectionStatus,
      mfwState.controllerId,
      resourcePreflight.error,
      resourcePreflightStatus,
    ],
  );
  const debugReadinessDescription = useMemo(
    () => formatDebugReadinessMessage(debugReadiness),
    [debugReadiness],
  );
  const overrideParseResult = useMemo(
    () => parseDebugPipelineOverrideDraft(overrideDraft),
    [overrideDraft],
  );
  const overrideEntries = overrideParseResult.overrides ?? [];
  const overrideValidationError = overrideParseResult.error;

  useEffect(() => {
    if (!connected || capabilities || capabilityStatus === "loading") return;
    ensureDebugCapabilitiesRequested();
  }, [connected, capabilities, capabilityStatus]);

  useEffect(
    () =>
      debugProtocolClient.onAgentTested((result) => {
        setTestingAgentIds((current) => {
          if (!current.has(result.agentId)) return current;
          const next = new Set(current);
          next.delete(result.agentId);
          return next;
        });
        if (result.success) {
          message.success(result.message);
        } else {
          message.error(result.message);
        }
      }),
    [],
  );

  const runModes = useMemo(() => debugContributionRegistry.getRunModes(), []);

  const availableModeIds = useMemo(
    () => new Set(capabilities?.runModes ?? runModes.map((mode) => mode.id)),
    [capabilities, runModes],
  );

  const nodeExecutionController = useDebugNodeExecutionController({
    flowEdges,
    flowNodes,
    liveSummary,
    nodeExecutionAttributionMode,
    nodeExecutionFilters,
    selectedNodeId,
    selectNode,
    setNodeExecutionFilters,
    summary,
  });
  const {
    pipelineNodes,
    selectPipelineNode,
  } = nodeExecutionController;

  const selectedArtifact = selectedArtifactId
    ? artifacts[selectedArtifactId]
    : undefined;

  const requestArtifact = (artifactId: string) => {
    const entry = artifacts[artifactId];
    if (!entry) return;
    artifactActions.selectArtifact(artifactId);
    if (entry.status === "ready" || entry.status === "loading") return;
    artifactActions.setLoading(artifactId);
    const sent = debugProtocolClient.requestArtifact({
      sessionId: entry.ref.sessionId,
      artifactId,
    });
    if (!sent) {
      useDebugArtifactStore
        .getState()
        .setError(artifactId, "发送产物（Artifact）请求失败");
    }
  };

  const setOverrideDraft = useCallback(
    (draft: string) => {
      setOverrideDraftState(draft);
      if (lastError?.code === DEBUG_PIPELINE_OVERRIDE_ERROR_CODE) {
        clearProtocolError();
      }
    },
    [clearProtocolError, lastError?.code, setOverrideDraftState],
  );

  const resetOverrideDraft = useCallback(() => {
    resetOverrideDraftState();
    if (lastError?.code === DEBUG_PIPELINE_OVERRIDE_ERROR_CODE) {
      clearProtocolError();
    }
  }, [clearProtocolError, lastError?.code, resetOverrideDraftState]);

  const startRun = async (
    mode: DebugRunMode,
    nodeId?: string,
    input?: DebugRunRequest["input"],
  ): Promise<void> => {
    clearProtocolError();
    if (overrideValidationError) {
      diagnosticsState.setPreflightDiagnostics([
        {
          severity: "error",
          code: DEBUG_PIPELINE_OVERRIDE_ERROR_CODE,
          message: overrideValidationError,
        },
      ]);
      setProtocolError({
        code: DEBUG_PIPELINE_OVERRIDE_ERROR_CODE,
        message: overrideValidationError,
      });
      message.error(overrideValidationError);
      return;
    }
    const currentDebugReadiness = getCurrentDebugReadiness().readiness;
    if (!currentDebugReadiness.ready) {
      const diagnostics = currentDebugReadiness.issues.map((issue) => ({
        severity: "error" as const,
        code: issue.code,
        message: issue.message,
      }));
      diagnosticsState.setPreflightDiagnostics([...diagnostics]);
      message.error(
        currentDebugReadiness.issues[0]?.message ?? "调试前置条件未满足",
      );
      return;
    }
    if (!runnableModes.has(mode) || !availableModeIds.has(mode)) {
      diagnosticsState.setPreflightDiagnostics([
        {
          severity: "error",
          code: "debug.run_mode.unsupported",
          message: `当前 LocalBridge 暂不支持调试模式: ${mode}`,
        },
      ]);
      message.warning("当前 LocalBridge 暂不支持该调试模式");
      return;
    }

    try {
      if (profileState.profile.savePolicy === "save-open-files") {
        const saveResult = await saveOpenedLocalFilesForDebug();
        if (saveResult.failedFiles.length > 0) {
          message.error(
            `调试前保存打开文件失败：${saveResult.failedFiles.join("、")}`,
          );
          return;
        }
      }
      const activeSession = await ensureDebugSession();
      const request = profileState.buildRunRequest(
        mode,
        nodeId,
        activeSession.sessionId,
        input,
        overrideEntries,
      );
      const preflightDiagnostics = validateRunRequest(request);
      diagnosticsState.setPreflightDiagnostics(preflightDiagnostics);
      const blockingDiagnostic = preflightDiagnostics.find(
        (diagnostic) => diagnostic.severity === "error",
      );
      if (blockingDiagnostic) {
        message.error(blockingDiagnostic.message);
        return;
      }
      if (targetRunModes.has(request.mode) && !request.target) {
        message.error("请选择可调试的 Pipeline 节点");
        return;
      }
      const sent = debugProtocolClient.startRun(request);
      if (!sent) {
        message.error("发送调试启动请求失败");
        return;
      }
      setLastRunMode(mode);
      if (request.target) {
        profileState.setEntry(request.target);
        applyDebugNodeTarget(request.target.nodeId, {
          focusCanvas: true,
          rememberEntryNodeId: true,
        });
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "生成调试请求失败");
    }
  };


  const stopRun = (reason = "user_stop") => {
    if (!session?.sessionId) {
      message.warning("当前没有调试会话（Session）");
      return;
    }
    if (session.status !== "running" || !activeRun?.runId) {
      message.warning("当前没有运行中的调试任务");
      return;
    }
    const sent = debugProtocolClient.stopRun({
      sessionId: session.sessionId,
      runId: activeRun.runId,
      reason,
    });
    if (!sent) message.error("发送停止请求失败");
  };

  useEffect(
    () =>
      debugCommandBus.register({
        start: ({ mode, nodeId, input }) => startRun(mode, nodeId, input),
        stop: ({ reason }) => stopRun(reason),
      }),
  );

  const captureScreenshot = () => {
    captureScreenshotAction(
      {
        client: debugProtocolClient,
        connected,
        controllerId: mfwState.controllerId ?? undefined,
        sessionId: session?.sessionId,
      },
      () => {
        setActivePanel("overview");
        setLastPanel("overview");
      },
    );
  };

  const testAgent = (agent: DebugAgentProfile) => {
    testAgentAction({
      agent,
      client: debugProtocolClient,
      connected,
      resourcePaths: resolvedResourcePaths,
      setTestingAgentIds,
    });
  };

  const focusNode = (nodeId: string) => {
    selectNode(nodeId);
    focusDebugCanvasNode(nodeId);
  };

  const focusFile = (fileId?: string, sourcePath?: string) => {
    const fileStore = useFileStore.getState();
    const openedFile =
      (fileId
        ? fileStore.files.find((file) => file.fileName === fileId)
        : undefined) ??
      (sourcePath ? fileStore.findFileByPath(sourcePath) : undefined);
    if (openedFile) {
      fileStore.switchFile(openedFile.fileName);
      return;
    }
    if (sourcePath) {
      const sent = fileProtocol.requestOpenFile(sourcePath);
      if (sent) return;
      message.error("发送打开文件请求失败");
      return;
    }
    message.warning("当前诊断没有可定位的文件");
  };

  const handlePanelClick = (panel: DebugModalPanel) => {
    setActivePanel(panel);
    setLastPanel(panel);
  };

  const openNodeExecutionRecord = (
    record: Parameters<
      typeof nodeExecutionController.openNodeExecutionRecord
    >[0],
  ) => {
    nodeExecutionController.openNodeExecutionRecord(record);
    setActivePanel("node-execution");
    setLastPanel("node-execution");
  };

  return {
    modalOpen,
    activePanel,
    capabilities,
    capabilityStatus,
    capabilityError,
    session,
    activeRun,
    agentTestResults,
    lastError,
    selectedNodeId,
    closeModal,
    connected,
    lastRunMode,
    allEvents,
    events,
    displaySessions,
    selectedDisplaySessionIds,
    latestDisplaySessionId,
    summary,
    liveSummary,
    diagnosticsState,
    profileState,
    overrideDraft,
    overrideEntries,
    overrideValidationError,
    setOverrideDraft,
    resetOverrideDraft,
    resourceBundles,
    mfwState,
    controllerDisplayName,
    flowNodes,
    selectedFlowNodeId,
    resolvedResourcePaths,
    resourceKey,
    resourcePreflight,
    resourcePreflightStatus,
    resourceHealthRequest,
    resourceHealthDraftError,
    resourceHealthResult,
    resourceHealthError,
    resourceHealthStatus,
    debugReadiness,
    debugReadinessDescription,
    runModes,
    availableModeIds,
    pipelineNodes,
    runTargetNodes: nodeExecutionController.runTargetNodes,
    resolverEdges: nodeExecutionController.resolverEdges,
    resolverEdgeIndex: nodeExecutionController.resolverEdgeIndex,
    includeAllJsonRunTargets: nodeExecutionController.includeAllJsonRunTargets,
    selectedRunTargetNode: nodeExecutionController.selectedRunTargetNode,
    selectedRunTargetNodeId: nodeExecutionController.selectedRunTargetNodeId,
    allNodeExecutionRecords: nodeExecutionController.allNodeExecutionRecords,
    nodeExecutionRecords: nodeExecutionController.nodeExecutionRecords,
    nodeExecutionResolverNodes: nodeExecutionController.nodeExecutionResolverNodes,
    nodeExecutionAttributionMode,
    nodeExecutionDetailMode,
    nodeExecutionFilters: nodeExecutionController.nodeExecutionFilters,
    selectedNodeExecutionRecord: nodeExecutionController.selectedNodeExecutionRecord,
    selectedNodeExecutionRecordId: nodeExecutionController.selectedNodeExecutionRecordId,
    selectedNodeExecutionAttempt: nodeExecutionController.selectedNodeExecutionAttempt,
    selectedNodeExecutionAttemptId: nodeExecutionController.selectedNodeExecutionAttemptId,
    artifacts,
    selectedArtifact,
    requestArtifact,
    testingAgentIds,
    startRun,
    stopRun,
    captureScreenshot,
    selectDisplaySessions,
    selectLatestDisplaySession,
    selectAllDisplaySessions,
    testAgent,
    selectPipelineNode,
    setIncludeAllJsonRunTargets:
      nodeExecutionController.setIncludeAllJsonRunTargets,
    selectNodeExecutionRecord:
      nodeExecutionController.selectNodeExecutionRecord,
    setSelectedNodeExecutionRecordId: nodeExecutionController.setSelectedNodeExecutionRecordId,
    setSelectedNodeExecutionAttemptId: nodeExecutionController.setSelectedNodeExecutionAttemptId,
    openNodeExecutionRecord,
    setNodeExecutionFilters: nodeExecutionController.setNodeExecutionFilters,
    setNodeExecutionAttributionMode,
    setNodeExecutionDetailMode,
    requestResourcePreflight,
    requestResourceHealth,
    invalidateResourcePreflight,
    updateResourcePaths,
    focusNode,
    focusFile,
    handlePanelClick,
  };
}

export type DebugModalController = ReturnType<typeof useDebugModalController>;
