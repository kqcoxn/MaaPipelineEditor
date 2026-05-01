import type { CSSProperties, ReactNode } from "react";
import { Alert, Button, Modal, Space, Typography } from "antd";
import {
  ApiOutlined,
  BranchesOutlined,
  FileTextOutlined,
  NodeIndexOutlined,
  PictureOutlined,
  ProfileOutlined,
  SettingOutlined,
  StepForwardOutlined,
} from "@ant-design/icons";
import type {
  DebugExecutionAttributionMode,
  DebugModalPanel,
} from "../../features/debug/types";
import { useDebugModalController } from "../../features/debug/hooks/useDebugModalController";
import type { DebugModalController } from "../../features/debug/hooks/useDebugModalController";
import { OverviewPanel } from "../../features/debug/components/panels/OverviewPanel";
import { AiSummaryPanel } from "../../features/debug/components/panels/AiSummaryPanel";
import { SetupPanel } from "../../features/debug/components/panels/SetupPanel";
import { TimelinePanel } from "../../features/debug/components/panels/TimelinePanel";
import { NodeExecutionPanel } from "../../features/debug/components/panels/NodeExecutionPanel";
import { PerformancePanel } from "../../features/debug/components/panels/PerformancePanel";
import { ImagesPanel } from "../../features/debug/components/panels/ImagesPanel";
import { DiagnosticsPanel } from "../../features/debug/components/panels/DiagnosticsPanel";

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
    description: "运行控制、展示会话选择和当前/最新运行摘要。",
  },
  {
    id: "node-execution",
    label: "节点线",
    icon: <NodeIndexOutlined />,
    description: "按 MPE 节点聚合已选展示会话，查看执行路径和节点详情。",
  },
  {
    id: "timeline",
    label: "事件线",
    icon: <BranchesOutlined />,
    description: "按后端 seq 查看已选展示会话的事件顺序和详情。",
  },
  {
    id: "ai-summary",
    label: "AI 总结",
    icon: <FileTextOutlined />,
    description: "查看 AI 生成的调试摘要、详细报告和可复制上下文。",
  },
  {
    id: "performance",
    label: "性能",
    icon: <StepForwardOutlined />,
    description: "查看已选展示会话的性能摘要、慢节点统计和相关产物。",
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
    id: "setup",
    label: "运行配置",
    icon: <SettingOutlined />,
    description: "配置资源路径、控制器、截图和 Agent，并写入本地调试配置。",
  },
];

const nodeExecutionHeadings: Record<
  DebugExecutionAttributionMode,
  Pick<PanelItem, "label" | "description">
> = {
  next: {
    label: "节点线（Next 模式）",
    description:
      "以节点为单位查看调试结果。\nNext 模式：以 MFW 内部执行逻辑为单位组织，将当前节点的 action 与 next-list 中的所有 reco 放在一起",
  },
  node: {
    label: "节点线（Pair 模式）",
    description:
      "以节点为单位查看调试结果。\nPair 模式：以物理节点（即定义的JSON）为单位组织，将某个节点的一次 reco-action 对放在一起",
  },
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

const nodeExecutionMainStyle: CSSProperties = {
  ...scrollMainStyle,
  overflowY: "hidden",
  paddingRight: 0,
  scrollbarGutter: "auto",
};

const mainContentStyle: CSSProperties = {
  width: "100%",
  display: "flex",
  flexDirection: "column",
  gap: 16,
};

const nodeExecutionContentStyle: CSSProperties = {
  ...mainContentStyle,
  display: "flex",
  flexDirection: "column",
  height: "100%",
  minHeight: 0,
};

const nodeExecutionPanelSlotStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
};

const panelDescriptionStyle: CSSProperties = {
  whiteSpace: "pre-line",
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
  const baseActivePanelMeta =
    panels.find((panel) => panel.id === controller.activePanel) ?? panels[0];
  const nodeExecutionActive = controller.activePanel === "node-execution";
  const activePanelMeta = nodeExecutionActive
    ? {
        ...baseActivePanelMeta,
        ...nodeExecutionHeadings[controller.nodeExecutionAttributionMode],
      }
    : baseActivePanelMeta;

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

        <main
          style={nodeExecutionActive ? nodeExecutionMainStyle : scrollMainStyle}
        >
          <div
            style={
              nodeExecutionActive ? nodeExecutionContentStyle : mainContentStyle
            }
          >
            <div>
              <Title level={4} style={{ margin: 0 }}>
                {activePanelMeta.label}
              </Title>
              <Text type="secondary" style={panelDescriptionStyle}>
                {activePanelMeta.description}
              </Text>
            </div>
            {!controller.debugReadiness.ready && (
              <Alert
                type="warning"
                showIcon
                message="调试前置条件未满足"
                description={controller.debugReadinessDescription}
              />
            )}
            <div style={nodeExecutionActive ? nodeExecutionPanelSlotStyle : undefined}>
              <ActivePanel controller={controller} />
            </div>
          </div>
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
    case "ai-summary":
      return <AiSummaryPanel controller={controller} />;
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
    default:
      return null;
  }
}
