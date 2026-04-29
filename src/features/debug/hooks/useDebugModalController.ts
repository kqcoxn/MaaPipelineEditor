import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, message } from "antd";
import { useShallow } from "zustand/shallow";
import { debugProtocolClient, resourceProtocol } from "../../../services/server";
import { useDebugSessionStore } from "../../../stores/debugSessionStore";
import { useDebugModalMemoryStore } from "../../../stores/debugModalMemoryStore";
import { useDebugTraceStore } from "../../../stores/debugTraceStore";
import { useDebugArtifactStore } from "../../../stores/debugArtifactStore";
import { useDebugDiagnosticsStore } from "../../../stores/debugDiagnosticsStore";
import {
  makeDebugResourceKey,
  normalizeDebugResourcePaths,
  useDebugRunProfileStore,
} from "../../../stores/debugRunProfileStore";
import { useLocalFileStore } from "../../../stores/localFileStore";
import {
  useMFWStore,
  type DeviceInfo,
  type DeviceType,
} from "../../../stores/mfwStore";
import { useWSStore } from "../../../stores/wsStore";
import { useFlowStore } from "../../../stores/flow";
import { debugContributionRegistry } from "../contributions/registry";
import { buildDebugSnapshotBundle } from "../snapshot";
import { applyDebugNodeTarget } from "../nodeTargetActions";
import {
  formatDebugReadinessMessage,
  getDebugReadiness,
} from "../readiness";
import {
  runnableModes,
  targetRunModes,
  validateRunRequest,
} from "../modalUtils";
import type {
  DebugBatchRecognitionInput,
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
    screenshotStream,
    agentTestResults,
    lastError,
    selectedNodeId,
    closeModal,
    setActivePanel,
    selectNode,
    setCapabilitiesLoading,
    setCapabilitiesError,
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
      setCapabilitiesLoading: state.setCapabilitiesLoading,
      setCapabilitiesError: state.setCapabilitiesError,
      resourcePreflight: state.resourcePreflight,
      setResourcePreflightChecking: state.setResourcePreflightChecking,
      setResourcePreflightError: state.setResourcePreflightError,
      invalidateResourcePreflight: state.invalidateResourcePreflight,
      clearProtocolError: state.clearProtocolError,
    })),
  );
  const connected = useWSStore((state) => state.connected);
  const { lastRunMode, setLastPanel, setLastRunMode, setLastEntryNodeId } =
    useDebugModalMemoryStore();
  const { events, summary, liveSummary, replayStatus, performanceSummary } =
    useDebugTraceStore(
      useShallow((state) => ({
        events: state.events,
        summary: state.summary,
        liveSummary: state.liveSummary,
        replayStatus: state.replayStatus,
        performanceSummary: state.performanceSummary,
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
    if (!modalOpen || !connected || capabilities) return;
    setCapabilitiesLoading();
    const sent = debugProtocolClient.requestCapabilities();
    if (!sent) {
      setCapabilitiesError("LocalBridge 未连接，暂时无法读取调试能力。");
    }
  }, [
    modalOpen,
    connected,
    capabilities,
    setCapabilitiesLoading,
    setCapabilitiesError,
  ]);

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

  const pipelineNodes = useMemo(
    () =>
      buildDebugSnapshotBundle().resolverSnapshot.nodes.filter((node) =>
        flowNodes.some((flowNode) => flowNode.id === node.nodeId),
      ),
    [flowNodes],
  );
  const selectedPipelineNode = useMemo(
    () => pipelineNodes.find((node) => node.nodeId === selectedNodeId),
    [pipelineNodes, selectedNodeId],
  );
  const selectedPipelineNodeId = selectedPipelineNode?.nodeId;
  const entryNode = useMemo(() => {
    const entry = profileState.profile.entry;
    return pipelineNodes.find((node) => {
      if (entry.nodeId && node.nodeId === entry.nodeId) return true;
      if (
        entry.fileId &&
        entry.runtimeName &&
        node.fileId === entry.fileId &&
        node.runtimeName === entry.runtimeName
      ) {
        return true;
      }
      return Boolean(entry.runtimeName && node.runtimeName === entry.runtimeName);
    });
  }, [pipelineNodes, profileState.profile.entry]);

  const selectedArtifact = selectedArtifactId
    ? artifacts[selectedArtifactId]
    : undefined;
  const performanceRefs = useMemo(
    () =>
      events
        .filter(
          (event) =>
            event.detailRef &&
            typeof event.data?.performanceSummaryRef === "string",
        )
        .map((event) => event.detailRef as string),
    [events],
  );
  const batchSummaryRefs = useMemo(
    () =>
      events
        .filter(
          (event) =>
            event.detailRef && event.data?.mode === "batch-recognition",
        )
        .map((event) => event.detailRef as string),
    [events],
  );
  const agentDiagnostics = diagnosticsState.diagnostics.filter((diagnostic) =>
    diagnostic.code.startsWith("debug.agent."),
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

  const setEntryFromSelectedNode = useCallback(() => {
    applyDebugNodeTarget(selectedPipelineNodeId, {
      setEntry: true,
      rememberEntryNodeId: true,
      successMessage: "已设为调试入口节点",
    });
  }, [selectedPipelineNodeId]);

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
      setLastRunMode(mode);
      if (request.target) {
        profileState.setEntry(request.target);
        setLastEntryNodeId(request.target.nodeId);
        selectNode(request.target.nodeId);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "生成调试请求失败");
    }
  };

  function confirmActionRun(nodeId?: string) {
    Modal.confirm({
      title: "确认执行动作",
      content: "仅动作模式会跳过识别，直接执行目标节点动作（Action）。",
      okText: "确认执行",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: () => startRun("action-only", nodeId, { confirmAction: true }),
    });
  }

  const stopRun = () => {
    if (!session?.sessionId) {
      message.warning("当前没有调试会话（Session）");
      return;
    }
    const sent = debugProtocolClient.stopRun({
      sessionId: session.sessionId,
      runId: activeRun?.runId,
      reason: "user_stop",
    });
    if (!sent) message.error("发送停止请求失败");
  };

  const captureScreenshot = () => {
    if (!connected) {
      message.error("LocalBridge 未连接");
      return;
    }
    if (!mfwState.controllerId) {
      message.error("请先连接 MaaFramework 控制器（Controller）");
      return;
    }
    const sent = debugProtocolClient.captureScreenshot({
      sessionId: session?.sessionId,
      controllerId: mfwState.controllerId,
      force: true,
    });
    if (!sent) {
      message.error("发送截图请求失败");
      return;
    }
    setActivePanel("images");
    setLastPanel("images");
  };

  const startScreenshotStream = () => {
    if (!connected) {
      message.error("LocalBridge 未连接");
      return;
    }
    if (!mfwState.controllerId) {
      message.error("请先连接 MaaFramework 控制器（Controller）");
      return;
    }
    const sent = debugProtocolClient.startScreenshotStream({
      sessionId: session?.sessionId,
      runId: activeRun?.runId,
      controllerId: mfwState.controllerId,
      ...profileState.screenshotStreamConfig,
      intervalMs: Math.max(
        250,
        profileState.screenshotStreamConfig.intervalMs || 1000,
      ),
    });
    if (!sent) {
      message.error("发送截图推流启动请求失败");
      return;
    }
    setActivePanel("images");
    setLastPanel("images");
  };

  const stopScreenshotStream = () => {
    if (!session?.sessionId) {
      message.warning("当前没有调试会话（Session）");
      return;
    }
    const sent = debugProtocolClient.stopScreenshotStream({
      sessionId: session.sessionId,
      runId: activeRun?.runId,
      reason: "user_stop",
    });
    if (!sent) message.error("发送截图推流停止请求失败");
  };

  const requestTraceSnapshot = () => {
    if (!session?.sessionId) {
      message.warning("当前没有调试会话（Session）");
      return;
    }
    const sent = debugProtocolClient.requestTraceSnapshot({
      sessionId: session.sessionId,
      runId: activeRun?.runId,
    });
    if (!sent) message.error("发送追踪快照（Trace Snapshot）请求失败");
  };

  const startTraceReplay = () => {
    if (!session?.sessionId) {
      message.warning("当前没有调试会话（Session）");
      return;
    }
    const sent = debugProtocolClient.startTraceReplay({
      sessionId: session.sessionId,
      runId: summary.runId,
      cursorSeq: replayStatus?.cursorSeq || events[0]?.seq,
      nodeId: selectedNodeId,
      speed: replayStatus?.speed ?? 1,
    });
    if (!sent) message.error("发送追踪回放（Trace Replay）启动请求失败");
  };

  const seekTraceReplay = (cursorSeq?: number) => {
    if (!session?.sessionId) {
      message.warning("当前没有调试会话（Session）");
      return;
    }
    const sent = debugProtocolClient.seekTraceReplay({
      sessionId: session.sessionId,
      runId: summary.runId,
      cursorSeq,
      nodeId: replayStatus?.nodeId,
      speed: replayStatus?.speed ?? 1,
    });
    if (!sent) message.error("发送追踪回放定位（Trace Replay Seek）请求失败");
  };

  const stopTraceReplay = () => {
    if (!session?.sessionId) {
      useDebugTraceStore.getState().stopTraceReplay();
      return;
    }
    const sent = debugProtocolClient.stopTraceReplay({
      sessionId: session.sessionId,
      reason: "user_stop",
    });
    if (!sent) {
      useDebugTraceStore.getState().stopTraceReplay();
      message.error("发送追踪回放（Trace Replay）停止请求失败");
    }
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
    if (!connected) {
      message.error("LocalBridge 未连接");
      return;
    }
    if (agent.transport === "tcp") {
      if (!agent.tcpPort || agent.tcpPort <= 0 || agent.tcpPort > 65535) {
        message.warning("请输入 1-65535 范围内的 TCP 端口");
        return;
      }
    } else if (!agent.identifier?.trim()) {
      message.warning("请输入代理标识符（Identifier）");
      return;
    }
    const agentId = agent.id.trim() || "agent";
    setTestingAgentIds((current) => new Set(current).add(agentId));
    const sent = debugProtocolClient.testAgent({
      agent: {
        ...agent,
        id: agentId,
        enabled: true,
      },
    });
    if (!sent) {
      setTestingAgentIds((current) => {
        const next = new Set(current);
        next.delete(agentId);
        return next;
      });
      message.error("发送代理连接测试请求失败");
    }
  };

  const requestResourcePreflight = () => {
    if (!connected) {
      message.error("LocalBridge 未连接");
      return;
    }
    if (resolvedResourcePaths.length === 0) {
      invalidateResourcePreflight();
      message.warning("请先配置资源路径或等待 LocalBridge 扫描资源包");
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
      message.error("发送资源加载检测请求失败");
    }
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

  const handlePanelClick = (panel: DebugModalPanel) => {
    setActivePanel(panel);
    setLastPanel(panel);
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
    events,
    summary,
    liveSummary,
    replayStatus,
    performanceSummary,
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
    resolvedResourcePaths,
    resourceKey,
    resourcePreflight,
    resourcePreflightStatus,
    debugReadiness,
    debugReadinessDescription,
    runModes,
    availableModeIds,
    pipelineNodes,
    selectedPipelineNode,
    selectedPipelineNodeId,
    entryNode,
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
    startTraceReplay,
    seekTraceReplay,
    stopTraceReplay,
    startBatchRecognition,
    stopBatchRecognition,
    testAgent,
    selectPipelineNode,
    setEntryFromSelectedNode,
    requestResourcePreflight,
    invalidateResourcePreflight,
    updateResourcePaths,
    requestArtifact,
    handlePanelClick,
    requestImageList,
  };
}

export type DebugModalController = ReturnType<typeof useDebugModalController>;

function getControllerDisplayName(
  deviceInfo: DeviceInfo,
  controllerId: string | null,
  controllerType: DeviceType,
): string {
  if (!deviceInfo || typeof deviceInfo !== "object") {
    return controllerId ?? "未连接";
  }
  const info = deviceInfo as Record<string, unknown>;
  const keys =
    controllerType === "win32"
      ? ["window_name", "class_name", "hwnd"]
      : controllerType === "macos"
        ? ["app_name", "name", "pid"]
        : ["name", "address", "socket_path", "uuid"];
  for (const key of keys) {
    const value = info[key];
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }
  return controllerId ?? "未连接";
}
