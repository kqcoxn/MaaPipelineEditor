import {
  useState,
  useCallback,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Alert, Button, Drawer, Space, Typography } from "antd";
import {
  CloseOutlined,
  FileTextOutlined,
  MedicineBoxOutlined,
  NodeIndexOutlined,
  ProfileOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import type {
  DebugExecutionAttributionMode,
  DebugModalPanel,
} from "../../features/debug/types";
import { useDebugModalController } from "../../features/debug/hooks/useDebugModalController";
import type { DebugModalController } from "../../features/debug/hooks/useDebugModalController";
import { useDebugRunStatusTracker } from "../../features/debug/hooks/useDebugRunStatusTracker";
import { OverviewPanel } from "../../features/debug/components/panels/OverviewPanel";
import { AiSummaryPanel } from "../../features/debug/components/panels/AiSummaryPanel";
import { SetupPanel } from "../../features/debug/components/panels/SetupPanel";
import { ResourceHealthPanel } from "../../features/debug/components/panels/ResourceHealthPanel";
import { NodeExecutionPanel } from "../../features/debug/components/panels/NodeExecutionPanel";

const { Text, Title } = Typography;

interface PanelItem {
  id: DebugModalPanel;
  label: string;
  icon: ReactNode;
  description: string;
}

const panels: PanelItem[] = [
  {
    id: "setup",
    label: "调试配置",
    icon: <SettingOutlined />,
    description: "配置资源路径、控制器、截图和 Agent，并写入本地调试配置。",
  },
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
    description: "按 Pipeline 节点聚合已选展示会话，查看执行路径和节点详情。",
  },
  {
    id: "ai-summary",
    label: "AI 总结",
    icon: <FileTextOutlined />,
    description: "查看 AI 生成的调试摘要、详细报告和整理后的上下文。",
  },
  {
    id: "resource-health",
    label: "资源体检",
    icon: <MedicineBoxOutlined />,
    description:
      "集中查看资源路径、资源加载结果和流程图校验，加载失败时会直接列出具体线索。",
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
  width: 132,
  flexShrink: 0,
  borderRight: "1px solid rgba(5, 5, 5, 0.08)",
  paddingRight: 12,
};

const scrollMainStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  height: "100%",
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

const DRAWER_WIDTH_KEY = "mpe_debug_drawer_width_v1";
const DEFAULT_DRAWER_WIDTH = 900;
const MIN_DRAWER_WIDTH = 600;
const MAX_DRAWER_WIDTH = 1200;

function readDrawerWidth(): number {
  try {
    const raw = localStorage.getItem(DRAWER_WIDTH_KEY);
    if (!raw) return DEFAULT_DRAWER_WIDTH;
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) &&
      parsed >= MIN_DRAWER_WIDTH &&
      parsed <= MAX_DRAWER_WIDTH
      ? parsed
      : DEFAULT_DRAWER_WIDTH;
  } catch {
    return DEFAULT_DRAWER_WIDTH;
  }
}

function saveDrawerWidth(width: number): void {
  try {
    localStorage.setItem(DRAWER_WIDTH_KEY, String(width));
  } catch {
    // ignore
  }
}

const drawerBodyStyle: CSSProperties = {
  display: "flex",
  gap: 16,
  flex: 1,
  minHeight: 0,
  overflow: "hidden",
};

const drawerHeaderStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 500,
};

export function DebugModal() {
  const controller = useDebugModalController();
  useDebugRunStatusTracker();
  const [drawerWidth, setDrawerWidth] = useState(readDrawerWidth);
  const baseActivePanelMeta =
    panels.find((panel) => panel.id === controller.activePanel) ?? panels[0];
  const nodeExecutionActive = controller.activePanel === "node-execution";
  const activePanelMeta = nodeExecutionActive
    ? {
        ...baseActivePanelMeta,
        ...nodeExecutionHeadings[controller.nodeExecutionAttributionMode],
      }
    : baseActivePanelMeta;

  const handleResize = useCallback((size: number) => {
    const clamped = Math.max(
      MIN_DRAWER_WIDTH,
      Math.min(size, MAX_DRAWER_WIDTH),
    );
    setDrawerWidth(clamped);
    saveDrawerWidth(clamped);
  }, []);

  return (
    <Drawer
      title={<span style={drawerHeaderStyle}>MPE FlowScope</span>}
      open={controller.modalOpen}
      onClose={controller.closeModal}
      placement="right"
      mask={false}
      destroyOnHidden
      resizable={{
        onResize: handleResize,
      }}
      size={drawerWidth}
      minSize={MIN_DRAWER_WIDTH}
      maxSize={MAX_DRAWER_WIDTH}
      closeIcon={
        <CloseOutlined style={{ color: "rgba(0, 0, 0, 0.65)", fontSize: 16 }} />
      }
      styles={{
        body: {
          padding: 16,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        },
        header: {
          padding: "20px 24px",
        },
        close: {
          color: "rgba(0, 0, 0, 0.65)",
        },
      }}
    >
      <div style={drawerBodyStyle}>
        <nav style={navStyle}>
          <Space orientation="vertical" size={4} style={{ width: "100%" }}>
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
                title="调试前置条件未满足"
                description={controller.debugReadinessDescription}
              />
            )}
            <div
              style={
                nodeExecutionActive ? nodeExecutionPanelSlotStyle : undefined
              }
            >
              <ActivePanel controller={controller} />
            </div>
          </div>
        </main>
      </div>
    </Drawer>
  );
}

function ActivePanel({ controller }: { controller: DebugModalController }) {
  switch (controller.activePanel) {
    case "overview":
      return <OverviewPanel controller={controller} />;
    case "ai-summary":
      return <AiSummaryPanel controller={controller} />;
    case "setup":
      return <SetupPanel controller={controller} />;
    case "resource-health":
      return <ResourceHealthPanel controller={controller} />;
    default:
      return null;
  }
}
