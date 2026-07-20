import { Alert, Button, Empty, Input, Select, Space, Tag, Typography, message } from "antd";
import {
  CopyOutlined,
  FileTextOutlined,
  NodeIndexOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import type { CSSProperties } from "react";
import type { TFunction } from "i18next";
import ReactMarkdown from "react-markdown";
import { DebugSection } from "../DebugSection";
import { useDebugComponentT } from "../useDebugComponentT";
import type { DebugModalController } from "../../hooks/useDebugModalController";
import type { DebugNodeExecutionRecord } from "../../nodeExecutionSelector";
import type { DebugNodeExecutionStatus } from "../../types";

const { Paragraph, Text } = Typography;

const markdownReportStyle: CSSProperties = {
  wordBreak: "break-word",
  overflowWrap: "anywhere",
};

const nodeRecordSelectStyle: CSSProperties = {
  width: 260,
  maxWidth: "min(260px, 58vw)",
};

interface NodeRecordOption {
  value: string;
  label: string;
  searchText: string;
}

export function AiSummaryPanel({
  controller,
}: {
  controller: DebugModalController;
}) {
  const { t, statusLabel } = useDebugComponentT();
  const {
    aiSummaryState,
    allNodeExecutionRecords,
    selectedNodeExecutionRecordId,
    setSelectedNodeExecutionRecordId,
    generateDebugAiSummary,
  } = controller;
  const report = aiSummaryState.activeReport;
  const selectedNodeRecord =
    allNodeExecutionRecords.find(
      (record) => record.id === selectedNodeExecutionRecordId,
    ) ?? allNodeExecutionRecords.find((record) => record.hasFailure);

  return (
    <Space orientation="vertical" size={14} style={{ width: "100%" }}>
      {aiSummaryState.status === "error" && (
        <Alert
          type="error"
          showIcon
          title={t("debug.aiSummary.generateFailed", "AI 总结生成失败")}
          description={aiSummaryState.error}
        />
      )}
      <DebugSection title={t("debug.aiSummary.generateReport", "生成报告")}>
        <Space orientation="vertical" size={10} style={{ width: "100%" }}>
          <Space wrap>
            <Button
              type="primary"
              icon={<FileTextOutlined />}
              loading={aiSummaryState.status === "generating"}
              onClick={() => generateDebugAiSummary("full")}
            >
              {t("debug.aiSummary.generateFull", "生成详细报告")}
            </Button>
            <Button
              icon={<ReloadOutlined />}
              loading={aiSummaryState.status === "generating"}
              onClick={() => generateDebugAiSummary("failure")}
            >
              {t("debug.aiSummary.failureOnly", "只看失败")}
            </Button>
            <Space.Compact>
              <Select
                showSearch
                value={selectedNodeRecord?.id}
                style={nodeRecordSelectStyle}
                placeholder={t(
                  "debug.aiSummary.selectNodeRecord",
                  "选择节点执行记录",
                )}
                options={allNodeExecutionRecords.map((record) => ({
                  value: record.id,
                  label: nodeRecordLabel(record, t, statusLabel),
                  searchText: [
                    record.label,
                    record.runtimeName,
                    record.nodeId,
                    record.fileId,
                    record.sourcePath,
                  ]
                    .filter(Boolean)
                    .join(" "),
                }))}
                filterOption={(input, option) =>
                  String((option as NodeRecordOption | undefined)?.searchText ?? "")
                    .toLowerCase()
                    .includes(input.trim().toLowerCase())
                }
                onChange={setSelectedNodeExecutionRecordId}
              />
              <Button
                icon={<NodeIndexOutlined />}
                loading={aiSummaryState.status === "generating"}
                disabled={!selectedNodeRecord}
                onClick={() => generateDebugAiSummary("node", selectedNodeRecord)}
              >
                {t("debug.aiSummary.explainNode", "解释节点")}
              </Button>
            </Space.Compact>
            <Tag color={controller.autoGenerateAiSummary ? "green" : "default"}>
              {t("debug.aiSummary.autoGenerate", "自动生成")}{" "}
              {controller.autoGenerateAiSummary
                ? t("debug.aiSummary.autoOn", "已开启")
                : t("debug.aiSummary.autoOff", "已关闭")}
            </Tag>
          </Space>
        </Space>
      </DebugSection>
      <DebugSection title={t("debug.aiSummary.simpleSummary", "简单摘要")}>
        {report?.simpleSummary ? (
          <Space orientation="vertical" size={8} style={{ width: "100%" }}>
            <Paragraph style={{ margin: 0 }}>{report.simpleSummary}</Paragraph>
            <ReportMeta report={report} t={t} />
          </Space>
        ) : (
          <Empty
            description={t("debug.aiSummary.noSimpleSummary", "尚未生成 AI 摘要")}
          />
        )}
      </DebugSection>
      <DebugSection title={t("debug.aiSummary.detailedReport", "详细报告")}>
        {report?.detailedReport ? (
          <Space orientation="vertical" size={10} style={{ width: "100%" }}>
            <Space wrap>
              <Button
                size="small"
                icon={<CopyOutlined />}
                onClick={() =>
                  copyText(
                    report.detailedReport,
                    t,
                    "debug.aiSummary.reportCopied",
                    "已复制报告",
                  )
                }
              >
                {t("debug.aiSummary.copyReport", "复制报告")}
              </Button>
              <Button
                size="small"
                icon={<CopyOutlined />}
                onClick={() =>
                  copyText(
                    report.prompt,
                    t,
                    "debug.aiSummary.promptCopied",
                    "已复制 Prompt",
                  )
                }
              >
                {t("debug.aiSummary.copyPrompt", "复制 Prompt")}
              </Button>
              <Button
                size="small"
                icon={<CopyOutlined />}
                onClick={() =>
                  copyText(
                    report.contextText,
                    t,
                    "debug.aiSummary.contextCopied",
                    "已复制上下文",
                  )
                }
              >
                {t("debug.aiSummary.copyContext", "复制上下文")}
              </Button>
            </Space>
            <div style={markdownReportStyle}>
              <ReactMarkdown>{report.detailedReport}</ReactMarkdown>
            </div>
          </Space>
        ) : (
          <Empty
            description={t(
              "debug.aiSummary.detailedPlaceholder",
              "生成后会在这里显示详细报告",
            )}
          />
        )}
      </DebugSection>
      {report?.contextText && (
        <DebugSection
          title={t("debug.aiSummary.organizedContext", "已整理上下文")}
        >
          <Input.TextArea
            value={report.contextText}
            readOnly
            autoSize={{ minRows: 4, maxRows: 10 }}
          />
        </DebugSection>
      )}
    </Space>
  );
}

function ReportMeta({
  report,
  t,
}: {
  report: NonNullable<DebugModalController["aiSummaryState"]["activeReport"]>;
  t: TFunction;
}) {
  return (
    <Space wrap>
      <Tag>
        {report.target.kind === "node"
          ? t("debug.aiSummary.nodeExplain", "节点解释")
          : t("debug.aiSummary.runReport", "运行报告")}
      </Tag>
      <Tag>{report.focus}</Tag>
      {report.target.runId && <Tag>run {report.target.runId.slice(0, 8)}</Tag>}
      {report.target.nodeLabel && <Tag>{report.target.nodeLabel}</Tag>}
      <Text type="secondary">{new Date(report.generatedAt).toLocaleString()}</Text>
    </Space>
  );
}

function nodeRecordLabel(
  record: DebugNodeExecutionRecord,
  t: TFunction,
  statusLabelFn: (status: DebugNodeExecutionStatus) => string,
): string {
  const name = record.label ?? record.runtimeName;
  const status = record.hasFailure
    ? t("debug.aiSummary.recordStatusFailed", "失败")
    : statusLabelFn(record.status);
  return `${name} · ${status} · seq ${record.firstSeq}-${record.lastSeq}`;
}

async function copyText(
  text: string,
  t: TFunction,
  successKey: string,
  successDefault: string,
): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    message.success(t(successKey, successDefault));
  } catch {
    message.error(t("debug.common.copyFailed", "复制失败"));
  }
}
