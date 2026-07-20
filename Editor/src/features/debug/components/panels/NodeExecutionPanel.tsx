import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Button, Checkbox, Empty, Input, Segmented, Select, Space, Tag, Typography } from "antd";
import {
  AimOutlined,
  ClearOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { DebugSection } from "../DebugSection";
import type { DebugModalController } from "../../hooks/useDebugModalController";
import type { DebugNodeExecutionRecord } from "../../nodeExecutionSelector";
import { groupDebugNodeExecutionRecords } from "../../nodeExecutionSelector";
import {
  resolveAutoLoadAttemptArtifact,
  selectDebugNodeExecutionAttemptForDetailMode,
} from "../../nodeExecutionAttempts";
import {
  GroupedRecordList,
  RecordList,
} from "./NodeExecutionRecordList";
import type {
  DebugExecutionAttributionMode,
  DebugExecutionDetailMode,
  DebugEventKind,
  DebugNodeExecutionArtifactFilter,
  DebugNodeExecutionEventKindFilter,
  DebugNodeExecutionStatusFilter,
  DebugNodeExecutionSortMode,
} from "../../types";
import { DEFAULT_DEBUG_NODE_EXECUTION_FILTERS } from "../../types";
import { NodeExecutionRecordDetails } from "./NodeExecutionRecordDetails";
import {
  findDebugRunFirstTimestamp,
  formatDebugRunDisplayName,
} from "../../runDisplayName";
import { formatDebugNodeDisplayName } from "../../syntheticNode";
import { useDebugComponentT } from "../useDebugComponentT";

const workspaceStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))",
  alignItems: "start",
  gap: 12,
  flex: "1 1 0",
  minHeight: 0,
  overflow: "hidden",
};

const panelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 14,
  height: "100%",
  minHeight: 0,
  width: "100%",
};

const scrollPaneStyle: CSSProperties = {
  minWidth: 0,
  minHeight: 0,
  height: "100%",
  overflowY: "auto",
  overflowX: "hidden",
  paddingRight: 4,
  scrollbarGutter: "stable",
};

const eventKindFilterValues = [
  "node",
  "recognition",
  "action",
  "next-list",
  "wait-freezes",
  "diagnostic",
  "screenshot",
  "artifact",
  "task",
  "session",
  "log",
] satisfies DebugEventKind[];

