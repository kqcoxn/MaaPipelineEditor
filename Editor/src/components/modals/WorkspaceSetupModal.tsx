import { FolderOpenOutlined, ReloadOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  message,
  Modal,
  Radio,
  Space,
  Spin,
  Typography,
} from "antd";
import { useEffect, useState } from "react";
import { useShallow } from "zustand/shallow";

import { localServer } from "../../services/server";
import { useWSStore } from "../../stores/wsStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import {
  isDesktopEnvironment,
  openDesktopProject,
} from "../../services/desktopProject";

const { Paragraph, Text } = Typography;

export function WorkspaceSetupModal() {
  const connected = useWSStore((state) => state.connected);
  const workspace = useWorkspaceStore(
    useShallow((state) => ({
      state: state.state,
      reason: state.reason,
      root: state.root,
      candidates: state.candidates,
      currentInterface: state.currentInterface,
      diagnostics: state.diagnostics,
      selectorOpen: state.selectorOpen,
    })),
  );
  const [selectedPath, setSelectedPath] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [openingProject, setOpeningProject] = useState(false);
  const desktop = isDesktopEnvironment();
  const discovering = workspace.state === "discovering";
  const requiresSelection = workspace.state === "selection_required";
  const invalid = workspace.state === "invalid";
  const open =
    connected &&
    (discovering || invalid || requiresSelection || workspace.selectorOpen);
  const blocking = discovering || invalid || requiresSelection;

  useEffect(() => {
    if (!open) return;
    const current = workspace.currentInterface?.interface_path;
    setSelectedPath(
      current &&
        workspace.candidates.some(
          (candidate) => candidate.interface_path === current,
        )
        ? current
        : "",
    );
  }, [open, workspace.candidates, workspace.currentInterface]);

  const refresh = () => {
    if (!localServer.send("workspace.scan", {})) {
      message.error("重新检测请求发送失败");
    }
  };

  const selectInterface = async () => {
    if (!selectedPath) return;
    setSubmitting(true);
    try {
      await localServer.request("workspace.interface.select", {
        interface_path: selectedPath,
      });
      useWorkspaceStore.getState().closeSelector();
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "Interface 选择失败",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const openProject = async () => {
    setOpeningProject(true);
    try {
      const result = await openDesktopProject();
      if (result.status === "failed") {
        message.error(
          result.error instanceof Error
            ? result.error.message
            : String(result.error),
        );
      }
    } finally {
      setOpeningProject(false);
    }
  };

  const footer = discovering
    ? null
    : invalid
    ? [
        desktop && (
          <Button
            key="open-project"
            icon={<FolderOpenOutlined />}
            loading={openingProject}
            onClick={() => void openProject()}
          >
            打开项目
          </Button>
        ),
        <Button
          key="refresh"
          type={desktop ? "default" : "primary"}
          icon={<ReloadOutlined />}
          onClick={refresh}
        >
          重新检测
        </Button>,
      ]
    : [
        !blocking && (
          <Button
            key="cancel"
            onClick={() => useWorkspaceStore.getState().closeSelector()}
          >
            取消
          </Button>
        ),
        <Button
          key="select"
          type="primary"
          loading={submitting}
          disabled={!selectedPath}
          onClick={() => void selectInterface()}
        >
          使用此 Interface
        </Button>,
      ];

  return (
    <Modal
      title={
        <Space>
          <FolderOpenOutlined />
          <span>
            {discovering
              ? "正在检测 MaaFramework 项目"
              : invalid
                ? "未找到 MaaFramework 项目"
                : "选择 Project Interface"}
          </span>
        </Space>
      }
      open={open}
      closable={!blocking}
      mask={{ closable: false }}
      keyboard={!blocking}
      destroyOnHidden
      width={620}
      onCancel={() => useWorkspaceStore.getState().closeSelector()}
      footer={footer}
    >
      {discovering ? (
        <div style={{ padding: "28px 0", textAlign: "center" }}>
          <Spin description="正在搜索 interface.json 和 interface.jsonc" />
        </div>
      ) : invalid ? (
        <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
          <Alert
            type="error"
            showIcon
            title={invalidReason(workspace.reason)}
            description={
              desktop
                ? "请选择包含 MaaFramework 项目的目录，或重新检测当前目录。"
                : "请从包含 MaaFramework 项目的目录启动 mpelb。interface.json 可以位于该目录的任意子目录。"
            }
          />
          <div>
            <Text type="secondary">当前启动根目录</Text>
            <Paragraph copyable code style={{ marginTop: 4, marginBottom: 0 }}>
              {workspace.root}
            </Paragraph>
          </div>
          {workspace.diagnostics.map((diagnostic) => (
            <Alert
              key={`${diagnostic.code}:${diagnostic.path}`}
              type={diagnostic.severity === "error" ? "error" : "warning"}
              showIcon
              title={diagnostic.message}
              description={diagnostic.path || undefined}
            />
          ))}
        </Space>
      ) : (
        <Spin spinning={submitting}>
          <Paragraph type="secondary">
            当前启动目录内发现了多个 MaaFramework 项目。请选择本次编辑所使用的
            Interface。
          </Paragraph>
          <Radio.Group
            value={selectedPath}
            onChange={(event) => setSelectedPath(event.target.value as string)}
            style={{ width: "100%" }}
            orientation="vertical"
            block
          >
            {workspace.candidates.map((candidate) => (
              <Radio
                key={candidate.interface_path}
                value={candidate.interface_path}
                style={{ padding: "10px 0", alignItems: "flex-start" }}
              >
                <Space orientation="vertical" size={0}>
                  <Text strong>{candidate.label || candidate.name}</Text>
                  <Text type="secondary">
                    {candidate.interface_path}
                    {candidate.version ? ` · ${candidate.version}` : ""}
                  </Text>
                </Space>
              </Radio>
            ))}
          </Radio.Group>
        </Spin>
      )}
    </Modal>
  );
}

function invalidReason(reason: string): string {
  if (reason === "root_missing") return "启动根目录不存在";
  if (reason === "interface_invalid") return "找到的 Interface 均无效";
  return "启动根目录内没有有效的 interface.json 或 interface.jsonc";
}
