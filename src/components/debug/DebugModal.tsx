import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  Alert,
  Button,
  Checkbox,
  Collapse,
  Empty,
  Input,
  InputNumber,
  List,
  Modal,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
  message,
} from "antd";
import {
  ApiOutlined,
  BranchesOutlined,
  CaretRightOutlined,
  DeleteOutlined,
  FileSearchOutlined,
  NodeIndexOutlined,
  PlusOutlined,
  PictureOutlined,
  ProfileOutlined,
  ReloadOutlined,
  SettingOutlined,
  StepForwardOutlined,
  StopOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { useShallow } from "zustand/shallow";
import { debugProtocolClient, resourceProtocol } from "../../services/server";
import { useDebugSessionStore } from "../../stores/debugSessionStore";
import { useDebugModalMemoryStore } from "../../stores/debugModalMemoryStore";
import { useDebugTraceStore } from "../../stores/debugTraceStore";
import { useDebugArtifactStore } from "../../stores/debugArtifactStore";
import { useDebugDiagnosticsStore } from "../../stores/debugDiagnosticsStore";
import {
  makeDebugResourceKey,
  normalizeDebugResourcePaths,
  useDebugRunProfileStore,
} from "../../stores/debugRunProfileStore";
import { useLocalFileStore } from "../../stores/localFileStore";
import { useMFWStore } from "../../stores/mfwStore";
import { useWSStore } from "../../stores/wsStore";
import { useFlowStore } from "../../stores/flow";
import type {
  DebugArtifactPolicy,
  DebugBatchRecognitionInput,
  DebugDiagnostic,
  DebugEvent,
  DebugEventKind,
  DebugModalPanel,
  DebugRunMode,
  DebugRunRequest,
} from "../../features/debug/types";
import { debugContributionRegistry } from "../../features/debug/contributions/registry";
import { buildDebugSnapshotBundle } from "../../features/debug/snapshot";
import {
  getAgentTransportLabel,
  getArtifactCapabilityLabel,
  getControllerLabel,
  getDebugFeatureLabel,
  getDebugStatusLabel,
  getDiagnosticCapabilityLabel,
  getProfileFeatureLabel,
  getResourceApiLabel,
  getRunModeLabel,
  getScreenshotSourceLabel,
  getTaskerApiLabel,
  getUnavailableReasonLabel,
} from "../../features/debug/capabilityLabels";
import {
  formatDebugReadinessMessage,
  getDebugReadiness,
} from "../../features/debug/readiness";
import "../../features/debug/contributions/runModes";
import "../../features/debug/contributions/modalContributions";

const { Text, Title } = Typography;

interface PanelItem {
  id: DebugModalPanel;
  label: string;
  icon: ReactNode;
  description: string;
}

const panels: PanelItem[] = [
  {
    id: "overview",
    label: "中控台",
    icon: <ProfileOutlined />,
    description: "查看依赖状态、会话状态、能力清单和当前运行摘要。",
  },
  {
    id: "setup",
    label: "运行配置",
    icon: <SettingOutlined />,
    description:
      "配置接口导入、资源路径、控制器、截图和 Agent，并写入本地调试配置。",
  },
  {
    id: "nodes",
    label: "节点",
    icon: <NodeIndexOutlined />,
    description:
      "选择入口或目标节点，发起节点级调试，并查看当前会话内的节点回放。",
  },
  {
    id: "timeline",
    label: "时间线",
    icon: <BranchesOutlined />,
    description:
      "按后端 seq 查看 append-only trace，并在当前会话内定位或回放事件。",
  },
  {
    id: "performance",
    label: "性能",
    icon: <StepForwardOutlined />,
    description: "查看运行结束后的性能摘要、慢节点统计和相关产物。",
  },
  {
    id: "images",
    label: "图像",
    icon: <PictureOutlined />,
    description: "管理实时截图、固定图输入、批量识别图片和图像产物预览。",
  },
  {
    id: "diagnostics",
    label: "诊断",
    icon: <ApiOutlined />,
    description: "查看启动前检查、运行时诊断和资源/控制器/Agent 问题。",
  },
  {
    id: "logs",
    label: "日志",
    icon: <UnorderedListOutlined />,
    description: "查看 session、task 和 MaaFW 原始消息相关的结构化日志事件。",
  },
];

const runnableModes = new Set<DebugRunMode>([
  "full-run",
  "run-from-node",
  "single-node-run",
  "recognition-only",
  "action-only",
  "fixed-image-recognition",
]);

const targetRunModes = new Set<DebugRunMode>([
  "run-from-node",
  "single-node-run",
  "recognition-only",
  "action-only",
  "fixed-image-recognition",
]);

function dataArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringArray(value: unknown): string[] {
  return dataArray(value).filter(
    (item): item is string => typeof item === "string",
  );
}
function formatTime(value?: string): string {
  if (!value) return "-";
  return new Date(value).toLocaleTimeString();
}

const debugSectionStyle: CSSProperties = {
  border: "1px solid rgba(5, 5, 5, 0.08)",
  borderRadius: 6,
  padding: 14,
  background: "#fff",
};

const navStyle: CSSProperties = {
  width: 168,
  flexShrink: 0,
  borderRight: "1px solid rgba(5, 5, 5, 0.08)",
  paddingRight: 12,
};

const scrollMainStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  height: "clamp(520px, calc(100vh - 220px), 680px)",
  overflowY: "scroll",
  overflowX: "hidden",
  scrollbarGutter: "stable",
  paddingRight: 4,
};

const modalBodyStyle: CSSProperties = {
  display: "flex",
  gap: 16,
  height: "clamp(520px, calc(100vh - 220px), 680px)",
  minHeight: 520,
  overflow: "hidden",
};

function eventTitle(event: DebugEvent): string {
  return [
    `#${event.seq}`,
    event.kind,
    event.phase,
    event.node?.label ?? event.node?.runtimeName,
  ]
    .filter(Boolean)
    .join(" · ");
}

function renderEventMeta(event: DebugEvent): ReactNode {
  return (
    <Space wrap size={4}>
      <Tag>{formatTime(event.timestamp)}</Tag>
      <Tag color={event.source === "maafw" ? "blue" : "default"}>
        {event.source}
      </Tag>
      {event.maafwMessage && <Tag>{event.maafwMessage}</Tag>}
      {event.detailRef && <Tag color="purple">详情</Tag>}
      {event.screenshotRef && <Tag color="cyan">图像</Tag>}
    </Space>
  );
}

