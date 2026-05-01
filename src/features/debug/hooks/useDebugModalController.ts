import { useCallback, useEffect, useMemo, useState } from "react";
import { message } from "antd";
import { useShallow } from "zustand/shallow";
import { AIClient } from "../../../utils/ai/aiClient";
import { debugProtocolClient, resourceProtocol } from "../../../services/server";
import { useDebugSessionStore } from "../../../stores/debugSessionStore";
import { useDebugModalMemoryStore } from "../../../stores/debugModalMemoryStore";
import { useDebugTraceStore } from "../../../stores/debugTraceStore";
import { useDebugArtifactStore } from "../../../stores/debugArtifactStore";
import {
  debugAiSummaryTargetKey,
  useDebugAiSummaryStore,
  type DebugAiSummaryFocus,
} from "../../../stores/debugAiSummaryStore";
import { useDebugDiagnosticsStore } from "../../../stores/debugDiagnosticsStore";
import {
  makeDebugResourceKey,
  normalizeDebugResourcePaths,
  useDebugRunProfileStore,
} from "../../../stores/debugRunProfileStore";
import { useLocalFileStore } from "../../../stores/localFileStore";
import {
  useMFWStore,
} from "../../../stores/mfwStore";
import { useWSStore } from "../../../stores/wsStore";
import { useFlowStore } from "../../../stores/flow";
import { showActionRunConfirm } from "../confirmActionRun";
import {
  buildDebugAiSummaryPrompt,
  parseDebugAiSummaryResponse,
} from "../aiSummary";
import { ensureDebugCapabilitiesRequested } from "../capabilityActions";
import { debugContributionRegistry } from "../contributions/registry";
import { getControllerDisplayName } from "../controllerDisplay";
import {
  captureScreenshotAction,
  requestResourcePreflightAction,
  startScreenshotStreamAction,
  stopScreenshotStreamAction,
  testAgentAction,
} from "../debugModalActions";
import {
  selectBatchSummaryRefs,
  selectPerformanceRefs,
} from "../debugEventSelectors";
import {
  formatDebugReadinessMessage,
  getDebugReadiness,
} from "../readiness";
import {
  runnableModes,
  targetRunModes,
  validateRunRequest,
} from "../modalUtils";
import {
  requestTraceSnapshotAction,
} from "../traceReplayActions";
import type { DebugNodeExecutionRecord } from "../nodeExecutionSelector";
import { useDebugNodeExecutionController } from "./useDebugNodeExecutionController";
import type {
  DebugAgentProfile,
  DebugBatchRecognitionInput,
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
    screenshotStream,
    agentTestResults,
    lastError,
    selectedNodeId,
    closeModal,
    setActivePanel,
    selectNode,
    resourcePreflight,
    setResourcePreflightChecking,
    setResourcePreflightError,
    invalidateResourcePreflight,
    clearProtocolError,
  } = useDebugSessionStore(
    useShallow((state) => ({
      modalOpen: state.modalOpen,
      activePanel: state.activePanel,
      capabilities: state.capabilities,
      capabilityStatus: state.capabilityStatus,
      capabilityError: state.capabilityError,
      session: state.session,
      activeRun: state.activeRun,
      screenshotStream: state.screenshotStream,
      agentTestResults: state.agentTestResults,
      lastError: state.lastError,
      selectedNodeId: state.selectedNodeId,
      closeModal: state.closeModal,
      setActivePanel: state.setActivePanel,
      selectNode: state.selectNode,
      resourcePreflight: state.resourcePreflight,
      setResourcePreflightChecking: state.setResourcePreflightChecking,
      setResourcePreflightError: state.setResourcePreflightError,
      invalidateResourcePreflight: state.invalidateResourcePreflight,
      clearProtocolError: state.clearProtocolError,
    })),
  );
  const connected = useWSStore((state) => state.connected);
  const {
    lastRunMode,
    autoGenerateAiSummary,
    nodeExecutionAttributionMode,
    nodeExecutionDetailMode,
    nodeExecutionFilters,
    setLastPanel,
    setLastRunMode,
    setLastEntryNodeId,
    setAutoGenerateAiSummary,
    setNodeExecutionFilters,
    setNodeExecutionAttributionMode,
    setNodeExecutionDetailMode,
  } = useDebugModalMemoryStore();
  const aiSummaryState = useDebugAiSummaryStore(
    useShallow((state) => ({
      status: state.status,
      activeReport: state.activeReport,
      error: state.error,
      autoRequestedTargetIds: state.autoRequestedTargetIds,
      setGenerating: state.setGenerating,
      setReport: state.setReport,
      setError: state.setError,
      markAutoRequested: state.markAutoRequested,
    })),
  );
  const {
    allEvents,
    displaySessions,
    events,
    latestDisplaySessionId,
    performanceSummary,
    selectAllDisplaySessions,
    selectDisplaySessions,
    selectLatestDisplaySession,
    selectedDisplaySessionIds,
    selectedPerformanceSummaries,
    summary,
    liveSummary,
  } = useDebugTraceStore(
    useShallow((state) => ({
      allEvents: state.events,
      displaySessions: state.displaySessions,
      events: state.displayEvents,
      latestDisplaySessionId: state.latestDisplaySessionId,
      performanceSummary: state.performanceSummary,
      selectAllDisplaySessions: state.selectAllDisplaySessions,
      selectDisplaySessions: state.selectDisplaySessions,
      selectLatestDisplaySession: state.selectLatestDisplaySession,
      selectedDisplaySessionIds: state.selectedDisplaySessionIds,
      selectedPerformanceSummaries: state.selectedPerformanceSummaries,
      summary: state.summary,
      liveSummary: state.liveSummary,
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
  const diagnosticsState = useDebugDiagnosticsStore(
    useShallow((state) => ({
      diagnostics: state.diagnostics,
      setPreflightDiagnostics: state.setPreflightDiagnostics,
    })),
  );
  const profileState = useDebugRunProfileStore();
  const { resourceBundles, imageList, imageListBundleName, imageListLoading } =
    useLocalFileStore(
      useShallow((state) => ({
        resourceBundles: state.resourceBundles,
        imageList: state.imageList,
        imageListBundleName: state.imageListBundleName,
        imageListLoading: state.imageListLoading,
      })),
    );
  const mfwState = useMFWStore(
    useShallow((state) => ({
      connectionStatus: state.connectionStatus,
      controllerType: state.controllerType,
      controllerId: state.controllerId,
      deviceInfo: state.deviceInfo,
    })),
  );
  const flowNodes = useFlowStore((state) => state.nodes);
  const selectedFlowNodeId = useFlowStore((state) =>
    state.selectedNodes.length === 1 ? state.selectedNodes[0]?.id : undefined,
  );
  const controllerDisplayName = useMemo(
    () =>
      getControllerDisplayName(
        mfwState.deviceInfo,
        mfwState.controllerId,
        mfwState.controllerType,
      ),
    [mfwState.controllerId, mfwState.controllerType, mfwState.deviceInfo],
  );

  const resolvedResourcePaths = useMemo(
    () =>
      normalizeDebugResourcePaths(
        profileState.profile.resourcePaths,
        resourceBundles,
      ),
    [profileState.profile.resourcePaths, resourceBundles],
  );
  const resourceKey = useMemo(
    () =>
      makeDebugResourceKey(profileState.profile.resourcePaths, resourceBundles),
    [profileState.profile.resourcePaths, resourceBundles],
  );
  const resourcePreflightMatches =
    resourcePreflight.resourceKey === resourceKey;
  const resourcePreflightStatus = resourcePreflightMatches
    ? resourcePreflight.status
    : "idle";
  const debugReadiness = useMemo(
    () =>
      getDebugReadiness({
        localBridgeConnected: connected,
        deviceConnectionStatus: mfwState.connectionStatus,
        controllerId: mfwState.controllerId,
        resourceStatus: resourcePreflightStatus,
        resourceError: resourcePreflightMatches
          ? resourcePreflight.error
          : undefined,
      }),
    [
      connected,
      mfwState.connectionStatus,
      mfwState.controllerId,
      resourcePreflight.error,
      resourcePreflightMatches,
      resourcePreflightStatus,
    ],
  );
  const debugReadinessDescription = useMemo(
    () => formatDebugReadinessMessage(debugReadiness),
    [debugReadiness],
  );

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

  useEffect(() => {
    if (!modalOpen) return;
    if (!connected) {
      invalidateResourcePreflight();
      return;
    }
    if (resolvedResourcePaths.length === 0) {
      invalidateResourcePreflight();
      return;
    }
    if (
      resourcePreflight.resourceKey === resourceKey &&
      resourcePreflight.status !== "idle"
    ) {
      return;
    }

    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setResourcePreflightChecking(requestId, resourceKey);
    const sent = debugProtocolClient.preflightResources({
      requestId,
      resourcePaths: resolvedResourcePaths,
    });
    if (!sent) {
      setResourcePreflightError(
        requestId,
        resourceKey,
        "发送资源加载检测请求失败。",
      );
    }
  }, [
    connected,
    invalidateResourcePreflight,
    modalOpen,
    resolvedResourcePaths,
    resourceKey,
    resourcePreflight.resourceKey,
    resourcePreflight.status,
    setResourcePreflightError,
    setResourcePreflightChecking,
  ]);

  useEffect(() => {
    if (!modalOpen || !connected || activePanel !== "images") return;
    if (imageList.length > 0 || imageListLoading) return;
    resourceProtocol.requestImageList();
  }, [activePanel, connected, imageList.length, imageListLoading, modalOpen]);

  const runModes = useMemo(() => debugContributionRegistry.getRunModes(), []);

  const availableModeIds = useMemo(
    () => new Set(capabilities?.runModes ?? runModes.map((mode) => mode.id)),
    [capabilities, runModes],
  );

  const nodeExecutionController = useDebugNodeExecutionController({
    artifacts,
    flowNodes,
    liveSummary,
    nodeExecutionAttributionMode,
    nodeExecutionFilters,
    performanceSummary,
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
  const performanceRefs = useMemo(() => selectPerformanceRefs(events), [events]);
  const batchSummaryRefs = useMemo(() => selectBatchSummaryRefs(events), [events]);
  const selectedDisplaySession = useMemo(
    () =>
      displaySessions.find((item) => item.id === selectedDisplaySessionIds[0]) ??
      displaySessions[0],
    [displaySessions, selectedDisplaySessionIds],
  );
  const agentDiagnostics = diagnosticsState.diagnostics.filter((diagnostic) =>
    diagnostic.code.startsWith("debug.agent."),
  );

  const startRun = (
    mode: DebugRunMode,
    nodeId?: string,
    input?: DebugRunRequest["input"],
  ) => {
    if (mode === "action-only" && !input?.confirmAction) {
      confirmActionRun(nodeId);
      return;
    }
    clearProtocolError();
    if (!debugReadiness.ready) {
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
      const request = profileState.buildRunRequest(
        mode,
        nodeId,
        session?.sessionId,
        input,
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
      useDebugAiSummaryStore.getState().reset();
      setLastRunMode(mode);
      if (request.target) {
        profileState.setEntry(request.target);
        setLastEntryNodeId(request.target.nodeId);
        selectNode(
          flowNodes.some((node) => node.id === request.target?.nodeId)
            ? request.target.nodeId
            : undefined,
        );
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "生成调试请求失败");
    }
  };

  function confirmActionRun(nodeId?: string) {
    showActionRunConfirm(() =>
      startRun("action-only", nodeId, { confirmAction: true }),
    );
  }

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
        setActivePanel("images");
        setLastPanel("images");
      },
    );
  };

  const startScreenshotStream = () => {
    startScreenshotStreamAction(
      {
        client: debugProtocolClient,
        config: profileState.screenshotStreamConfig,
        connected,
        controllerId: mfwState.controllerId ?? undefined,
        runId: activeRun?.runId,
        sessionId: session?.sessionId,
      },
      () => {
        setActivePanel("images");
        setLastPanel("images");
      },
    );
  };

  const stopScreenshotStream = () => {
    stopScreenshotStreamAction({
      client: debugProtocolClient,
      runId: activeRun?.runId,
      sessionId: session?.sessionId,
    });
  };

  const requestTraceSnapshot = () => {
    requestTraceSnapshotAction({
      activeRunId: summary.runId ?? activeRun?.runId,
      client: debugProtocolClient,
      sessionId: summary.sessionId ?? session?.sessionId,
    });
  };

  const startBatchRecognition = () => {
    if (!debugReadiness.ready) {
      message.error(debugReadiness.issues[0]?.message ?? "调试前置条件未满足");
      return;
    }
    if (!selectedNodeId) {
      message.warning("请选择节点");
      return;
    }
    const selectedImages: DebugBatchRecognitionInput[] =
      profileState.batchRecognitionImages.length > 0
        ? profileState.batchRecognitionImages
        : imageList
            .slice(0, 50)
            .map((image) => ({ imageRelativePath: image.relativePath }));
    if (selectedImages.length === 0) {
      message.warning("请先刷新并选择资源（Resource）图片");
      return;
    }
    try {
      const baseRequest = profileState.buildRunRequest(
        "fixed-image-recognition",
        selectedNodeId,
        session?.sessionId,
      );
      if (!baseRequest.target) {
        message.error("批量识别缺少目标节点（Target）");
        return;
      }
      const sent = debugProtocolClient.startBatchRecognition({
        sessionId: baseRequest.sessionId,
        profileId: baseRequest.profileId,
        profile: baseRequest.profile,
        graphSnapshot: baseRequest.graphSnapshot,
        resolverSnapshot: baseRequest.resolverSnapshot,
        target: baseRequest.target,
        overrides: baseRequest.overrides,
        artifactPolicy: baseRequest.artifactPolicy,
        images: selectedImages,
        agentMetadata: profileState.profile.agents.map((agent) => ({
          id: agent.id,
          enabled: agent.enabled,
          transport: agent.transport,
          required: agent.required ?? true,
          timeoutMs: agent.timeoutMs,
          identifier: agent.identifier,
          tcpPort: agent.tcpPort,
          status: agent.enabled ? "configured" : "disabled",
        })),
      });
      if (!sent) message.error("发送批量识别请求失败");
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "生成批量识别请求失败",
      );
    }
  };

  const stopBatchRecognition = () => {
    if (!session?.sessionId) {
      message.warning("当前没有调试会话（Session）");
      return;
    }
    const latestBatch = [...events]
      .reverse()
      .find((event) => event.data?.mode === "batch-recognition");
    const sent = debugProtocolClient.stopBatchRecognition({
      sessionId: session.sessionId,
      batchId:
        typeof latestBatch?.data?.batchId === "string"
          ? latestBatch.data.batchId
          : undefined,
      reason: "user_stop",
    });
    if (!sent) message.error("发送批量识别停止请求失败");
  };

  const testAgent = (agent: DebugAgentProfile) => {
    testAgentAction({
      agent,
      client: debugProtocolClient,
      connected,
      setTestingAgentIds,
    });
  };

  const requestResourcePreflight = () => {
    requestResourcePreflightAction({
      client: debugProtocolClient,
      connected,
      invalidateResourcePreflight,
      resourceKey,
      resourcePaths: resolvedResourcePaths,
      setResourcePreflightChecking,
      setResourcePreflightError,
    });
  };

  const updateResourcePaths = (resourcePaths: string[]) => {
    profileState.setResourcePaths(resourcePaths);
    invalidateResourcePreflight();
  };

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

  const generateDebugAiSummary = useCallback(
    async (
      focus: DebugAiSummaryFocus = "full",
      record?: DebugNodeExecutionRecord,
      options: { automatic?: boolean } = {},
    ) => {
      const targetRecord =
        focus === "node"
          ? record ?? nodeExecutionController.selectedNodeExecutionRecord
          : undefined;
      const target = {
        kind: focus === "node" ? "node" as const : "run" as const,
        sessionId:
          targetRecord?.sessionId ??
          summary.sessionId ??
          selectedDisplaySession?.sessionId,
        runId:
          targetRecord?.runId ?? summary.runId ?? selectedDisplaySession?.runId,
        displaySessionId: selectedDisplaySession?.id,
        nodeRecordId: focus === "node" ? targetRecord?.id : undefined,
        nodeLabel:
          focus === "node"
            ? (targetRecord?.label ?? targetRecord?.runtimeName)
            : undefined,
      };
      const targetId = debugAiSummaryTargetKey(target);
      if (options.automatic) {
        aiSummaryState.markAutoRequested(targetId);
      }
      if (events.length === 0) {
        const error = "当前没有可总结的调试事件。";
        aiSummaryState.setError(error);
        if (!options.automatic) message.warning(error);
        return;
      }
      if (focus === "node" && !targetRecord) {
        const error = "请先选择要解释的节点执行记录。";
        aiSummaryState.setError(error);
        if (!options.automatic) message.warning(error);
        return;
      }
      aiSummaryState.setGenerating(target);
      try {
        const { prompt, contextText } = buildDebugAiSummaryPrompt({
          focus,
          sessionId: target.sessionId,
          runId: target.runId,
          displaySessionId: target.displaySessionId,
          status: selectedDisplaySession?.status ?? summary.status,
          mode: selectedDisplaySession?.mode ?? summary.runMode,
          events,
          diagnostics: diagnosticsState.diagnostics,
          artifacts,
          performanceSummary,
          nodeRecords: nodeExecutionController.allNodeExecutionRecords,
          selectedNodeRecord: targetRecord,
        });
        const client = new AIClient({
          historyLimit: 0,
          systemPrompt: "你是 MaaPipelineEditor 的调试报告助手，只根据给定上下文输出 JSON。",
        });
        const result = await client.send(prompt, "生成调试 AI 总结");
        if (!result.success) {
          throw new Error(result.error || "AI 总结生成失败");
        }
        const parsed = parseDebugAiSummaryResponse(result.content);
        aiSummaryState.setReport({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          target: {
            ...target,
            generatedAt: new Date().toISOString(),
          },
          focus,
          simpleSummary: parsed.simpleSummary,
          detailedReport: parsed.detailedReport,
          prompt,
          contextText,
          rawResponse: result.content,
          generatedAt: new Date().toISOString(),
        });
        if (!options.automatic) {
          message.success("AI 总结已生成");
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "AI 总结生成失败";
        aiSummaryState.setError(errorMessage);
        if (!options.automatic) message.error(errorMessage);
      }
    },
    [
      aiSummaryState,
      artifacts,
      diagnosticsState.diagnostics,
      events,
      nodeExecutionController.allNodeExecutionRecords,
      nodeExecutionController.selectedNodeExecutionRecord,
      performanceSummary,
      selectedDisplaySession,
      summary.runMode,
      summary.runId,
      summary.sessionId,
      summary.status,
    ],
  );

  const handlePanelClick = (panel: DebugModalPanel) => {
    setActivePanel(panel);
    setLastPanel(panel);
  };

  const openAiSummaryPanel = () => {
    setActivePanel("ai-summary");
    setLastPanel("ai-summary");
  };

  useEffect(() => {
    if (!autoGenerateAiSummary) return;
    if (aiSummaryState.status === "generating") return;
    const latestSession = displaySessions[0];
    if (!latestSession || !isTerminalDebugSessionStatus(latestSession.status)) {
      return;
    }
    const targetId = debugAiSummaryTargetKey({
      kind: "run",
      sessionId: latestSession.sessionId,
      runId: latestSession.runId,
    });
    if (aiSummaryState.autoRequestedTargetIds.includes(targetId)) return;
    void generateDebugAiSummary("full", undefined, { automatic: true });
  }, [
    aiSummaryState.autoRequestedTargetIds,
    aiSummaryState.status,
    autoGenerateAiSummary,
    displaySessions,
    generateDebugAiSummary,
  ]);

  const openNodeExecutionRecord = (
    record: Parameters<
      typeof nodeExecutionController.openNodeExecutionRecord
    >[0],
  ) => {
    nodeExecutionController.openNodeExecutionRecord(record);
    setActivePanel("node-execution");
    setLastPanel("node-execution");
  };

  const requestImageList = () => {
    resourceProtocol.requestImageList();
  };

  return {
    modalOpen,
    activePanel,
    capabilities,
    capabilityStatus,
    capabilityError,
    session,
    activeRun,
    screenshotStream,
    agentTestResults,
    lastError,
    selectedNodeId,
    closeModal,
    connected,
    lastRunMode,
    autoGenerateAiSummary,
    aiSummaryState,
    allEvents,
    events,
    displaySessions,
    selectedDisplaySessionIds,
    latestDisplaySessionId,
    summary,
    liveSummary,
    performanceSummary,
    selectedPerformanceSummaries,
    artifacts,
    selectedArtifactId,
    selectedArtifact,
    diagnosticsState,
    profileState,
    resourceBundles,
    imageList,
    imageListBundleName,
    imageListLoading,
    mfwState,
    controllerDisplayName,
    flowNodes,
    selectedFlowNodeId,
    resolvedResourcePaths,
    resourceKey,
    resourcePreflight,
    resourcePreflightStatus,
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
    batchRecognitionNodeSummaries:
      nodeExecutionController.batchRecognitionNodeSummaries,
    nodeExecutionRecords: nodeExecutionController.nodeExecutionRecords,
    nodeExecutionAttributionMode,
    nodeExecutionDetailMode,
    nodeExecutionFilters: nodeExecutionController.nodeExecutionFilters,
    selectedNodeExecutionRecord: nodeExecutionController.selectedNodeExecutionRecord,
    selectedNodeExecutionRecordId: nodeExecutionController.selectedNodeExecutionRecordId,
    selectedNodeExecutionAttempt: nodeExecutionController.selectedNodeExecutionAttempt,
    selectedNodeExecutionAttemptId: nodeExecutionController.selectedNodeExecutionAttemptId,
    performanceRefs,
    batchSummaryRefs,
    agentDiagnostics,
    testingAgentIds,
    startRun,
    confirmActionRun,
    stopRun,
    captureScreenshot,
    startScreenshotStream,
    stopScreenshotStream,
    requestTraceSnapshot,
    selectDisplaySessions,
    selectLatestDisplaySession,
    selectAllDisplaySessions,
    startBatchRecognition,
    stopBatchRecognition,
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
    invalidateResourcePreflight,
    updateResourcePaths,
    requestArtifact,
    handlePanelClick,
    openAiSummaryPanel,
    generateDebugAiSummary,
    setAutoGenerateAiSummary,
    requestImageList,
  };
}

export type DebugModalController = ReturnType<typeof useDebugModalController>;

function isTerminalDebugSessionStatus(status?: string): boolean {
  return status === "completed" || status === "failed" || status === "stopped";
}
