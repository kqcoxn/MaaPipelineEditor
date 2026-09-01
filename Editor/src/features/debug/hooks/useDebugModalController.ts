import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { message } from "antd";
import { useShallow } from "zustand/shallow";
import {
  debugProtocolClient,
  fileProtocol,
} from "../../../services/server";
import { useDebugSessionStore } from "@/stores/debug/debugSessionStore";
import { useDebugModalMemoryStore } from "@/stores/debug/debugModalMemoryStore";
import { useDebugTraceStore } from "@/stores/debug/debugTraceStore";
import { useDebugArtifactStore } from "@/stores/debug/debugArtifactStore";
import { useDebugDiagnosticsStore } from "@/stores/debug/debugDiagnosticsStore";
import { useDebugRunProfileStore } from "@/stores/debug/debugRunProfileStore";
import { useDebugOverrideStore } from "@/stores/debug/debugOverrideStore";
import {
  useMFWStore,
} from "@/stores/connection/mfwStore";
import { useWSStore } from "@/stores/connection/wsStore";
import { useFlowStore } from "../../../stores/flow";
import {
  saveOpenedLocalFilesForDebug,
  useFileStore,
} from "@/stores/project/fileStore";
import { ensureDebugCapabilitiesRequested } from "../actions/capabilityActions";
import { debugContributionRegistry } from "../contributions/registry";
import { getControllerDisplayName } from "../utils/controllerDisplay";
import {
  captureScreenshotAction,
  testAgentAction,
} from "../actions/debugModalActions";
import { subscribeDebugRunRequests } from "../actions/debugRunRequestBridge";
import {
  applyDebugNodeTarget,
  focusDebugCanvasNode,
  getDebugNodeTarget,
} from "../actions/nodeTargetActions";
import {
  formatDebugReadinessMessage,
  getDebugReadiness,
} from "../selectors/readiness";
import {
  runnableModes,
  targetRunModes,
  validateRunRequest,
} from "../utils/modalUtils";
import {
  DEBUG_PIPELINE_OVERRIDE_ERROR_CODE,
  parseDebugPipelineOverrideDraft,
} from "../utils/pipelineOverride";
import { useDebugResourceChecks } from "./useDebugResourceChecks";
import { useDebugNodeExecutionController } from "./useDebugNodeExecutionController";
import type {
  DebugAgentProfile,
  DebugModalPanel,
  DebugNodeTarget,
  DebugRunMode,
  DebugRunRequest,
} from "../types";
import "../contributions/runModes";
import "../contributions/modalContributions";
import { useProjectInterfaceDebugContext } from "@/features/project-interface/useProjectInterfaceDebugContext";