export function NodeExecutionPanel({
  controller,
}: {
  controller: DebugModalController;
}) {
  const { t } = useTranslation();
  const { statusLabel, eventKindLabel } = useDebugComponentT();
  const {
    allNodeExecutionRecords,
    artifacts,
    events,
    nodeExecutionAttributionMode,
    nodeExecutionDetailMode,
    nodeExecutionFilters,
    nodeExecutionRecords,
    nodeExecutionResolverNodes,
    pipelineNodes,
    requestArtifact,
    resolverEdgeIndex,
    selectedArtifact,
    selectedNodeExecutionAttemptId,
    selectedFlowNodeId,
    selectedNodeExecutionRecordId,
    selectNodeExecutionRecord,
    setSelectedNodeExecutionAttemptId,
    setSelectedNodeExecutionRecordId,
    setNodeExecutionAttributionMode,
    setNodeExecutionDetailMode,
    setNodeExecutionFilters,
    summary,
  } = controller;
  const [searchText, setSearchText] = useState("");
  const rawNodeExecutionCount = useMemo(
    () => Object.values(summary.nodeReplays).flat().length,
    [summary.nodeReplays],
  );
  const visibleRecords = useMemo(
    () => filterRecordsBySearch(nodeExecutionRecords, searchText),
    [nodeExecutionRecords, searchText],
  );
  const groupedRecords = useMemo(
    () => groupDebugNodeExecutionRecords(visibleRecords),
    [visibleRecords],
  );
  const selectedFlowNode = pipelineNodes.find(
    (node) => node.nodeId === selectedFlowNodeId,
  );
  const selectedRecord =
    visibleRecords.find(
      (record) => record.id === selectedNodeExecutionRecordId,
    ) ?? visibleRecords[0];

  const statusOptions = useMemo(
    (): Array<{ value: DebugNodeExecutionStatusFilter; label: string }> => [
      {
        value: "all",
        label: t("debug.nodeExecution.filters.statusAll", "全部状态"),
      },
      { value: "running", label: statusLabel("running") },
      { value: "succeeded", label: statusLabel("succeeded") },
      { value: "failed", label: statusLabel("failed") },
      { value: "visited", label: statusLabel("visited") },
    ],
    [statusLabel, t],
  );

  const eventKindOptions = useMemo(
    (): Array<{ value: DebugNodeExecutionEventKindFilter; label: string }> => [
      {
        value: "all",
        label: t("debug.nodeExecution.filters.eventAll", "全部事件"),
      },
      ...eventKindFilterValues.map((kind) => ({
        value: kind,
        label: eventKindLabel(kind),
      })),
    ],
    [eventKindLabel, t],
  );

  const artifactOptions = useMemo(
    (): Array<{ value: DebugNodeExecutionArtifactFilter; label: string }> => [
      {
        value: "all",
        label: t("debug.nodeExecution.filters.artifactAll", "全部产物"),
      },
      {
        value: "with-artifact",
        label: t("debug.nodeExecution.filters.artifactWith", "含产物"),
      },
      {
        value: "without-artifact",
        label: t("debug.nodeExecution.filters.artifactWithout", "无产物"),
      },
    ],
    [t],
  );

  const sortOptions = useMemo(
    (): Array<{ value: DebugNodeExecutionSortMode; label: string }> => [
      {
        value: "execution",
        label: t("debug.nodeExecution.filters.sortExecution", "执行顺序"),
      },
      {
        value: "failure-first",
        label: t("debug.nodeExecution.filters.sortFailureFirst", "失败优先"),
      },
      {
        value: "latest",
        label: t("debug.nodeExecution.filters.sortLatest", "最新优先"),
      },
    ],
    [t],
  );

  const attributionModeOptions = useMemo(
    (): Array<{ value: DebugExecutionAttributionMode; label: string }> => [
      {
        value: "next",
        label: t("debug.nodeExecution.filters.attributionNext", "Next 模式"),
      },
      {
        value: "node",
        label: t("debug.nodeExecution.filters.attributionPair", "Pair 模式"),
      },
    ],
    [t],
  );

  const detailModeOptions = useMemo(
    (): Array<{ value: DebugExecutionDetailMode; label: string }> => [
      {
        value: "compact",
        label: t("debug.nodeExecution.filters.detailCompact", "精简"),
      },
      {
        value: "detailed",
        label: t("debug.nodeExecution.filters.detailFull", "详细"),
      },
    ],
    [t],
  );

  const userSelectedArtifactRef = useRef(false);

  const userRequestArtifact = useCallback(
    (artifactId: string) => {
      userSelectedArtifactRef.current = true;
      requestArtifact(artifactId);
    },
    [requestArtifact],
  );

  useEffect(() => {
    userSelectedArtifactRef.current = false;
  }, [selectedNodeExecutionAttemptId, selectedRecord]);

  useEffect(() => {
    if (!selectedRecord) {
      if (selectedNodeExecutionRecordId) {
        setSelectedNodeExecutionRecordId(undefined);
      }
      return;
    }
    if (selectedRecord.id !== selectedNodeExecutionRecordId) {
      setSelectedNodeExecutionRecordId(selectedRecord.id);
      setSelectedNodeExecutionAttemptId(undefined);
    }
  }, [
    selectedNodeExecutionRecordId,
    selectedRecord,
    setSelectedNodeExecutionAttemptId,
    setSelectedNodeExecutionRecordId,
  ]);

  useEffect(() => {
    if (userSelectedArtifactRef.current) return;
    const selectedAttempt = selectedRecord
      ? selectDebugNodeExecutionAttemptForDetailMode(
          selectedRecord,
          nodeExecutionDetailMode,
          selectedNodeExecutionAttemptId,
        )
      : undefined;
    const artifactId = resolveAutoLoadAttemptArtifact(
      artifacts,
      selectedAttempt,
      selectedArtifact?.ref.id,
    );
    if (artifactId) requestArtifact(artifactId);
  }, [
    artifacts,
    nodeExecutionDetailMode,
    requestArtifact,
    selectedArtifact?.ref.id,
    selectedNodeExecutionAttemptId,
    selectedRecord,
  ]);

  // Auto-load detail JSON refs for overlay data (boxes, text, etc.)
  useEffect(() => {
    const selectedAttempt = selectedRecord
      ? selectDebugNodeExecutionAttemptForDetailMode(
          selectedRecord,
          nodeExecutionDetailMode,
          selectedNodeExecutionAttemptId,
        )
      : undefined;
    if (!selectedAttempt) return;
    for (const detailRef of selectedAttempt.detailRefs) {
      const entry = artifacts[detailRef];
      if (!entry || (entry.status !== "ready" && entry.status !== "loading")) {
        requestArtifact(detailRef);
      }
    }
  }, [
    artifacts,
    nodeExecutionDetailMode,
    requestArtifact,
    selectedNodeExecutionAttemptId,
    selectedRecord,
  ]);

  const nodeOptions = useMemo(
    () => {
      const runtimeOnlyOptions = uniqueRuntimeOnlyOptions(
        allNodeExecutionRecords,
      );
      const systemRecordOptions = uniqueSystemRecordOptions(
        allNodeExecutionRecords,
        t,
      );
      return [
        {
          value: "",
          label: t("debug.nodeExecution.panel.allNodes", "全部节点"),
        },
        ...systemRecordOptions,
        ...nodeExecutionResolverNodes.map((node) => ({
          value: node.nodeId,
          label: node.sourcePath
            ? `${node.displayName} · ${node.runtimeName} · ${node.sourcePath}`
            : `${node.displayName} · ${node.runtimeName}`,
        })),
        ...runtimeOnlyOptions,
      ];
    },
    [allNodeExecutionRecords, nodeExecutionResolverNodes, t],
  );
  const runOptions = useMemo(
    () => [
      {
        value: "",
        label: t("debug.nodeExecution.panel.allRuns", "全部运行"),
      },
      ...uniqueStrings(allNodeExecutionRecords.map((record) => record.runId)).map(
        (runId) => ({
          value: runId,
          label: formatDebugRunDisplayName(
            runId,
            findDebugRunFirstTimestamp(runId, events),
          ),
        }),
      ),
    ],
    [allNodeExecutionRecords, events, t],
  );

  const handleSelectRecord = (record: DebugNodeExecutionRecord) => {
    selectNodeExecutionRecord(record);
  };

  const setSelectedFlowFilter = () => {
    if (!selectedFlowNode) return;
    setNodeExecutionFilters({
      ...nodeExecutionFilters,
      nodeId: selectedFlowNode.nodeId,
    });
  };

  const clearFilters = () => {
    setSearchText("");
    setNodeExecutionFilters(DEFAULT_DEBUG_NODE_EXECUTION_FILTERS);
  };

  if (events.length === 0) {
    return (
      <Empty
        description={t(
          "debug.nodeExecution.panel.noRecords",
          "暂无节点执行记录",
        )}
      />
    );
  }

  if (rawNodeExecutionCount === 0) {
    return (
      <Empty
        description={t(
          "debug.nodeExecution.panel.noMappableEvents",
          "当前 trace 尚未出现可映射节点事件",
        )}
      />
    );
  }

  return (
    <div style={panelStyle}>
      <DebugSection
        title={t("debug.nodeExecution.panel.filterTitle", "节点执行筛选")}
        collapsible
        defaultCollapsed
      >
        <Space wrap>
          <Tag>
            {t("debug.common.run", "运行")}{" "}
            {formatDebugRunDisplayName(
              summary.runId,
              findDebugRunFirstTimestamp(summary.runId, events),
            )}
          </Tag>
          <Tag>
            {t("debug.nodeExecution.panel.records", "记录 {{count}}", {
              count: visibleRecords.length,
            })}
          </Tag>
          <Segmented
            size="small"
            value={nodeExecutionAttributionMode}
            options={attributionModeOptions}
            onChange={(mode) =>
              setNodeExecutionAttributionMode(
                mode as DebugExecutionAttributionMode,
              )
            }
          />
          <Typography.Text type="secondary">
            {nodeExecutionAttributionMode === "next"
              ? t(
                  "debug.nodeExecution.panel.nextModeHint",
                  "Next 看跳转判断",
                )
              : t(
                  "debug.nodeExecution.panel.pairModeHint",
                  "Pair 看识别 / 动作",
                )}
          </Typography.Text>
          <Segmented
            size="small"
            value={nodeExecutionDetailMode}
            options={detailModeOptions}
            onChange={(mode) =>
              setNodeExecutionDetailMode(mode as DebugExecutionDetailMode)
            }
          />
          <Select
            size="small"
            style={{ minWidth: 160 }}
            value={nodeExecutionFilters.runId ?? ""}
            options={runOptions}
            showSearch
            optionFilterProp="label"
            onChange={(runId) =>
              setNodeExecutionFilters({
                ...nodeExecutionFilters,
                runId: runId || undefined,
              })
            }
          />
          <Input
            size="small"
            allowClear
            prefix={<SearchOutlined />}
            placeholder={t(
              "debug.nodeExecution.panel.searchPlaceholder",
              "搜索节点 / runtime / seq",
            )}
            style={{ width: 220 }}
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
          <Select
            size="small"
            style={{ minWidth: 220 }}
            value={nodeExecutionFilters.nodeId ?? ""}
            options={nodeOptions}
            showSearch
            optionFilterProp="label"
            onChange={(nodeId) =>
              setNodeExecutionFilters({
                ...nodeExecutionFilters,
                nodeId: nodeId || undefined,
              })
            }
          />
          <Select
            size="small"
            style={{ width: 132 }}
            value={nodeExecutionFilters.status}
            options={statusOptions}
            onChange={(status) =>
              setNodeExecutionFilters({
                ...nodeExecutionFilters,
                status,
              })
            }
          />
          <Select
            size="small"
            style={{ width: 132 }}
            value={nodeExecutionFilters.eventKind ?? "all"}
            options={eventKindOptions}
            onChange={(eventKind) =>
              setNodeExecutionFilters({
                ...nodeExecutionFilters,
                eventKind,
              })
            }
          />
          <Select
            size="small"
            style={{ width: 120 }}
            value={nodeExecutionFilters.artifact ?? "all"}
            options={artifactOptions}
            onChange={(artifact) =>
              setNodeExecutionFilters({
                ...nodeExecutionFilters,
                artifact,
              })
            }
          />
          <Select
            size="small"
            style={{ width: 132 }}
            value={nodeExecutionFilters.sortMode ?? "execution"}
            options={sortOptions}
            onChange={(sortMode) =>
              setNodeExecutionFilters({
                ...nodeExecutionFilters,
                sortMode,
              })
            }
          />
          <Checkbox
            checked={nodeExecutionFilters.groupRepeated === true}
            onChange={(event) =>
              setNodeExecutionFilters({
                ...nodeExecutionFilters,
                groupRepeated: event.target.checked,
              })
            }
          >
            {t("debug.nodeExecution.panel.groupByNode", "按节点折叠")}
          </Checkbox>
          <Button
            size="small"
            icon={<AimOutlined />}
            disabled={!selectedFlowNode}
            onClick={setSelectedFlowFilter}
          >
            {t(
              "debug.nodeExecution.panel.selectedNodeOnly",
              "只看选中节点",
            )}
          </Button>
          <Button size="small" icon={<ClearOutlined />} onClick={clearFilters}>
            {t("debug.nodeExecution.panel.clearFilters", "清空筛选")}
          </Button>
        </Space>
      </DebugSection>

      {nodeExecutionRecords.length === 0 ? (
        <Empty
          description={t(
            "debug.nodeExecution.panel.noFilterMatch",
            "没有符合筛选条件的节点执行记录",
          )}
        />
      ) : visibleRecords.length === 0 ? (
        <Empty
          description={t(
            "debug.nodeExecution.panel.noSearchMatch",
            "没有符合搜索条件的节点执行记录",
          )}
        />
      ) : (
        <div style={workspaceStyle}>
          <div style={scrollPaneStyle}>
            {nodeExecutionFilters.groupRepeated ? (
              <GroupedRecordList
                events={events}
                groups={groupedRecords}
                detailMode={nodeExecutionDetailMode}
                onSelectRecord={handleSelectRecord}
                selectedRecordId={selectedRecord?.id}
                totalRecordCount={visibleRecords.length}
              />
            ) : (
              <RecordList
                events={events}
                records={visibleRecords}
                detailMode={nodeExecutionDetailMode}
                onSelectRecord={handleSelectRecord}
                selectedRecordId={selectedRecord?.id}
              />
            )}
          </div>
          <div style={scrollPaneStyle}>
            {selectedRecord && (
              <NodeExecutionRecordDetails
                artifacts={artifacts}
                detailMode={nodeExecutionDetailMode}
                events={events}
                onSelectAttempt={setSelectedNodeExecutionAttemptId}
                record={selectedRecord}
                requestArtifact={userRequestArtifact}
                resolverEdgeIndex={resolverEdgeIndex}
                selectedArtifact={selectedArtifact}
                selectedAttemptId={selectedNodeExecutionAttemptId}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function filterRecordsBySearch(
  records: DebugNodeExecutionRecord[],
  searchText: string,
): DebugNodeExecutionRecord[] {
  const keyword = searchText.trim().toLowerCase();
  if (!keyword) return records;
  return records.filter((record) =>
    [
      record.label,
      record.runtimeName,
      record.fileId,
      record.nodeId,
      record.sourcePath,
      record.runId,
      record.status,
      `seq ${record.firstSeq}-${record.lastSeq}`,
      ...record.eventKinds,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(keyword)),
  );
}

function uniqueRuntimeOnlyOptions(records: DebugNodeExecutionRecord[]) {
  return uniqueStrings(
    records
      .filter((record) => record.unmapped)
      .map((record) => record.runtimeName),
  ).map((runtimeName) => ({
    value: runtimeName,
    label: `${runtimeName} · runtimeName-only`,
  }));
}

function uniqueSystemRecordOptions(
  records: DebugNodeExecutionRecord[],
  t: TFunction,
) {
  const options = new Map<string, string>();
  for (const record of records) {
    if (!record.syntheticKind) continue;
    options.set(
      record.runtimeName,
      t("debug.nodeExecution.panel.systemRecordOption", "{{name}} · 系统记录", {
        name: formatDebugNodeDisplayName(record, record.runtimeName),
      }),
    );
  }
  return [...options.entries()].map(([value, label]) => ({ value, label }));
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim() !== ""))];
}