function validateRunRequest(request: DebugRunRequest): DebugDiagnostic[] {
  const diagnostics: DebugDiagnostic[] = [];
  if (!request.profile.controller.options.controllerId) {
    diagnostics.push({
      severity: "error",
      code: "debug.controller.missing",
      message:
        "设备未连接：缺少已连接控制器（Controller），无法启动调试。",
    });
  }
  if (request.profile.resourcePaths.length === 0) {
    diagnostics.push({
      severity: "error",
      code: "debug.resource.empty",
      message:
        "资源路径（Resource Paths）为空，请配置资源路径或刷新 LocalBridge 资源包（Resource Bundle）。",
    });
  }
  if (!request.graphSnapshot.files.length) {
    diagnostics.push({
      severity: "error",
      code: "debug.graph.empty",
      message: "当前图快照为空，无法启动调试。",
    });
  }
  if (!request.resolverSnapshot.nodes.length) {
    diagnostics.push({
      severity: "error",
      code: "debug.resolver.empty",
      message: "当前没有可映射到运行时的 Pipeline 节点。",
    });
  }
  if (request.mode === "full-run" && !request.profile.entry.runtimeName) {
    diagnostics.push({
      severity: "error",
      code: "debug.entry.missing",
      message: "完整运行缺少调试配置入口。",
    });
  }
  if (targetRunModes.has(request.mode) && !request.target?.runtimeName) {
    diagnostics.push({
      severity: "error",
      code: "debug.target.missing",
      message: "节点级调试缺少目标节点（Target）。",
    });
  }
  if (
    request.mode === "fixed-image-recognition" &&
    !request.input?.imageRelativePath &&
    !request.input?.imagePath
  ) {
    diagnostics.push({
      severity: "error",
      code: "debug.fixed_image.missing",
      message: "固定图识别需要先选择资源（Resource）相对图片或输入图片路径。",
    });
  }
  if (request.mode === "action-only" && !request.input?.confirmAction) {
    diagnostics.push({
      severity: "error",
      code: "debug.action.confirm_missing",
      message: "仅动作模式需要危险操作确认。",
    });
  }
  return diagnostics;
}

function DebugSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section style={debugSectionStyle}>
      <Title level={5} style={{ marginTop: 0 }}>
        {title}
      </Title>
      {children}
    </section>
  );
}