export function useDebugModalController() {
  const [testingAgentIds, setTestingAgentIds] = useState<Set<string>>(
    () => new Set(),
  );
  const agentTestTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pendingRunRef = useRef<
    | {
        mode: DebugRunMode;
        target?: DebugNodeTarget;
        input?: DebugRunRequest["input"];
      }
    | undefined
  >();
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
    setAgentTestResult,
    clearAgentTestResult,
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
      setAgentTestResult: state.setAgentTestResult,
      clearAgentTestResult: state.clearAgentTestResult,
    })),
  );
  const overrideDraft = useDebugOverrideStore((state) => state.draft);
  const setOverrideDraftState = useDebugOverrideStore((state) => state.setDraft);
  const resetOverrideDraftState = useDebugOverrideStore(
    (state) => state.resetDraft,
  );
  const connected = useWSStore((state) => state.connected);
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
  const { semanticRevision, topologyRevision } = useFlowStore(
    useShallow((state) => ({
      semanticRevision: state.semanticRevision,
      topologyRevision: state.topologyRevision,
    })),
  );
  const { flowEdges, flowNodes } = useMemo(() => {
    void semanticRevision;
    void topologyRevision;
    const state = useFlowStore.getState();
    return { flowEdges: state.edges, flowNodes: state.nodes };
  }, [semanticRevision, topologyRevision]);
  const selectedFlowNodeId = useFlowStore((state) =>
    state.selectedNodes.length === 1 ? state.selectedNodes[0]?.id : undefined,
  );
  const selectedFlowTarget = useMemo(() => {
    void semanticRevision;
    void topologyRevision;
    return getDebugNodeTarget(selectedFlowNodeId);
  }, [selectedFlowNodeId, semanticRevision, topologyRevision]);
  const projectInterface = useProjectInterfaceDebugContext(connected);

  useEffect(() => {
    return debugProtocolClient.onAgentTested((result) => {
      clearTimeout(agentTestTimeouts.current[result.agentId]);
      delete agentTestTimeouts.current[result.agentId];
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
    });
  }, []);
  const piContext = projectInterface.mode === "project_interface" ? projectInterface.context : undefined;
  const resourceChecks = useDebugResourceChecks({
    modalOpen,
    activePanel,
    connected,
    profileState,
    selectedFlowTarget,
    resourcePathsOverride:
      projectInterface.mode === "project_interface"
        ? (piContext?.resourcePaths ?? [])
        : undefined,
    projectContextId: piContext?.contextId,
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
        deviceConnectionStatus: mfwState.connectionStatus,
        controllerId: mfwState.controllerId,
        resourceStatus: resourcePreflightStatus,
        resourceError: resourcePreflight.error,
      }),
    [
      connected,
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
    target?: DebugNodeTarget,
    input?: DebugRunRequest["input"],
  ): Promise<void> => {
    clearProtocolError();
    if (projectInterface.mode === "project_interface" && !piContext) {
      message.error(projectInterface.error ?? "Project Interface 上下文尚未就绪，请刷新配置或切换到手动模式");
      return;
    }
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
    if (!debugReadiness.ready) {
      const blockingIssue = debugReadiness.issues.find(
        (issue) => issue.code !== "debug.resource.not_ready",
      );
      if (
        !blockingIssue &&
        resourcePreflightStatus !== "error" &&
        resolvedResourcePaths.length > 0
      ) {
        pendingRunRef.current = { mode, target, input };
        message.info(
          resourcePreflightStatus === "checking"
            ? "资源检测完成后将自动启动调试。"
            : "正在检测资源路径，检测完成后将自动启动调试。",
        );
        return;
      }

      const diagnostics = debugReadiness.issues.map((issue) => ({
        severity: "error" as const,
        code: issue.code,
        message: issue.message,
      }));
      diagnosticsState.setPreflightDiagnostics([...diagnostics]);
      message.error(debugReadiness.issues[0]?.message ?? "调试前置条件未满足");
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
      const request = profileState.buildRunRequest(
        mode,
        target,
        session?.sessionId,
        input,
        overrideEntries,
      );
      request.configurationSource = piContext ? "project_interface" : "manual";
      request.projectContextId = piContext?.contextId;
      if (piContext) request.profile.resourcePaths = piContext.resourcePaths;
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
        applyDebugNodeTarget(request.target, {
          focusCanvas: true,
          rememberEntryNodeId: true,
        });
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "生成调试请求失败");
    }
  };

  const startRunRef = useRef(startRun);
  startRunRef.current = startRun;
  useEffect(() => {
    if (!pendingRunRef.current) return;
    if (resourcePreflightStatus === "error") {
      pendingRunRef.current = undefined;
      message.error(
        resourcePreflight.error ?? "资源加载检测失败，无法启动调试。",
      );
      return;
    }
    if (resourcePreflightStatus !== "ready") return;
    const pendingRun = pendingRunRef.current;
    pendingRunRef.current = undefined;
    void startRunRef.current(
      pendingRun.mode,
      pendingRun.target,
      pendingRun.input,
    );
  }, [resourcePreflight.error, resourcePreflightStatus]);
  useEffect(() => {
    if (!connected) pendingRunRef.current = undefined;
  }, [connected]);
  useEffect(
    () =>
      subscribeDebugRunRequests((intent) => {
        void startRunRef.current(intent.mode, intent.target, intent.input);
      }),
    [],
  );


  const stopRun = () => {
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
      reason: "user_stop",
    });
    if (!sent) message.error("发送停止请求失败");
  };

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

  const testProjectInterfaceAgent = (agentIndex: number) => {
    if (!piContext) {
      message.warning("Project Interface 上下文尚未就绪");
      return;
    }
    const agent = piContext.agents?.[agentIndex];
    if (!agent) return;
    clearProtocolError();
    clearAgentTestResult(agent.id);
    const override = piContext ? projectInterface.agentOverrides[agent.id] : undefined;
    setTestingAgentIds((current) => new Set(current).add(agent.id));
    if (agentTestTimeouts.current[agent.id]) clearTimeout(agentTestTimeouts.current[agent.id]);
    agentTestTimeouts.current[agent.id] = setTimeout(() => {
      delete agentTestTimeouts.current[agent.id];
      setTestingAgentIds((current) => {
        const next = new Set(current);
        next.delete(agent.id);
        return next;
      });
      debugProtocolClient.stopAgent({ projectContextId: piContext.contextId, agentIndex });
      const timeoutMessage = "Agent 连接测试超时，已停止启动进程";
      setAgentTestResult({
        agentId: agent.id,
        success: false,
        checkedAt: new Date().toISOString(),
        message: timeoutMessage,
        failureStage: "connect",
      });
      message.warning(timeoutMessage);
    }, 12000);
    const sent = debugProtocolClient.testAgent({
      agent: { id: agent.id, enabled: true, transport: "identifier" },
      projectContextId: piContext.contextId,
      agentIndex,
      agentOverride: override,
    });
    if (!sent) {
      setTestingAgentIds((current) => {
        const next = new Set(current);
        next.delete(agent.id);
        return next;
      });
      clearTimeout(agentTestTimeouts.current[agent.id]);
      delete agentTestTimeouts.current[agent.id];
      setAgentTestResult({
        agentId: agent.id,
        success: false,
        checkedAt: new Date().toISOString(),
        message: "发送 Agent 连接测试请求失败，请检查 LocalBridge 连接",
        failureStage: "context",
      });
    }
  };

  const stopProjectInterfaceAgent = (agentIndex: number) => {
    if (!piContext) return;
    const agent = piContext.agents?.[agentIndex];
    if (!agent) return;
    clearTimeout(agentTestTimeouts.current[agent.id]);
    delete agentTestTimeouts.current[agent.id];
    setTestingAgentIds((current) => {
      const next = new Set(current);
      next.delete(agent.id);
      return next;
    });
    debugProtocolClient.stopAgent({ projectContextId: piContext.contextId, agentIndex });
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
    projectInterface,
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
    selectedRunTargetKey: nodeExecutionController.selectedRunTargetKey,
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
    testProjectInterfaceAgent,
    stopProjectInterfaceAgent,
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
