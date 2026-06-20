import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Alert, Button, Checkbox, Select, Space, Typography } from "antd";
import {
  CaretRightOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  FormatPainterOutlined,
  InfoCircleOutlined,
  NodeIndexOutlined,
  ReloadOutlined,
  StopOutlined,
} from "@ant-design/icons";
import type { editor as MonacoEditor } from "monaco-editor";
import { DebugSection } from "../DebugSection";
import type { DebugModalController } from "../../hooks/useDebugModalController";
import { DEFAULT_DEBUG_NODE_EXECUTION_FILTERS } from "../../types";
import {
  findDebugRunFirstTimestamp,
  formatDebugRunDisplayName,
} from "../../runDisplayName";
import { useConfigStore } from "../../../../stores/configStore";
import {
  formatDebugPipelineOverrideDraft,
  hasDebugPipelineOverrideDraftContent,
} from "../../pipelineOverride";
import {
  clearMfwJsonCompletionContext,
  createMfwJsonEditorOptions,
  ensureMfwJsonCompletionProvider,
  setMfwJsonCompletionContext,
} from "../../../../components/json/mfwJsonCompletion";
import { MfwJsonEditor } from "../../../../components/json/MfwJsonEditor";

const { Text } = Typography;

const runControlStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const nodePickerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flex: "0 1 500px",
  minWidth: 0,
  flexWrap: "wrap",
};

const nodeSelectStyle: CSSProperties = {
  width: 300,
  maxWidth: "100%",
};

const includeAllNodesCheckboxStyle: CSSProperties = {
  whiteSpace: "nowrap",
};

const runActionsStyle: CSSProperties = {
  flex: "0 1 auto",
};

const runSummaryStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const overrideSectionStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const overrideToolbarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const overrideEditorContainerStyle: CSSProperties = {
  border: "1px solid rgba(5, 5, 5, 0.12)",
  borderRadius: 6,
  overflow: "hidden",
};

const sessionManagerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const sessionSelectStyle: CSSProperties = {
  flex: "1 1 420px",
  minWidth: 320,
};

const metaListStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  columnGap: 16,
  rowGap: 6,
  width: "100%",
};

const metaItemStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "baseline",
  gap: 4,
  minWidth: 0,
  overflowWrap: "anywhere",
};

const metaItemWideStyle: CSSProperties = {
  ...metaItemStyle,
  flex: "1 1 240px",
};

const metaValueStyle: CSSProperties = {
  minWidth: 0,
  overflowWrap: "anywhere",
  wordBreak: "break-word",
};

