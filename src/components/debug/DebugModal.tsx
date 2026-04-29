import type { CSSProperties, ReactNode } from "react";
import { Alert, Button, Modal, Space, Typography } from "antd";
import {
  ApiOutlined,
  BranchesOutlined,
  NodeIndexOutlined,
  PictureOutlined,
  ProfileOutlined,
  SettingOutlined,
  StepForwardOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import type { DebugModalPanel } from "../../features/debug/types";
import { useDebugModalController } from "../../features/debug/hooks/useDebugModalController";
import type { DebugModalController } from "../../features/debug/hooks/useDebugModalController";
import { OverviewPanel } from "../../features/debug/components/panels/OverviewPanel";
import { SetupPanel } from "../../features/debug/components/panels/SetupPanel";
import { TimelinePanel } from "../../features/debug/components/panels/TimelinePanel";
import { NodeExecutionPanel } from "../../features/debug/components/panels/NodeExecutionPanel";
import { PerformancePanel } from "../../features/debug/components/panels/PerformancePanel";
import { ImagesPanel } from "../../features/debug/components/panels/ImagesPanel";
import { DiagnosticsPanel } from "../../features/debug/components/panels/DiagnosticsPanel";
import { LogsPanel } from "../../features/debug/components/panels/LogsPanel";

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
    description: "查看依赖状态、会话/追踪状态和当前运行摘要。",
  },
  {
    id: "setup",
    label: "运行配置",
    icon: <SettingOutlined />,
    description: "配置资源路径、控制器、截图和 Agent，并写入本地调试配置。",
  },
  {
    id: "timeline",
    label: "时间线",
    icon: <BranchesOutlined />,
    description:
      "按后端 seq 查看 append-only trace，并在当前会话内定位或回放事件。",
  },
  {
    id: "node-execution",
    label: "节点执行",
    icon: <NodeIndexOutlined />,
    description: "按 MPE 节点聚合当前 session trace，查看执行路径和节点详情。",
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

export function DebugModal() {
  const controller = useDebugModalController();
  const activePanelMeta =
    panels.find((panel) => panel.id === controller.activePanel) ?? panels[0];

  return (
    <Modal
      title="MPE FlowScope (调试模块)"
      open={controller.modalOpen}
      onCancel={controller.closeModal}
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
                type={controller.activePanel === panel.id ? "primary" : "text"}
                icon={panel.icon}
                block
                style={{ justifyContent: "flex-start" }}
                onClick={() => controller.handlePanelClick(panel.id)}
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
            {!controller.debugReadiness.ready && (
              <Alert
                type="warning"
                showIcon
                message="调试前置条件未满足"
                description={controller.debugReadinessDescription}
              />
            )}
            <ActivePanel controller={controller} />
          </Space>
        </main>
      </div>
    </Modal>
  );
}

function ActivePanel({
  controller,
}: {
  controller: DebugModalController;
}) {
  switch (controller.activePanel) {
    case "overview":
      return <OverviewPanel controller={controller} />;
    case "setup":
      return <SetupPanel controller={controller} />;
    case "timeline":
      return <TimelinePanel controller={controller} />;
    case "node-execution":
      return <NodeExecutionPanel controller={controller} />;
    case "performance":
      return <PerformancePanel controller={controller} />;
    case "images":
      return <ImagesPanel controller={controller} />;
    case "diagnostics":
      return <DiagnosticsPanel controller={controller} />;
    case "logs":
      return <LogsPanel controller={controller} />;
    default:
      return null;
  }
}
