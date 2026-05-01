import { Alert, Button, Empty, Input, Select, Space, Tag, Typography, message } from "antd";
import {
  CopyOutlined,
  FileTextOutlined,
  NodeIndexOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import type { CSSProperties } from "react";
import ReactMarkdown from "react-markdown";
import { DebugSection } from "../DebugSection";
import type { DebugModalController } from "../../hooks/useDebugModalController";
import type { DebugNodeExecutionRecord } from "../../nodeExecutionSelector";

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
    <Space direction="vertical" size={14} style={{ width: "100%" }}>
      {aiSummaryState.status === "error" && (
        <Alert
          type="error"
          showIcon
          message="AI 总结生成失败"
          description={aiSummaryState.error}
        />
      )}
      <DebugSection title="生成报告">
        <Space direction="vertical" size={10} style={{ width: "100%" }}>
          <Space wrap>
            <Button
              type="primary"
              icon={<FileTextOutlined />}
              loading={aiSummaryState.status === "generating"}
              onClick={() => generateDebugAiSummary("full")}
            >
              生成详细报告
            </Button>
            <Button
              icon={<ReloadOutlined />}
              loading={aiSummaryState.status === "generating"}
              onClick={() => generateDebugAiSummary("failure")}
            >
              只看失败
            </Button>
            <Space.Compact>
              <Select
                showSearch
                value={selectedNodeRecord?.id}
                style={nodeRecordSelectStyle}
                placeholder="选择节点执行记录"
                options={allNodeExecutionRecords.map((record) => ({
                  value: record.id,
                  label: nodeRecordLabel(record),
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
                解释节点
              </Button>
            </Space.Compact>
            <Tag color={controller.autoGenerateAiSummary ? "green" : "default"}>
              自动生成 {controller.autoGenerateAiSummary ? "已开启" : "已关闭"}
            </Tag>
          </Space>
        </Space>
      </DebugSection>
      <DebugSection title="简单摘要">
        {report?.simpleSummary ? (
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            <Paragraph style={{ margin: 0 }}>{report.simpleSummary}</Paragraph>
            <ReportMeta report={report} />
          </Space>
        ) : (
          <Empty description="尚未生成 AI 摘要" />
        )}
      </DebugSection>
      <DebugSection title="详细报告">
        {report?.detailedReport ? (
          <Space direction="vertical" size={10} style={{ width: "100%" }}>
            <Space wrap>
              <Button
                size="small"
                icon={<CopyOutlined />}
                onClick={() => copyText(report.detailedReport, "已复制报告")}
              >
                复制报告
              </Button>
              <Button
                size="small"
                icon={<CopyOutlined />}
                onClick={() => copyText(report.prompt, "已复制 Prompt")}
              >
                复制 Prompt
              </Button>
              <Button
                size="small"
                icon={<CopyOutlined />}
                onClick={() => copyText(report.contextText, "已复制上下文")}
              >
                复制上下文
              </Button>
            </Space>
            <div style={markdownReportStyle}>
              <ReactMarkdown>{report.detailedReport}</ReactMarkdown>
            </div>
          </Space>
        ) : (
          <Empty description="生成后会在这里显示详细报告" />
        )}
      </DebugSection>
      {report?.contextText && (
        <DebugSection title="已整理上下文">
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
}: {
  report: NonNullable<DebugModalController["aiSummaryState"]["activeReport"]>;
}) {
  return (
    <Space wrap>
      <Tag>{report.target.kind === "node" ? "节点解释" : "运行报告"}</Tag>
      <Tag>{report.focus}</Tag>
      {report.target.runId && <Tag>run {report.target.runId.slice(0, 8)}</Tag>}
      {report.target.nodeLabel && <Tag>{report.target.nodeLabel}</Tag>}
      <Text type="secondary">{new Date(report.generatedAt).toLocaleString()}</Text>
    </Space>
  );
}

function nodeRecordLabel(record: DebugNodeExecutionRecord): string {
  const name = record.label ?? record.runtimeName;
  const status = record.hasFailure ? "失败" : record.status;
  return `${name} · ${status} · seq ${record.firstSeq}-${record.lastSeq}`;
}

async function copyText(text: string, successMessage: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    message.success(successMessage);
  } catch {
    message.error("复制失败");
  }
}
