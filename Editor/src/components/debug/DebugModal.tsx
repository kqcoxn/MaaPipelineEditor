import {
  useState,
  useCallback,
  useMemo,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Drawer, Space, Typography } from "antd";
import {
  CloseOutlined,
  FileSearchOutlined,
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
import { DebugLogPanel } from "../../features/debug/components/panels/DebugLogPanel";
import { WikiAnchor } from "../wiki/WikiAnchor";
import { WIKI_FLOW_DEBUG_PATH } from "../wiki/paths";

const { Text, Title } = Typography;

interface PanelItem {
  id: DebugModalPanel;
  label: string;
  icon: ReactNode;
  description: string;
}

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
  userSelect: "text",
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
  display: "inline-flex",
  alignItems: "center",
};

export function DebugModal() {
  const { t } = useTranslation();
  const controller = useDebugModalController();
  useDebugRunStatusTracker();
  const [drawerWidth, setDrawerWidth] = useState(readDrawerWidth);

  const panels = useMemo<PanelItem[]>(
    () => [
      {
        id: "setup",
        label: t("ui.debug.modal.setupLabel", "调试配置"),
        icon: <SettingOutlined />,
        description: t(
          "ui.debug.modal.setupDescription",
          "配置资源路径、控制器、截图和 Agent，并写入本地调试配置。",
        ),
      },
      {
        id: "overview",
        label: t("ui.debug.modal.overviewLabel", "中控台"),
        icon: <ProfileOutlined />,
        description: t(
          "ui.debug.modal.overviewDescription",
          "运行控制、展示会话选择和当前/最新运行摘要。",
        ),
      },
      {
        id: "node-execution",
        label: t("ui.debug.modal.nodeExecutionLabel", "节点线"),
        icon: <NodeIndexOutlined />,
        description: t(
          "ui.debug.modal.nodeExecutionDescription",
          "按 Pipeline 节点聚合已选展示会话，查看执行路径和节点详情。",
        ),
      },
      {
        id: "debug-log",
        label: t("ui.debug.modal.debugLogLabel", "调试日志"),
        icon: <FileSearchOutlined />,
        description: t(
          "ui.debug.modal.debugLogDescription",
          "查看调试产物 maafw.log 的末尾内容，可直接打开日志文件或其所在文件夹。",
        ),
      },
      {
        id: "ai-summary",
        label: t("ui.debug.modal.aiSummaryLabel", "AI 总结"),
        icon: <FileTextOutlined />,
        description: t(
          "ui.debug.modal.aiSummaryDescription",
          "查看 AI 生成的调试摘要、详细报告和整理后的上下文。",
        ),
      },
      {
        id: "resource-health",
        label: t("ui.debug.modal.resourceHealthLabel", "资源体检"),
        icon: <MedicineBoxOutlined />,
        description: t(
          "ui.debug.modal.resourceHealthDescription",
          "集中查看资源路径、资源加载结果和流程图校验，加载失败时会直接列出具体线索。",
        ),
      },
    ],
    [t],
  );

  const nodeExecutionHeadings = useMemo<
    Record<DebugExecutionAttributionMode, Pick<PanelItem, "label" | "description">>
  >(
    () => ({
      next: {
        label: t("ui.debug.modal.nodeExecutionNextLabel", "节点线（Next 模式）"),
        description: t(
          "ui.debug.modal.nodeExecutionNextDescription",
          "以节点为单位查看调试结果。\nNext 模式：以 MFW 内部执行逻辑为单位组织，将当前节点的 action 与 next-list 中的所有 reco 放在一起",
        ),
      },
      node: {
        label: t("ui.debug.modal.nodeExecutionPairLabel", "节点线（Pair 模式）"),
        description: t(
          "ui.debug.modal.nodeExecutionPairDescription",
          "以节点为单位查看调试结果。\nPair 模式：以物理节点（即定义的JSON）为单位组织，将某个节点的一次 reco-action 对放在一起",
        ),
      },
    }),
    [t],
  );

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
      title={
        <span style={drawerHeaderStyle}>
          MPE FlowScope
          <span style={{ marginTop: 5 }}>
            <WikiAnchor
              path={WIKI_FLOW_DEBUG_PATH}
              title={t("ui.debug.modal.wikiTitle", "流程级调试")}
              description={t(
                "ui.debug.modal.wikiDescription",
                "快速验证节点行为与流程执行",
              )}
            />
          </span>
        </span>
      }
      open={controller.modalOpen}
      onClose={controller.closeModal}
      placement="right"
      mask={false}
      destroyOnHidden
      resizable={{
        onResize: handleResize,
      }}
      size={drawerWidth}
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
                title={t(
                  "ui.debug.modal.readinessNotMetTitle",
                  "调试前置条件未满足",
                )}
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
    case "node-execution":
      return <NodeExecutionPanel controller={controller} />;
    case "debug-log":
      return <DebugLogPanel controller={controller} />;
    default:
      return null;
  }
}