export function OverviewPanel({
  controller,
}: {
  controller: DebugModalController;
}) {
  const {
    capabilityStatus,
    capabilityError,
    lastError,
    debugReadiness,
    availableModeIds,
    runTargetNodes,
    includeAllJsonRunTargets,
    selectedRunTargetNodeId,
    session,
    activeRun,
    summary,
    lastRunMode,
    events,
    liveSummary,
    displaySessions,
    selectedDisplaySessionIds,
    latestDisplaySessionId,
    allNodeExecutionRecords,
    nodeExecutionResolverNodes,
    startRun,
    confirmActionRun,
    stopRun,
    selectPipelineNode,
    setIncludeAllJsonRunTargets,
    setNodeExecutionFilters,
    selectDisplaySessions,
    selectLatestDisplaySession,
    selectAllDisplaySessions,
    openNodeExecutionRecord,
    aiSummaryState,
    openAiSummaryPanel,
    generateDebugAiSummary,
    overrideDraft,
    overrideEntries,
    overrideValidationError,
    setOverrideDraft,
    resetOverrideDraft,
  } = controller;
  const jsonIndent = useConfigStore((state) => state.configs.jsonIndent);
  const [overrideEditorModel, setOverrideEditorModel] =
    useState<MonacoEditor.ITextModel>();
  const nodeOptions = useMemo(
    () =>
      runTargetNodes.map((node) => ({
        value: node.nodeId,
        label: node.displayName,
      })),
    [runTargetNodes],
  );
  const nodeSearchTextMap = useMemo(() => {
    const map = new Map<string, string>();
    runTargetNodes.forEach((node) => {
      map.set(
        node.nodeId,
        [
          node.displayName,
          node.runtimeName,
          node.fileId,
          node.sourcePath,
        ]
          .filter(Boolean)
          .join(" "),
      );
    });
    return map;
  }, [runTargetNodes]);
  const displaySessionOptions = useMemo(
    () =>
      displaySessions.map((item) => ({
        value: item.id,
        label: `${formatDebugRunDisplayName(item.runId, item.startedAt)} · ${
          item.status ?? "-"
        } · ${item.eventCount} 事件`,
      })),
    [displaySessions],
  );
  const displaySessionSearchTextMap = useMemo(() => {
    const map = new Map<string, string>();
    displaySessions.forEach((item) => {
      map.set(
        item.id,
        [
          item.id,
          item.sessionId,
          item.runId,
          item.mode,
          item.status,
          item.startedAt,
        ]
          .filter(Boolean)
          .join(" "),
      );
    });
    return map;
  }, [displaySessions]);
  const hasSelectedNode = Boolean(selectedRunTargetNodeId);
  const runLocked = ["preparing", "running", "stopping"].includes(
    session?.status ?? "idle",
  );
  const canStartRun = debugReadiness.ready && !runLocked;
  const canStopRun = session?.status === "running" && Boolean(activeRun?.runId);
  const failedNodeExecutionRecords = useMemo(
    () => allNodeExecutionRecords.filter((record) => record.hasFailure),
    [allNodeExecutionRecords],
  );
  const latestFailedNodeExecutionRecord = useMemo(
    () =>
      [...failedNodeExecutionRecords].sort(
        (a, b) => b.lastSeq - a.lastSeq || b.firstSeq - a.firstSeq,
      )[0],
    [failedNodeExecutionRecords],
  );
  const openLatestFailedNode = () => {
    if (!latestFailedNodeExecutionRecord) return;
    setNodeExecutionFilters({
      ...DEFAULT_DEBUG_NODE_EXECUTION_FILTERS,
      status: "failed",
      sortMode: "failure-first",
    });
    openNodeExecutionRecord(latestFailedNodeExecutionRecord);
  };
  const currentRunId = activeRun?.runId ?? summary.runId;
  const currentRunLabel = formatDebugRunDisplayName(
    currentRunId,
    activeRun?.startedAt ?? findDebugRunFirstTimestamp(currentRunId, events),
  );
  const displaySessionSelectionLabel =
    displaySessions.length === 0
      ? "暂无"
      : `${selectedDisplaySessionIds.length}/${displaySessions.length}`;
  const shouldShowAiSummarySection = displaySessions.length > 0;
  const overrideSummaryText = overrideValidationError
    ? "当前 JSON 无效，启动调试会被阻止。"
    : overrideEntries.length > 0
      ? `当前会覆盖 ${overrideEntries.length} 个运行时节点。`
      : "当前没有额外 override，将直接使用基础 pipeline。";
  const overrideEditorOptions = useMemo(
    () => createMfwJsonEditorOptions(jsonIndent, { fontSize: 13 }),
    [jsonIndent],
  );
  const overrideNodeNameSuggestions = useMemo(() => {
    const seen = new Set<string>();
    return nodeExecutionResolverNodes
      .filter((node) => {
        const runtimeName = node.runtimeName.trim();
        if (!runtimeName || runtimeName.startsWith("__mpe")) {
          return false;
        }
        if (seen.has(runtimeName)) {
          return false;
        }
        seen.add(runtimeName);
        return true;
      })
      .map((node) => ({
        label: node.runtimeName,
        detail: node.sourcePath
          ? `${node.displayName} · ${node.sourcePath}`
          : node.displayName,
      }));
  }, [nodeExecutionResolverNodes]);
  const overrideDefaultCollapsed =
    !hasDebugPipelineOverrideDraftContent(overrideDraft);

  useEffect(() => {
    if (!overrideEditorModel) {
      return;
    }
    setMfwJsonCompletionContext(overrideEditorModel, {
      nodeNameSuggestions: overrideNodeNameSuggestions,
    });
    return () => {
      clearMfwJsonCompletionContext(overrideEditorModel);
    };
  }, [overrideEditorModel, overrideNodeNameSuggestions]);

  return (
    <Space orientation="vertical" size={14} style={{ width: "100%" }}>
      {capabilityStatus === "error" && (
        <Alert
          type="error"
          showIcon
          title="调试能力读取失败"
          description={capabilityError}
        />
      )}
      {lastError && (
        <Alert
          type="error"
          showIcon
          title={lastError.code}
          description={lastError.message}
        />
      )}
      <DebugSection title="当前 / 最新运行">
        <div style={runSummaryStyle}>
          <div style={runControlStyle}>
            <div style={nodePickerStyle}>
              <Select
                showSearch
                value={selectedRunTargetNodeId}
                style={nodeSelectStyle}
                placeholder="搜索并选择 Pipeline 节点"
                filterOption={(input, option) =>
                  String(nodeSearchTextMap.get(option?.value ?? "") ?? "")
                    .toLowerCase()
                    .includes(input.trim().toLowerCase())
                }
                onChange={selectPipelineNode}
                options={nodeOptions}
                notFoundContent="当前图没有可调试 Pipeline 节点"
                optionRender={(option) => {
                  const node = runTargetNodes.find(
                    (item) => item.nodeId === option.value,
                  );
                  if (!node) return option.label;
                  return (
                    <Space orientation="vertical" size={0}>
                      <Text>{node.displayName}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {node.fileId} · {node.runtimeName}
                      </Text>
                    </Space>
                  );
                }}
              />
              <Checkbox
                checked={includeAllJsonRunTargets}
                style={includeAllNodesCheckboxStyle}
                onChange={(event) =>
                  setIncludeAllJsonRunTargets(event.target.checked)
                }
              >
                跨文件检索节点
              </Checkbox>
            </div>
            <Space wrap style={runActionsStyle}>
              <Button
                type="primary"
                icon={<CaretRightOutlined />}
                onClick={() =>
                  startRun("run-from-node", selectedRunTargetNodeId)
                }
                disabled={
                  !canStartRun ||
                  !hasSelectedNode ||
                  !availableModeIds.has("run-from-node")
                }
              >
                从此节点运行
              </Button>
              <Button
                icon={<CaretRightOutlined />}
                onClick={() =>
                  startRun("single-node-run", selectedRunTargetNodeId)
                }
                disabled={
                  !canStartRun ||
                  !hasSelectedNode ||
                  !availableModeIds.has("single-node-run")
                }
              >
                单节点运行
              </Button>
              <Button
                icon={<FileSearchOutlined />}
                onClick={() =>
                  startRun("recognition-only", selectedRunTargetNodeId)
                }
                disabled={
                  !canStartRun ||
                  !hasSelectedNode ||
                  !availableModeIds.has("recognition-only")
                }
              >
                仅识别
              </Button>
              <Button
                danger
                icon={<CaretRightOutlined />}
                onClick={() => confirmActionRun(selectedRunTargetNodeId)}
                disabled={
                  !canStartRun ||
                  !hasSelectedNode ||
                  !availableModeIds.has("action-only")
                }
              >
                仅动作
              </Button>
              <Button
                danger
                icon={<StopOutlined />}
                onClick={stopRun}
                disabled={!canStopRun}
              >
                停止
              </Button>
            </Space>
          </div>
          <div style={metaListStyle}>
            <MetaItem
              label="会话"
              value={summary.sessionId ?? session?.sessionId ?? "未创建会话"}
              wide
            />
            <MetaItem label="状态" value={session?.status ?? summary.status} />
            <MetaItem label="运行" value={currentRunLabel} />
            <MetaItem label="模式" value={summary.runMode ?? lastRunMode} />
            <MetaItem label="展示" value={displaySessionSelectionLabel} />
            <MetaItem label="事件" value={events.length} />
            <MetaItem
              label="实时事件"
              value={liveSummary.lastEvent?.seq ?? 0}
            />
            <MetaItem
              label="当前节点"
              value={summary.currentRuntimeName ?? "-"}
              wide
            />
            <MetaItem label="追踪" value="实时" />
            <MetaItem label="已访问" value={summary.visitedNodeIds.length} />
            <MetaItem label="失败" value={summary.failedNodeIds.length} />
          </div>
          <div style={metaListStyle}>
            <MetaItem
              label="耗时"
              value={`${summary.durationMs ?? 0}ms`}
            />
            <MetaItem
              label="节点"
              value={summary.visitedNodeIds.length + summary.failedNodeIds.length}
            />
            <MetaItem
              label="识别"
              value={summary.recognitionCount}
            />
            <MetaItem
              label="动作"
              value={summary.actionCount}
            />
            <MetaItem
              label="产物"
              value={summary.artifactRefCount}
            />
            <MetaItem
              label="会话"
              value={displaySessions.length || 1}
            />
          </div>
          {displaySessions.length > 0 && (
            <div style={sessionManagerStyle}>
              <Select
                mode="multiple"
                allowClear
                value={selectedDisplaySessionIds}
                style={sessionSelectStyle}
                placeholder="选择要展示的调试会话"
                options={displaySessionOptions}
                onChange={selectDisplaySessions}
                filterOption={(input, option) =>
                  String(
                    displaySessionSearchTextMap.get(option?.value ?? "") ??
                      "",
                  )
                    .toLowerCase()
                    .includes(input.trim().toLowerCase())
                }
                optionRender={(option) => {
                  const item = displaySessions.find(
                    (sessionItem) => sessionItem.id === option.value,
                  );
                  if (!item) return option.label;
                  return (
                    <Space orientation="vertical" size={0}>
                      <Text>
                        {formatDebugRunDisplayName(item.runId, item.startedAt)}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {item.status ?? "-"} · {item.eventCount} 事件 ·{" "}
                        {item.sessionId.slice(0, 8)}
                      </Text>
                    </Space>
                  );
                }}
              />
              <Space wrap>
                <Button
                  size="small"
                  onClick={selectLatestDisplaySession}
                  disabled={!latestDisplaySessionId}
                >
                  仅最新
                </Button>
                <Button
                  size="small"
                  onClick={selectAllDisplaySessions}
                  disabled={displaySessions.length === 0}
                >
                  全选
                </Button>
              </Space>
            </div>
          )}
        </div>
      </DebugSection>
      <DebugSection
        title="运行时 Override"
        collapsible
        defaultCollapsed={overrideDefaultCollapsed}
      >
        <div style={overrideSectionStyle}>
          <div style={overrideToolbarStyle}>
            <Text type="secondary">
              使用 MaaFW `pipeline_override` 兼容结构：
              {` { "RuntimeName": { ...partial pipeline... } } `}
            </Text>
            <Space wrap>
              <Button
                size="small"
                icon={<FormatPainterOutlined />}
                onClick={() =>
                  setOverrideDraft(
                    formatDebugPipelineOverrideDraft(overrideDraft, jsonIndent),
                  )
                }
              >
                格式化
              </Button>
              <Button size="small" onClick={resetOverrideDraft}>
                清空
              </Button>
            </Space>
          </div>
          <div style={overrideEditorContainerStyle}>
            <MfwJsonEditor
              height={260}
              language="json"
              value={overrideDraft}
              onChange={(value) => setOverrideDraft(value ?? "")}
              onMount={(editorInstance, monaco) => {
                ensureMfwJsonCompletionProvider(monaco);
                setOverrideEditorModel(editorInstance.getModel() ?? undefined);
              }}
              options={overrideEditorOptions}
              theme="vs"
            />
          </div>
          <Text type="secondary">{overrideSummaryText}</Text>
          {overrideValidationError && (
            <Alert
              type="error"
              showIcon
              title="Override JSON 无效"
              description={overrideValidationError}
            />
          )}
        </div>
      </DebugSection>
      {shouldShowAiSummarySection && (
        <DebugSection title="AI 简要摘要">
          {aiSummaryState.activeReport?.simpleSummary ? (
            <Space orientation="vertical" size={8} style={{ width: "100%" }}>
              <Text>{aiSummaryState.activeReport.simpleSummary}</Text>
              <Space wrap>
                <Button
                  size="small"
                  icon={<FileTextOutlined />}
                  onClick={openAiSummaryPanel}
                >
                  查看详细报告
                </Button>
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  loading={aiSummaryState.status === "generating"}
                  onClick={() => generateDebugAiSummary("full")}
                >
                  重新生成
                </Button>
              </Space>
            </Space>
          ) : (
            <Space orientation="vertical" size={8} style={{ width: "100%" }}>
              <Text type="secondary">
                尚未生成 AI 简要摘要；生成后会在这里显示结论并可跳转到详细报告。
              </Text>
              <Space wrap>
                <Button
                  size="small"
                  icon={<FileTextOutlined />}
                  loading={aiSummaryState.status === "generating"}
                  disabled={events.length === 0}
                  onClick={() => generateDebugAiSummary("full")}
                >
                  生成 AI 总结
                </Button>
                <Button size="small" onClick={openAiSummaryPanel}>
                  打开 AI 总结
                </Button>
              </Space>
            </Space>
          )}
        </DebugSection>
      )}
      {failedNodeExecutionRecords.length > 0 &&
        latestFailedNodeExecutionRecord && (
          <DebugSection title="失败节点">
            <Space orientation="vertical" size={8} style={{ width: "100%" }}>
              <div style={metaListStyle}>
                <MetaItem
                  label="失败记录"
                  value={failedNodeExecutionRecords.length}
                />
                <MetaItem
                  label="节点"
                  value={
                    latestFailedNodeExecutionRecord.label ??
                    latestFailedNodeExecutionRecord.runtimeName
                  }
                  wide
                />
                <MetaItem
                  label="seq"
                  value={`${latestFailedNodeExecutionRecord.firstSeq}-${latestFailedNodeExecutionRecord.lastSeq}`}
                />
              </div>
              <Button
                danger
                size="small"
                icon={<NodeIndexOutlined />}
                onClick={openLatestFailedNode}
              >
                查看失败节点
              </Button>
            </Space>
          </DebugSection>
        )}
    </Space>
  );
}

function MetaItem({
  label,
  value,
  wide,
}: {
  label: string;
  value: ReactNode;
  wide?: boolean;
}) {
  return (
    <span style={wide ? metaItemWideStyle : metaItemStyle}>
      <Text type="secondary">{label}</Text>
      <Text style={metaValueStyle}>{value}</Text>
    </span>
  );
}
