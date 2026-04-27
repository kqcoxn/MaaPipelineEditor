import { useEffect, useMemo, type ReactNode } from "react";
import { Alert, Button, Modal, Space, Tag, Typography } from "antd";
import {
  ApiOutlined,
  BranchesOutlined,
  DatabaseOutlined,
  FileSearchOutlined,
  MonitorOutlined,
  NodeIndexOutlined,
  PictureOutlined,
  ProfileOutlined,
  RobotOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { debugProtocolClient } from "../../services/server";
import { useDebugSessionStore } from "../../stores/debugSessionStore";
import { useDebugModalMemoryStore } from "../../stores/debugModalMemoryStore";
import { useWSStore } from "../../stores/wsStore";
import type { DebugModalPanel } from "../../features/debug/types";
import { debugContributionRegistry } from "../../features/debug/contributions/registry";
import "../../features/debug/contributions/runModes";

const { Text, Title } = Typography;

interface PanelItem {
  id: DebugModalPanel;
  label: string;
  icon: ReactNode;
}

const panels: PanelItem[] = [
  { id: "overview", label: "总览", icon: <ProfileOutlined /> },
  { id: "profile", label: "Profile", icon: <FileSearchOutlined /> },
  { id: "resources", label: "资源", icon: <DatabaseOutlined /> },
  { id: "controller", label: "控制器", icon: <MonitorOutlined /> },
  { id: "agent", label: "Agent", icon: <RobotOutlined /> },
  { id: "nodes", label: "节点", icon: <NodeIndexOutlined /> },
  { id: "timeline", label: "时间线", icon: <BranchesOutlined /> },
  { id: "images", label: "图像", icon: <PictureOutlined /> },
  { id: "diagnostics", label: "诊断", icon: <ApiOutlined /> },
  { id: "logs", label: "日志", icon: <UnorderedListOutlined /> },
];

export function DebugModal() {
  const {
    modalOpen,
    activePanel,
    capabilities,
    capabilityStatus,
    capabilityError,
    closeModal,
    setActivePanel,
    setCapabilities,
    setCapabilitiesLoading,
    setCapabilitiesError,
  } = useDebugSessionStore();
  const connected = useWSStore((state) => state.connected);
  const { lastRunMode, setLastPanel } = useDebugModalMemoryStore();

  useEffect(() => {
    const removeCapabilitiesListener = debugProtocolClient.onCapabilities(
      (manifest) => setCapabilities(manifest),
    );
    const removeErrorListener = debugProtocolClient.onError((error) => {
      setCapabilitiesError(error.message);
    });
    return () => {
      removeCapabilitiesListener();
      removeErrorListener();
    };
  }, [setCapabilities, setCapabilitiesError]);

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

  const runModes = useMemo(() => {
    const registeredModes = debugContributionRegistry.getRunModes();
    if (!capabilities) return registeredModes;
    return registeredModes.filter((runMode) =>
      capabilities.runModes.includes(runMode.id),
    );
  }, [capabilities]);

  const handlePanelClick = (panel: DebugModalPanel) => {
    setActivePanel(panel);
    setLastPanel(panel);
  };

  return (
    <Modal
      title="调试"
      open={modalOpen}
      onCancel={closeModal}
      width="min(1120px, calc(100vw - 48px))"
      footer={null}
      destroyOnHidden
    >
      <div style={{ display: "flex", gap: 16, minHeight: 520 }}>
        <nav
          style={{
            width: 168,
            flexShrink: 0,
            borderRight: "1px solid rgba(5, 5, 5, 0.08)",
            paddingRight: 12,
          }}
        >
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

        <main style={{ flex: 1, minWidth: 0 }}>
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <div>
              <Title level={4} style={{ margin: 0 }}>
                调试系统 P2
              </Title>
              <Text type="secondary">
                当前阶段已接入后端 run/start、run/stop、trace 和 artifact
                最小闭环。前端时间线、图像面板和节点级调试会在后续阶段接入。
              </Text>
            </div>

            {!connected && (
              <Alert
                type="warning"
                showIcon
                message="LocalBridge 未连接"
                description="可以先打开调试面板；连接后会读取 vNext capability manifest。"
              />
            )}

            {capabilityStatus === "error" && (
              <Alert
                type="error"
                showIcon
                message="调试能力读取失败"
                description={capabilityError}
              />
            )}

            <section>
              <Title level={5}>Capability</Title>
              <Space wrap>
                <Tag color={capabilities ? "green" : "default"}>
                  {capabilities?.generation ?? "pending"}
                </Tag>
                <Tag color="blue">
                  protocol {capabilities?.protocol ?? "unknown"}
                </Tag>
                <Tag>{capabilityStatus}</Tag>
              </Space>
            </section>

            <section>
              <Title level={5}>Run Modes</Title>
              <Space wrap>
                {runModes.map((runMode) => (
                  <Tag
                    key={runMode.id}
                    color={runMode.id === lastRunMode ? "blue" : "default"}
                  >
                    {runMode.label}
                  </Tag>
                ))}
              </Space>
            </section>

            <Alert
              type="info"
              showIcon
              message="P2 边界"
              description="当前仅开放完整运行和从节点运行；recognition-only、截图服务、前端 trace UI、replay/record 和节点级调试仍在后续阶段实现。"
            />
          </Space>
        </main>
      </div>
    </Modal>
  );
}