export function DebugModal() {
  const [interfaceImportPath, setInterfaceImportPath] = useState("");
  const {
    modalOpen,
    activePanel,
    capabilities,
    capabilityStatus,
    capabilityError,
    session,
    activeRun,
    screenshotStream,
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
  const { events, summary, liveSummary, replayStatus, performanceSummary } = useDebugTraceStore(
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
  const {
    resourceBundles,
    imageList,
    imageListBundleName,
    imageListLoading,
  } = useLocalFileStore(
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
    })),
  );
  const flowNodes = useFlowStore((state) => state.nodes);
  const resolvedResourcePaths = useMemo(
    () =>
      normalizeDebugResourcePaths(
        profileState.profile.resourcePaths,
        resourceBundles,
      ),
    [profileState.profile.resourcePaths, resourceBundles],
  );
  const resourceKey = useMemo(
    () => makeDebugResourceKey(profileState.profile.resourcePaths, resourceBundles),
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
  const activePanelMeta =
    panels.find((panel) => panel.id === activePanel) ?? panels[0];

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

  const selectedArtifact = selectedArtifactId
    ? artifacts[selectedArtifactId]
    : undefined;
  const selectedFlowNode = flowNodes.find((node) => node.id === selectedNodeId);
  const selectedNodeDetail = selectedFlowNode?.data as
    | {
        label?: string;
        recognition?: unknown;
        action?: unknown;
        others?: Record<string, unknown>;
      }
    | undefined;
  const selectedNodeReplays = selectedNodeId
    ? summary.nodeReplays[selectedNodeId] ?? []
    : [];
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
      diagnosticsState.setPreflightDiagnostics([
        ...diagnostics,
      ]);
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
    if (!sent) message.error("发送截图请求失败");
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
    if (!sent) message.error("发送截图推流启动请求失败");
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
          launchMode: agent.launchMode,
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

  const importInterface = () => {
    const path = interfaceImportPath.trim();
    if (!path) {
      message.warning("请输入 interface.json 路径");
      return;
    }
    const sent = debugProtocolClient.importInterface({ path });
    if (!sent) message.error("发送 interface 导入请求失败");
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

  const renderOverview = () => (
    <Space direction="vertical" size={14} style={{ width: "100%" }}>
      {capabilityStatus === "error" && (
        <Alert
          type="error"
          showIcon
          message="调试能力读取失败"
          description={capabilityError}
        />
      )}
      {lastError && (
        <Alert
          type="error"
          showIcon
          message={lastError.code}
          description={lastError.message}
        />
      )}
      <DebugSection title="运行控制">
        <Space wrap>
          <Button
            type="primary"
            icon={<CaretRightOutlined />}
            onClick={() => startRun("full-run")}
            disabled={!debugReadiness.ready || !availableModeIds.has("full-run")}
          >
            完整运行
          </Button>
          <Button
            icon={<CaretRightOutlined />}
            onClick={() => startRun("run-from-node", selectedNodeId)}
            disabled={
              !debugReadiness.ready ||
              !selectedNodeId ||
              !availableModeIds.has("run-from-node")
            }
          >
            从选中节点运行
          </Button>
          <Button
            icon={<CaretRightOutlined />}
            onClick={() => startRun("single-node-run", selectedNodeId)}
            disabled={
              !debugReadiness.ready ||
              !selectedNodeId ||
              !availableModeIds.has("single-node-run")
            }
          >
            单节点运行
          </Button>
          <Button
            icon={<FileSearchOutlined />}
            onClick={() => startRun("recognition-only", selectedNodeId)}
            disabled={
              !debugReadiness.ready ||
              !selectedNodeId ||
              !availableModeIds.has("recognition-only")
            }
          >
            仅识别
          </Button>
          <Button
            danger
            icon={<CaretRightOutlined />}
            onClick={() => confirmActionRun(selectedNodeId)}
            disabled={
              !debugReadiness.ready ||
              !selectedNodeId ||
              !availableModeIds.has("action-only")
            }
          >
            仅动作
          </Button>
          <Button
            icon={<PictureOutlined />}
            onClick={() => startRun("fixed-image-recognition", selectedNodeId)}
            disabled={
              !debugReadiness.ready ||
              !selectedNodeId ||
              !availableModeIds.has("fixed-image-recognition")
            }
          >
            固定图识别
          </Button>
          <Button danger icon={<StopOutlined />} onClick={stopRun}>
            停止
          </Button>
        </Space>
      </DebugSection>
      <DebugSection title="会话（Session）">
        <Space wrap>
          <Tag color={session ? "green" : "default"}>
            {session?.sessionId ?? "未创建会话"}
          </Tag>
          <Tag>{session?.status ?? summary.status}</Tag>
          <Tag>运行 {activeRun?.runId ?? summary.runId ?? "-"}</Tag>
          <Tag>模式 {summary.runMode ?? lastRunMode}</Tag>
        </Space>
      </DebugSection>
      <DebugSection title="当前可用能力">
        {capabilities ? (
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            <Space wrap>
              <Tag color="green">调试协议 {capabilities.protocol}</Tag>
              <Tag>{getDebugStatusLabel(capabilityStatus)}</Tag>
              <Tag>MaaFramework {capabilities.maa.mfwVersion}</Tag>
            </Space>
            <Space wrap>
              <Text type="secondary">运行方式</Text>
              {capabilities.runModes.map((mode) => (
                <Tag key={mode} color="blue">
                  {getRunModeLabel(mode)}
                </Tag>
              ))}
            </Space>
            {(capabilities.debugFeatures ?? []).length > 0 && (
              <Space wrap>
                <Text type="secondary">调试工具</Text>
                {(capabilities.debugFeatures ?? []).map((feature) => (
                  <Tag key={feature} color="purple">
                    {getDebugFeatureLabel(feature)}
                  </Tag>
                ))}
              </Space>
            )}
            <Space wrap>
              <Text type="secondary">启动检查</Text>
              {capabilities.diagnostics.map((diagnostic) => (
                <Tag key={diagnostic}>
                  {getDiagnosticCapabilityLabel(diagnostic)}
                </Tag>
              ))}
            </Space>
            <Space wrap>
              <Text type="secondary">可查看产物</Text>
              {capabilities.artifacts.map((artifact) => (
                <Tag key={artifact}>{getArtifactCapabilityLabel(artifact)}</Tag>
              ))}
            </Space>
            <Space wrap>
              <Text type="secondary">截图来源</Text>
              {capabilities.screenshotSources.map((source) => (
                <Tag key={source}>
                  {getScreenshotSourceLabel(source)}
                </Tag>
              ))}
            </Space>
            <Space wrap>
              <Text type="secondary">配置能力</Text>
              {capabilities.profileFeatures.map((feature) => (
                <Tag key={feature}>
                  {getProfileFeatureLabel(feature)}
                </Tag>
              ))}
            </Space>
            <Space wrap>
              <Text type="secondary">控制器</Text>
              {capabilities.maa.supportedControllers.map((controller) => (
                <Tag key={controller} color="green">
                  {getControllerLabel(controller)}
                </Tag>
              ))}
              {(capabilities.maa.unavailableControllers ?? []).map((item) => (
                <Tag key={item.type} color="orange">
                  {getControllerLabel(item.type)}不可用：{" "}
                  {getUnavailableReasonLabel(item.reason)}
                </Tag>
              ))}
            </Space>
            <Space wrap>
              <Text type="secondary">后端调用</Text>
              {capabilities.maa.supportedTaskerApis.map((api) => (
                <Tag key={api}>{getTaskerApiLabel(api)}</Tag>
              ))}
              {capabilities.maa.supportedResourceApis.map((api) => (
                <Tag key={api}>{getResourceApiLabel(api)}</Tag>
              ))}
              {capabilities.maa.supportedAgentTransports.map((transport) => (
                <Tag key={transport}>
                  {getAgentTransportLabel(transport)}
                </Tag>
              ))}
            </Space>
          </Space>
        ) : (
          <Space wrap>
            <Tag>{getDebugStatusLabel(capabilityStatus)}</Tag>
            <Text type="secondary">连接 LocalBridge 后读取可用调试能力。</Text>
          </Space>
        )}
      </DebugSection>
      <DebugSection title="当前追踪（Trace）">
        <Space wrap>
          <Tag>事件 {events.length}</Tag>
          <Tag>实时事件 {liveSummary.lastEvent?.seq ?? 0}</Tag>
          <Tag>当前节点 {summary.currentRuntimeName ?? "-"}</Tag>
          <Tag color={replayStatus?.active ? "purple" : "default"}>
            {replayStatus?.active
              ? `回放 #${replayStatus.cursorSeq}`
              : "实时"}
          </Tag>
          <Tag color="green">已访问 {summary.visitedNodeIds.length}</Tag>
          <Tag color="red">失败 {summary.failedNodeIds.length}</Tag>
        </Space>
      </DebugSection>
      {performanceSummary && (
        <DebugSection title="性能摘要（Performance）">
          <Space wrap>
            <Tag>耗时 {performanceSummary.durationMs ?? 0}ms</Tag>
            <Tag>节点 {performanceSummary.nodeCount}</Tag>
            <Tag>识别 {performanceSummary.recognitionCount}</Tag>
            <Tag>动作 {performanceSummary.actionCount}</Tag>
            <Tag>产物 {performanceSummary.artifactRefCount}</Tag>
          </Space>
        </DebugSection>
      )}
    </Space>
  );

  const renderProfile = () => (
    <Space direction="vertical" size={14} style={{ width: "100%" }}>
      <DebugSection title="基础配置">
        <Space direction="vertical" style={{ width: "100%" }}>
          <Input
            value={profileState.profile.name}
            onChange={(event) =>
              profileState.updateProfile({ name: event.target.value })
            }
            addonBefore="名称"
          />
          <Space.Compact style={{ width: "100%" }}>
            <Input
              value={interfaceImportPath}
              onChange={(event) => setInterfaceImportPath(event.target.value)}
              placeholder="interface.json 路径或目录"
            />
            <Button icon={<ApiOutlined />} onClick={importInterface}>
              导入接口（Interface）
            </Button>
          </Space.Compact>
          {profileState.interfaceImport && (
            <Space direction="vertical" style={{ width: "100%" }}>
              <Alert
                type="success"
                showIcon
                message="接口（Interface）已导入"
                description={
                  profileState.interfaceImport.entryName ||
                  profileState.interfaceImport.profile.name
                }
              />
              <Space wrap>
                <Tag>
                  控制器（Controller）{" "}
                  {profileState.interfaceSelections?.controllerName ?? "-"}
                </Tag>
                <Tag>
                  资源（Resource）{" "}
                  {profileState.interfaceSelections?.resourceName ?? "-"}
                </Tag>
                <Tag>任务（Task） {profileState.interfaceSelections?.taskName ?? "-"}</Tag>
                <Tag>
                  覆盖（Overrides）{" "}
                  {profileState.interfaceImport.overrides?.length ?? 0}
                </Tag>
              </Space>
              <Space wrap>
                {(profileState.interfaceImport.options ?? []).slice(0, 8).map(
                  (option) => (
                    <Tag key={option.name}>
                      {option.label || option.name}:{" "}
                      {JSON.stringify(option.defaultValue)}
                    </Tag>
                  ),
                )}
              </Space>
            </Space>
          )}
          <Select
            value={profileState.profile.savePolicy}
            style={{ width: 240 }}
            onChange={(savePolicy) => profileState.updateProfile({ savePolicy })}
            options={[
              { value: "sandbox", label: "沙盒快照（Sandbox）" },
              { value: "save-open-files", label: "保存打开文件" },
              { value: "use-disk", label: "使用磁盘文件" },
            ]}
          />
          <Space wrap>
            {runModes.map((runMode) => (
              <Tag
                key={runMode.id}
                color={
                  !availableModeIds.has(runMode.id)
                    ? "default"
                    : runMode.id === lastRunMode
                      ? "blue"
                      : "green"
                }
              >
                {runMode.label}
                {!availableModeIds.has(runMode.id) ? "（未开放）" : ""}
              </Tag>
            ))}
          </Space>
        </Space>
      </DebugSection>
      <DebugSection title="产物策略（Artifact Policy）">
        <Checkbox.Group
          value={Object.entries(profileState.artifactPolicy)
            .filter(([, enabled]) => enabled)
            .map(([key]) => key)}
          onChange={(values) => {
            const selected = new Set(values);
            profileState.setArtifactPolicy({
              includeRawImage: selected.has("includeRawImage"),
              includeDrawImage: selected.has("includeDrawImage"),
              includeActionDetail: selected.has("includeActionDetail"),
            } satisfies DebugArtifactPolicy);
          }}
          options={[
            { value: "includeRawImage", label: "原始图（Raw Image）" },
            { value: "includeDrawImage", label: "绘制图（Draw Image）" },
            { value: "includeActionDetail", label: "动作详情（Action Detail）" },
          ]}
        />
      </DebugSection>
    </Space>
  );

  const renderResources = () => (
    <Space direction="vertical" size={14} style={{ width: "100%" }}>
      <Alert
        type={
          resourcePreflightStatus === "ready"
            ? "success"
            : resourcePreflightStatus === "error"
              ? "error"
              : "info"
        }
        showIcon
        message={
          resourcePreflightStatus === "ready"
            ? "资源加载检测通过"
            : resourcePreflightStatus === "checking"
              ? "正在检测资源加载"
              : resourcePreflightStatus === "error"
                ? "资源加载检测失败"
                : "资源路径"
        }
        description={
          resourcePreflightStatus === "ready"
            ? `已由后端完成一次真实资源加载检测${
                resourcePreflight.result?.hash
                  ? `，hash：${resourcePreflight.result.hash}`
                  : ""
              }。`
            : resourcePreflightStatus === "checking"
              ? "后端正在使用 MaaFramework 加载资源，请稍候。"
              : resourcePreflight.error ??
                "留空时会使用 LocalBridge 当前扫描到的资源包绝对路径；打开调试模块或修改资源路径后会检测一次。"
        }
      />
      <Space wrap>
        <Button
          icon={<ReloadOutlined />}
          onClick={requestResourcePreflight}
          loading={resourcePreflightStatus === "checking"}
          disabled={!connected || resolvedResourcePaths.length === 0}
        >
          重新检测资源加载
        </Button>
        <Tag>{getDebugStatusLabel(resourcePreflightStatus)}</Tag>
        <Tag>资源路径 {resolvedResourcePaths.length}</Tag>
        {resourcePreflight.result?.durationMs !== undefined && (
          <Tag>耗时 {resourcePreflight.result.durationMs}ms</Tag>
        )}
      </Space>
      <Select
        mode="tags"
        style={{ width: "100%" }}
        value={profileState.profile.resourcePaths}
        onChange={updateResourcePaths}
        placeholder="选择或输入资源（Resource）路径"
        options={resourceBundles.map((bundle) => ({
          value: bundle.abs_path,
          label: `${bundle.name} · ${bundle.abs_path}`,
        }))}
      />
      <List
        size="small"
        bordered
        dataSource={resourceBundles}
        locale={{ emptyText: "尚未加载资源包（Resource Bundle）" }}
        renderItem={(bundle) => (
          <List.Item>
            <Space wrap>
              <Text strong>{bundle.name}</Text>
              <Tag color={bundle.has_pipeline ? "green" : "default"}>
                pipeline
              </Tag>
              <Tag color={bundle.has_image ? "green" : "default"}>图片</Tag>
              <Text type="secondary">{bundle.abs_path}</Text>
            </Space>
          </List.Item>
        )}
      />
    </Space>
  );

  const renderController = () => (
    <Space direction="vertical" size={14} style={{ width: "100%" }}>
      <DebugSection title="当前控制器（Controller）">
        <Space wrap>
          <Tag color={mfwState.connectionStatus === "connected" ? "green" : "red"}>
            {mfwState.connectionStatus}
          </Tag>
          <Tag>{mfwState.controllerType ?? "无类型"}</Tag>
          <Tag>{mfwState.controllerId ?? "无控制器 ID"}</Tag>
          <Button
            size="small"
            icon={<PictureOutlined />}
            onClick={captureScreenshot}
            disabled={!mfwState.controllerId}
          >
            截图
          </Button>
          <Button
            size="small"
            icon={<CaretRightOutlined />}
            onClick={startScreenshotStream}
            disabled={!mfwState.controllerId || screenshotStream?.active}
          >
            开始推流
          </Button>
          <Button
            size="small"
            danger
            icon={<StopOutlined />}
            onClick={stopScreenshotStream}
            disabled={!screenshotStream?.active}
          >
            停止推流
          </Button>
        </Space>
      </DebugSection>
      <DebugSection title="实时截图（Live Screenshot）">
        <Space wrap>
          <InputNumber
            min={250}
            step={250}
            value={profileState.screenshotStreamConfig.intervalMs}
            addonBefore="间隔 ms"
            onChange={(intervalMs) =>
              profileState.setScreenshotStreamConfig({
                ...profileState.screenshotStreamConfig,
                intervalMs: Math.max(250, intervalMs ?? 1000),
              })
            }
          />
          <Checkbox
            checked={profileState.screenshotStreamConfig.force}
            onChange={(event) =>
              profileState.setScreenshotStreamConfig({
                ...profileState.screenshotStreamConfig,
                force: event.target.checked,
              })
            }
          >
            强制截图
          </Checkbox>
          <Tag color={screenshotStream?.active ? "green" : "default"}>
            {screenshotStream?.active ? "推流中" : "已停止"}
          </Tag>
          <Tag>帧数 {screenshotStream?.frameCount ?? 0}</Tag>
        </Space>
      </DebugSection>
      <Alert
        type="info"
        showIcon
        message="控制器能力"
        description="启动请求会自动使用已连接控制器（Controller）；回放（Replay）/录制（Record）因当前 maa-framework-go 未暴露 MaaDbgController，按能力清单标记为不可用。"
      />
    </Space>
  );

  const renderAgent = () => {
    const agents = profileState.profile.agents;
    const updateAgent = (
      index: number,
      updates: Partial<(typeof agents)[number]>,
    ) => {
      profileState.setAgents(
        agents.map((agent, agentIndex) =>
          agentIndex === index ? { ...agent, ...updates } : agent,
        ),
      );
    };
    const addAgent = () => {
      profileState.setAgents([
        ...agents,
        {
          id: `agent-${agents.length + 1}`,
          enabled: false,
          transport: "identifier",
          launchMode: "manual",
          identifier: "",
          required: true,
        },
      ]);
    };

    return (
      <Space direction="vertical" size={14} style={{ width: "100%" }}>
        <Button icon={<PlusOutlined />} onClick={addAgent}>
          添加代理（Agent）
        </Button>
        <List
          bordered
          dataSource={agents}
          locale={{ emptyText: "未配置代理（Agent）" }}
          renderItem={(agent, index) => (
            <List.Item
              actions={[
                <Button
                  key="delete"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() =>
                    profileState.setAgents(
                      agents.filter((_, agentIndex) => agentIndex !== index),
                    )
                  }
                />,
              ]}
            >
              <Space direction="vertical" style={{ width: "100%" }}>
                <Space wrap>
                  <Switch
                    checked={agent.enabled}
                    onChange={(enabled) => updateAgent(index, { enabled })}
                  />
                  <Input
                    value={agent.id}
                    onChange={(event) =>
                      updateAgent(index, { id: event.target.value })
                    }
                    addonBefore="标识"
                    style={{ width: 220 }}
                  />
                  <Select
                    value={agent.launchMode ?? "manual"}
                    style={{ width: 140 }}
                    onChange={(launchMode) => updateAgent(index, { launchMode })}
                    options={[
                      { value: "manual", label: "手动（Manual）" },
                      { value: "managed", label: "托管（Managed）" },
                    ]}
                  />
                  <Select
                    value={agent.transport}
                    style={{ width: 140 }}
                    onChange={(transport) => updateAgent(index, { transport })}
                    options={[
                      { value: "identifier", label: "标识符（Identifier）" },
                      { value: "tcp", label: "TCP" },
                    ]}
                  />
                  {agent.transport === "tcp" ? (
                    <InputNumber
                      value={agent.tcpPort}
                      min={1}
                      max={65535}
                      placeholder="TCP 端口"
                      onChange={(tcpPort) =>
                        updateAgent(index, { tcpPort: tcpPort ?? undefined })
                      }
                    />
                  ) : (
                    <Input
                      value={agent.identifier}
                      onChange={(event) =>
                        updateAgent(index, { identifier: event.target.value })
                      }
                      placeholder="代理标识符（Identifier）"
                      style={{ width: 240 }}
                    />
                  )}
                  <InputNumber
                    value={agent.timeoutMs}
                    min={0}
                    step={100}
                    placeholder="超时 ms"
                    onChange={(timeoutMs) =>
                      updateAgent(index, { timeoutMs: timeoutMs ?? undefined })
                    }
                  />
                  <Checkbox
                    checked={agent.required ?? true}
                    onChange={(event) =>
                      updateAgent(index, { required: event.target.checked })
                    }
                  >
                    必需
                  </Checkbox>
                </Space>
                {agent.launchMode === "managed" && (
                  <Space direction="vertical" style={{ width: "100%" }}>
                    <Space wrap>
                      <Input
                        value={agent.childExec}
                        onChange={(event) =>
                          updateAgent(index, { childExec: event.target.value })
                        }
                        addonBefore="子进程"
                        style={{ width: 360 }}
                      />
                      <Input
                        value={(agent.childArgs ?? []).join(" ")}
                        onChange={(event) =>
                          updateAgent(index, {
                            childArgs: event.target.value
                              .split(" ")
                              .map((item) => item.trim())
                              .filter(Boolean),
                          })
                        }
                        addonBefore="参数"
                        style={{ width: 420 }}
                      />
                    </Space>
                    <Input
                      value={agent.workingDirectory}
                      onChange={(event) =>
                        updateAgent(index, {
                          workingDirectory: event.target.value,
                        })
                      }
                      addonBefore="工作目录"
                    />
                    <Text type="secondary">
                      托管模式（Managed）会由 LocalBridge 启动子进程并注入 PI_* / MAA_AGENT_* 环境变量；手动模式（Manual）只连接外部已启动代理（Agent）。
                    </Text>
                  </Space>
                )}
              </Space>
            </List.Item>
          )}
        />
        <DebugSection title="最近代理（Agent）诊断">
          <List
            size="small"
            dataSource={agentDiagnostics}
            locale={{ emptyText: "暂无代理（Agent）诊断" }}
            renderItem={(diagnostic) => (
              <List.Item>
                <Space direction="vertical" style={{ width: "100%" }}>
                  <Space>
                  <Tag>{diagnostic.severity}</Tag>
                  <Text>{diagnostic.message}</Text>
                  </Space>
                  <Space wrap>
                    {stringArray(diagnostic.data?.customRecognitions).map(
                      (name) => (
                        <Tag key={`reco-${name}`} color="blue">
                          reco {name}
                        </Tag>
                      ),
                    )}
                    {stringArray(diagnostic.data?.customActions).map((name) => (
                      <Tag key={`act-${name}`} color="purple">
                        act {name}
                      </Tag>
                    ))}
                  </Space>
                </Space>
              </List.Item>
            )}
          />
        </DebugSection>
        <DebugSection title="代理运行配置">
          <Space direction="vertical" style={{ width: "100%" }}>
            <Space wrap>
              <Tag>已配置 {agents.length}</Tag>
              <Tag color="green">
                已启用 {agents.filter((agent) => agent.enabled).length}
              </Tag>
              <Tag color="purple">
                已连接{" "}
                {
                  agentDiagnostics.filter(
                    (diagnostic) => diagnostic.code === "debug.agent.connected",
                  ).length
                }
              </Tag>
            </Space>
            <Text type="secondary">
              当前代理（Agent）配置会随调试配置本地持久化；运行时自定义识别/动作（Custom Recognition/Action）会写入追踪诊断（Trace Diagnostic）并进入性能摘要。
            </Text>
          </Space>
        </DebugSection>
      </Space>
    );
  };

  const renderSetup = () => (
    <Space direction="vertical" size={14} style={{ width: "100%" }}>
      <Collapse
        defaultActiveKey={["profile", "resources"]}
        items={[
          {
            key: "profile",
            label: "调试配置与接口",
            children: renderProfile(),
          },
          {
            key: "resources",
            label: "资源路径（Resource）",
            children: renderResources(),
          },
          {
            key: "controller",
            label: "控制器与截图（Controller / Screenshot）",
            children: renderController(),
          },
          {
            key: "agent",
            label: "代理（Agent）",
            children: renderAgent(),
          },
        ]}
      />
    </Space>
  );

  const renderNodes = () => (
    <Space direction="vertical" size={14} style={{ width: "100%" }}>
      {selectedNodeDetail && (
        <section>
          <Title level={5} style={{ marginTop: 0 }}>
            目标节点详情
          </Title>
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            <Space wrap>
              <Tag>{selectedNodeDetail.label ?? selectedNodeId}</Tag>
              <Tag>
                追踪{" "}
                {
                  events.filter(
                    (event) => event.node?.nodeId === selectedNodeId,
                  ).length
                }
              </Tag>
              <Tag>运行 {selectedNodeReplays.length}</Tag>
            </Space>
            <DebugSection title="会话回放（Session Replay）">
              {selectedNodeReplays.length === 0 ? (
                <Empty description="当前会话（Session）中暂无该节点运行事件" />
              ) : (
                <List
                  size="small"
                  dataSource={selectedNodeReplays}
                  renderItem={(replay) => (
                    <List.Item>
                      <Space direction="vertical" style={{ width: "100%" }}>
                        <Space wrap>
                          <Tag color={replay.status === "failed" ? "red" : "blue"}>
                            {replay.status}
                          </Tag>
                          <Tag>运行 {replay.runId || "-"}</Tag>
                          <Tag>
                            seq {replay.firstSeq}-{replay.lastSeq}
                          </Tag>
                          <Tag>识别 {replay.recognitionEvents.length}</Tag>
                          <Tag>动作 {replay.actionEvents.length}</Tag>
                          <Tag>候选列表 {replay.nextListEvents.length}</Tag>
                          <Tag>等待静止 {replay.waitFreezesEvents.length}</Tag>
                        </Space>
                        <Space wrap>
                          {replay.detailRefs.map((ref) => (
                            <Button
                              key={ref}
                              size="small"
                              onClick={() => requestArtifact(ref)}
                            >
                              详情 #{ref.slice(0, 8)}
                            </Button>
                          ))}
                          {replay.screenshotRefs.map((ref) => (
                            <Button
                              key={ref}
                              size="small"
                              icon={<PictureOutlined />}
                              onClick={() => requestArtifact(ref)}
                            >
                              图像 #{ref.slice(0, 8)}
                            </Button>
                          ))}
                        </Space>
                      </Space>
                    </List.Item>
                  )}
                />
              )}
            </DebugSection>
            <DebugSection title="静态节点配置">
              <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                {JSON.stringify(
                  {
                    recognition: selectedNodeDetail.recognition,
                    action: selectedNodeDetail.action,
                    next: selectedNodeDetail.others?.next,
                    on_error: selectedNodeDetail.others?.on_error,
                    waitFreezes: {
                      pre: selectedNodeDetail.others?.pre_wait_freezes,
                      post: selectedNodeDetail.others?.post_wait_freezes,
                    },
                  },
                  null,
                  2,
                )}
              </pre>
            </DebugSection>
          </Space>
        </section>
      )}
      <List
      bordered
      dataSource={pipelineNodes}
      locale={{ emptyText: "当前图没有可调试 Pipeline 节点" }}
      renderItem={(node) => {
        const active = selectedNodeId === node.nodeId;
        return (
          <List.Item
            actions={[
              <Button
                key="select"
                size="small"
                onClick={() => {
                  selectNode(node.nodeId);
                  setLastEntryNodeId(node.nodeId);
                  profileState.setEntry({
                    fileId: node.fileId,
                    nodeId: node.nodeId,
                    runtimeName: node.runtimeName,
                  });
                }}
              >
                设为入口
              </Button>,
              <Button
                key="run"
                size="small"
                type="primary"
                onClick={() => startRun("run-from-node", node.nodeId)}
                disabled={
                  !debugReadiness.ready || !availableModeIds.has("run-from-node")
                }
              >
                从此运行
              </Button>,
              <Button
                key="single"
                size="small"
                onClick={() => startRun("single-node-run", node.nodeId)}
                disabled={
                  !debugReadiness.ready ||
                  !availableModeIds.has("single-node-run")
                }
              >
                单节点
              </Button>,
              <Button
                key="recognition"
                size="small"
                onClick={() => startRun("recognition-only", node.nodeId)}
                disabled={
                  !debugReadiness.ready ||
                  !availableModeIds.has("recognition-only")
                }
              >
                识别
              </Button>,
              <Button
                key="action"
                size="small"
                danger
                onClick={() => confirmActionRun(node.nodeId)}
                disabled={
                  !debugReadiness.ready || !availableModeIds.has("action-only")
                }
              >
                动作
              </Button>,
              <Button
                key="fixed-image"
                size="small"
                onClick={() => startRun("fixed-image-recognition", node.nodeId)}
                disabled={
                  !debugReadiness.ready ||
                  !availableModeIds.has("fixed-image-recognition")
                }
              >
                固定图
              </Button>,
            ]}
          >
            <List.Item.Meta
              title={
                <Space>
                  <Text strong={active}>{node.displayName}</Text>
                  {active && <Tag color="blue">已选中</Tag>}
                </Space>
              }
              description={`${node.fileId} · ${node.runtimeName}`}
            />
          </List.Item>
        );
      }}
      />
    </Space>
  );

  const renderTimeline = () => {
    if (events.length === 0) return <Empty description="暂无追踪事件（Trace Event）" />;
    return (
      <Space direction="vertical" size={14} style={{ width: "100%" }}>
        <DebugSection title="会话追踪回放（Session Trace Replay）">
          <Space wrap>
            <Button size="small" onClick={requestTraceSnapshot}>
              刷新快照（Snapshot）
            </Button>
            <Button
              size="small"
              type="primary"
              icon={<CaretRightOutlined />}
              onClick={startTraceReplay}
            >
              回放
            </Button>
            <InputNumber
              size="small"
              min={replayStatus?.minSeq ?? events[0]?.seq ?? 1}
              max={replayStatus?.maxSeq ?? events[events.length - 1]?.seq ?? 1}
              value={replayStatus?.cursorSeq ?? summary.lastEvent?.seq}
              addonBefore="seq"
              onChange={(value) => seekTraceReplay(value ?? undefined)}
            />
            <Button size="small" onClick={() => seekTraceReplay(events[0]?.seq)}>
              到开头
            </Button>
            <Button
              size="small"
              onClick={() => seekTraceReplay(summary.lastEvent?.seq)}
            >
              到当前
            </Button>
            <Button size="small" danger onClick={stopTraceReplay}>
              回到实时（Live）
            </Button>
            <Tag color={replayStatus?.active ? "purple" : "default"}>
              {replayStatus?.active ? "回放" : "实时"}
            </Tag>
            <Tag>
              范围 {replayStatus?.minSeq ?? "-"}-{replayStatus?.maxSeq ?? "-"}
            </Tag>
            {selectedNodeId && <Tag>节点 {selectedNodeId}</Tag>}
          </Space>
        </DebugSection>
        <List
          size="small"
          dataSource={[...events].reverse()}
          renderItem={(event) => (
            <List.Item>
              <List.Item.Meta
                title={eventTitle(event)}
                description={renderEventMeta(event)}
              />
            </List.Item>
          )}
        />
      </Space>
    );
  };

  const renderPerformance = () => (
    <Space direction="vertical" size={14} style={{ width: "100%" }}>
      <DebugSection title="性能摘要（Performance Summary）">
        {performanceSummary ? (
          <Space direction="vertical" style={{ width: "100%" }}>
            <Space wrap>
              <Tag>运行 {performanceSummary.runId}</Tag>
              <Tag>{performanceSummary.status ?? "-"}</Tag>
              <Tag>耗时 {performanceSummary.durationMs ?? 0}ms</Tag>
              <Tag>事件 {performanceSummary.eventCount}</Tag>
              <Tag>节点 {performanceSummary.nodeCount}</Tag>
              <Tag>识别 {performanceSummary.recognitionCount}</Tag>
              <Tag>动作 {performanceSummary.actionCount}</Tag>
              <Tag>截图 {performanceSummary.screenshotRefCount}</Tag>
            </Space>
            <List
              size="small"
              dataSource={performanceSummary.slowNodes}
              locale={{ emptyText: "暂无慢节点" }}
              renderItem={(node) => (
                <List.Item>
                  <Space wrap>
                    <Text>{node.label || node.runtimeName}</Text>
                    <Tag>{node.durationMs ?? 0}ms</Tag>
                    <Tag>{node.status}</Tag>
                    <Tag>
                      seq {node.firstSeq}-{node.lastSeq}
                    </Tag>
                  </Space>
                </List.Item>
              )}
            />
          </Space>
        ) : (
          <Empty description="运行结束后会生成性能摘要产物（Performance Summary Artifact）" />
        )}
      </DebugSection>
      <DebugSection title="性能产物（Performance Artifacts）">
        <Space wrap>
          {performanceRefs.map((ref) => (
            <Button key={ref} size="small" onClick={() => requestArtifact(ref)}>
              性能 #{ref.slice(0, 8)}
            </Button>
          ))}
          {batchSummaryRefs.map((ref) => (
            <Button key={ref} size="small" onClick={() => requestArtifact(ref)}>
              批量 #{ref.slice(0, 8)}
            </Button>
          ))}
        </Space>
      </DebugSection>
      {selectedArtifact?.payload?.data && (
        <DebugSection title="已选产物 JSON（Artifact JSON）">
          <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
            {JSON.stringify(selectedArtifact.payload.data, null, 2)}
          </pre>
        </DebugSection>
      )}
    </Space>
  );

  const renderImages = () => {
    const entries = Object.values(artifacts);
    return (
      <Space direction="vertical" size={14} style={{ width: "100%" }}>
        <DebugSection title="实时截图（Live Screenshot）">
          <Space wrap>
            <Button
              icon={<CaretRightOutlined />}
              onClick={startScreenshotStream}
              disabled={!mfwState.controllerId || screenshotStream?.active}
            >
              开始推流
            </Button>
            <Button
              danger
              icon={<StopOutlined />}
              onClick={stopScreenshotStream}
              disabled={!screenshotStream?.active}
            >
              停止推流
            </Button>
            <Tag color={screenshotStream?.active ? "green" : "default"}>
              {screenshotStream?.active ? "推流中" : "已停止"}
            </Tag>
            <Tag>间隔 {profileState.screenshotStreamConfig.intervalMs}ms</Tag>
            <Tag>帧数 {screenshotStream?.frameCount ?? 0}</Tag>
          </Space>
        </DebugSection>
        <DebugSection title="固定图输入">
          <Space direction="vertical" size={10} style={{ width: "100%" }}>
            <Space wrap>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => resourceProtocol.requestImageList()}
                loading={imageListLoading}
              >
                刷新资源（Resource）图片
              </Button>
              <Tag>{imageListBundleName || "全部资源"}</Tag>
            </Space>
            <Select
              allowClear
              showSearch
              loading={imageListLoading}
              style={{ width: "100%" }}
              value={profileState.fixedImageInput.imageRelativePath}
              placeholder="选择资源 image 目录下的相对路径（resource/image）"
              onChange={(imageRelativePath) =>
                profileState.setFixedImageInput({
                  ...profileState.fixedImageInput,
                  imageRelativePath,
                })
              }
              options={imageList.map((image) => ({
                value: image.relativePath,
                label: image.bundleName
                  ? `${image.relativePath} · ${image.bundleName}`
                  : image.relativePath,
              }))}
            />
            <Select
              mode="multiple"
              allowClear
              showSearch
              loading={imageListLoading}
              style={{ width: "100%" }}
              value={profileState.batchRecognitionImages
                .map((image) => image.imageRelativePath)
                .filter((path): path is string => Boolean(path))}
              placeholder="选择批量识别图片；留空时使用前 50 张"
              onChange={(values) =>
                profileState.setBatchRecognitionImages(
                  values.map((imageRelativePath) => ({ imageRelativePath })),
                )
              }
              options={imageList.map((image) => ({
                value: image.relativePath,
                label: image.bundleName
                  ? `${image.relativePath} · ${image.bundleName}`
                  : image.relativePath,
              }))}
            />
            <Input
              value={profileState.fixedImageInput.imagePath}
              onChange={(event) =>
                profileState.setFixedImageInput({
                  ...profileState.fixedImageInput,
                  imagePath: event.target.value,
                })
              }
              addonBefore="图片路径"
              placeholder="项目根或资源（Resource）路径内的图片文件"
            />
          </Space>
        </DebugSection>
        <List
          bordered
          size="small"
          dataSource={entries}
          locale={{ emptyText: "暂无产物（Artifact）" }}
          renderItem={(entry) => (
            <List.Item
              actions={[
                <Button
                  key="load"
                  size="small"
                  onClick={() => requestArtifact(entry.ref.id)}
                >
                  {entry.status === "ready" ? "查看" : "加载"}
                </Button>,
              ]}
            >
              <List.Item.Meta
                title={
                  <Space>
                    <Text>{entry.ref.type}</Text>
                    <Tag>{entry.status}</Tag>
                  </Space>
                }
                description={`${entry.ref.id} · seq ${entry.ref.eventSeq ?? "-"}`}
              />
            </List.Item>
          )}
        />
        <DebugSection title="批量固定图识别">
          <Space wrap>
            <Button
              type="primary"
              icon={<FileSearchOutlined />}
              onClick={startBatchRecognition}
              disabled={
                !debugReadiness.ready || !selectedNodeId || imageList.length === 0
              }
            >
              批量识别前 50 张
            </Button>
            <Button danger icon={<StopOutlined />} onClick={stopBatchRecognition}>
              停止批量
            </Button>
            <Tag>图片 {imageList.length}</Tag>
            <Tag>
              已选 {profileState.batchRecognitionImages.length || "前 50 张"}
            </Tag>
            <Tag>目标 {selectedNodeId ?? "-"}</Tag>
          </Space>
        </DebugSection>
        {selectedArtifact && (
          <DebugSection title="产物预览（Artifact Preview）">
            {selectedArtifact.error && (
              <Alert type="error" showIcon message={selectedArtifact.error} />
            )}
            {selectedArtifact.payload?.content &&
              selectedArtifact.payload.ref.mime.startsWith("image/") && (
                <img
                  alt={selectedArtifact.payload.ref.type}
                  src={`data:${selectedArtifact.payload.ref.mime};base64,${selectedArtifact.payload.content}`}
                  style={{ maxWidth: "100%", maxHeight: 360 }}
                />
              )}
            {selectedArtifact.payload?.data !== undefined && (
              <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                {JSON.stringify(selectedArtifact.payload.data, null, 2)}
              </pre>
            )}
            {selectedArtifact.payload?.content &&
              !selectedArtifact.payload.ref.mime.startsWith("image/") && (
                <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                  {selectedArtifact.payload.content}
                </pre>
              )}
          </DebugSection>
        )}
      </Space>
    );
  };

  const renderDiagnostics = () =>
    diagnosticsState.diagnostics.length === 0 ? (
      <Empty description="暂无诊断" />
    ) : (
      <List
        bordered
        dataSource={diagnosticsState.diagnostics}
        renderItem={(diagnostic) => (
          <List.Item>
            <List.Item.Meta
              title={
                <Space>
                  <Tag
                    color={
                      diagnostic.severity === "error"
                        ? "red"
                        : diagnostic.severity === "warning"
                          ? "gold"
                          : "blue"
                    }
                  >
                    {diagnostic.severity}
                  </Tag>
                  <Text>{diagnostic.code}</Text>
                </Space>
              }
              description={diagnostic.message}
            />
          </List.Item>
        )}
      />
    );

  const renderLogs = () => {
    const logEvents = events.filter((event) =>
      (["log", "session", "task"] satisfies DebugEventKind[]).includes(
        event.kind,
      ),
    );
    return logEvents.length === 0 ? (
      <Empty description="暂无日志事件" />
    ) : (
      <List
        size="small"
        dataSource={[...logEvents].reverse()}
        renderItem={(event) => (
          <List.Item>
            <Text>
              #{event.seq} {event.maafwMessage ?? event.status ?? event.kind}
            </Text>
          </List.Item>
        )}
      />
    );
  };

  const renderPanel = () => {
    switch (activePanel) {
      case "overview":
        return renderOverview();
      case "setup":
        return renderSetup();
      case "nodes":
        return renderNodes();
      case "timeline":
        return renderTimeline();
      case "performance":
        return renderPerformance();
      case "images":
        return renderImages();
      case "diagnostics":
        return renderDiagnostics();
      case "logs":
        return renderLogs();
      default:
        return null;
    }
  };

  return (
    <Modal
      title="MPE FlowScope (调试模块)"
      open={modalOpen}
      onCancel={closeModal}
      width="min(1180px, calc(100vw - 48px))"
      footer={null}
      destroyOnHidden
    >
      <div style={modalBodyStyle}>
        <nav style={navStyle}>
          <Space direction="vertical" size={4} style={{ width: "100%" }}>
            {panels.map((panel) => (
              <Button
                key={panel.id}
                type={activePanel === panel.id ? "primary" : "text"}
                icon={panel.icon}
                block
                style={{ justifyContent: "flex-start" }}
                onClick={() => handlePanelClick(panel.id)}
              >
                {panel.label}
              </Button>
            ))}
          </Space>
        </nav>

        <main style={scrollMainStyle}>
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <div>
              <Title level={4} style={{ margin: 0 }}>
                {activePanelMeta.label}
              </Title>
              <Text type="secondary">{activePanelMeta.description}</Text>
            </div>
            {!debugReadiness.ready && (
              <Alert
                type="warning"
                showIcon
                message="调试前置条件未满足"
                description={debugReadinessDescription}
              />
            )}
            {renderPanel()}
          </Space>
        </main>
      </div>
    </Modal>
  );
}
