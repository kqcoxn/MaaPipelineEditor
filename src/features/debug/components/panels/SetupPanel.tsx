import {
  Alert,
  Button,
  Checkbox,
  Collapse,
  Input,
  InputNumber,
  List,
  Modal,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
} from "antd";
import {
  CaretRightOutlined,
  DeleteOutlined,
  PictureOutlined,
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { DebugSection } from "../DebugSection";
import type { DebugModalController } from "../../hooks/useDebugModalController";
import type { DebugAgentProfile, DebugArtifactPolicy } from "../../types";
import { getDebugStatusLabel } from "../../capabilityLabels";
import { stringArray } from "../../modalUtils";

const { Text } = Typography;

export function SetupPanel({
  controller,
}: {
  controller: DebugModalController;
}) {
  return (
    <Space direction="vertical" size={14} style={{ width: "100%" }}>
      <Collapse
        defaultActiveKey={["profile", "resources"]}
        items={[
          {
            key: "profile",
            label: "调试配置",
            children: <ProfileSection controller={controller} />,
          },
          {
            key: "resources",
            label: "资源路径（Resource）",
            children: <ResourceSection controller={controller} />,
          },
          {
            key: "controller",
            label: "控制器与截图（Controller / Screenshot）",
            children: <ControllerSection controller={controller} />,
          },
          {
            key: "agent",
            label: "代理（Agent）",
            children: <AgentSection controller={controller} />,
          },
        ]}
      />
    </Space>
  );
}

function ProfileSection({
  controller,
}: {
  controller: DebugModalController;
}) {
  const {
    profileState,
    invalidateResourcePreflight,
  } = controller;

  const handleCreateProfile = () => {
    profileState.createProfile();
    invalidateResourcePreflight();
  };
  const handleDeleteProfile = () => {
    Modal.confirm({
      title: "删除调试配置",
      content: `确定删除“${profileState.profile.name}”吗？`,
      okText: "删除",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: () => {
        profileState.deleteProfile(profileState.activeProfileId);
        invalidateResourcePreflight();
      },
    });
  };

  return (
    <Space direction="vertical" size={14} style={{ width: "100%" }}>
      <DebugSection title="基础配置">
        <Space direction="vertical" style={{ width: "100%" }}>
          <Space.Compact style={{ width: "100%" }}>
            <Select
              value={profileState.activeProfileId}
              style={{ flex: 1 }}
              onChange={(profileId) => {
                profileState.setActiveProfile(profileId);
                invalidateResourcePreflight();
              }}
              options={profileState.profiles.map((profile) => ({
                value: profile.id,
                label: profile.profile.name,
              }))}
            />
            <Button icon={<PlusOutlined />} onClick={handleCreateProfile}>
              新建配置
            </Button>
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={handleDeleteProfile}
              disabled={profileState.profiles.length <= 1}
            >
              删除配置
            </Button>
          </Space.Compact>
          <Input
            value={profileState.profile.name}
            onChange={(event) =>
              profileState.updateProfile({ name: event.target.value })
            }
            addonBefore="名称"
          />
          <Select
            value={profileState.profile.savePolicy}
            style={{ width: 240 }}
            onChange={(savePolicy) => profileState.updateProfile({ savePolicy })}
            options={[
              { value: "sandbox", label: "沙盒快照（Sandbox）" },
              { value: "save-open-files", label: "保存打开文件" },
              { value: "use-disk", label: "使用磁盘文件" },
            ]}
          />
        </Space>
      </DebugSection>
      <DebugSection title="产物策略（Artifact Policy）">
        <Checkbox.Group
          value={Object.entries(profileState.artifactPolicy)
            .filter(([, enabled]) => enabled)
            .map(([key]) => key)}
          onChange={(values) => {
            const selected = new Set(values);
            profileState.setArtifactPolicy({
              includeRawImage: selected.has("includeRawImage"),
              includeDrawImage: selected.has("includeDrawImage"),
              includeActionDetail: selected.has("includeActionDetail"),
            } satisfies DebugArtifactPolicy);
          }}
          options={[
            { value: "includeRawImage", label: "原始图（Raw Image）" },
            { value: "includeDrawImage", label: "绘制图（Draw Image）" },
            { value: "includeActionDetail", label: "动作详情（Action Detail）" },
          ]}
        />
      </DebugSection>
    </Space>
  );
}

function ResourceSection({
  controller,
}: {
  controller: DebugModalController;
}) {
  const {
    connected,
    resourcePreflightStatus,
    resourcePreflight,
    resolvedResourcePaths,
    requestResourcePreflight,
    profileState,
    updateResourcePaths,
    resourceBundles,
  } = controller;

  return (
    <Space direction="vertical" size={14} style={{ width: "100%" }}>
      <Alert
        type={
          resourcePreflightStatus === "ready"
            ? "success"
            : resourcePreflightStatus === "error"
              ? "error"
              : "info"
        }
        showIcon
        message={
          resourcePreflightStatus === "ready"
            ? "资源加载检测通过"
            : resourcePreflightStatus === "checking"
              ? "正在检测资源加载"
              : resourcePreflightStatus === "error"
                ? "资源加载检测失败"
                : "资源路径"
        }
        description={
          resourcePreflightStatus === "ready"
            ? `已由后端完成一次真实资源加载检测${
                resourcePreflight.result?.hash
                  ? `，hash：${resourcePreflight.result.hash}`
                  : ""
              }。`
            : resourcePreflightStatus === "checking"
              ? "后端正在使用 MaaFramework 加载资源，请稍候。"
              : resourcePreflight.error ??
                "留空时会使用 LocalBridge 当前扫描到的资源包绝对路径；打开调试模块或修改资源路径后会检测一次。"
        }
      />
      <Space wrap>
        <Button
          icon={<ReloadOutlined />}
          onClick={requestResourcePreflight}
          loading={resourcePreflightStatus === "checking"}
          disabled={!connected || resolvedResourcePaths.length === 0}
        >
          重新检测资源加载
        </Button>
        <Tag>{getDebugStatusLabel(resourcePreflightStatus)}</Tag>
        <Tag>资源路径 {resolvedResourcePaths.length}</Tag>
        {resourcePreflight.result?.durationMs !== undefined && (
          <Tag>耗时 {resourcePreflight.result.durationMs}ms</Tag>
        )}
      </Space>
      <Select
        mode="tags"
        style={{ width: "100%" }}
        value={profileState.profile.resourcePaths}
        onChange={updateResourcePaths}
        placeholder="选择或输入资源（Resource）路径"
        options={resourceBundles.map((bundle) => ({
          value: bundle.abs_path,
          label: `${bundle.name} · ${bundle.abs_path}`,
        }))}
      />
      <List
        size="small"
        bordered
        dataSource={resourceBundles}
        locale={{ emptyText: "尚未加载资源包（Resource Bundle）" }}
        renderItem={(bundle) => (
          <List.Item>
            <Space wrap>
              <Text strong>{bundle.name}</Text>
              <Tag color={bundle.has_pipeline ? "green" : "default"}>
                pipeline
              </Tag>
              <Tag color={bundle.has_image ? "green" : "default"}>图片</Tag>
              <Text type="secondary">{bundle.abs_path}</Text>
            </Space>
          </List.Item>
        )}
      />
    </Space>
  );
}

function ControllerSection({
  controller,
}: {
  controller: DebugModalController;
}) {
  const {
    mfwState,
    captureScreenshot,
    startScreenshotStream,
    stopScreenshotStream,
    screenshotStream,
    profileState,
    controllerDisplayName,
  } = controller;

  return (
    <Space direction="vertical" size={14} style={{ width: "100%" }}>
      <DebugSection title="当前控制器（Controller）">
        <Space wrap>
          <Tag color={mfwState.connectionStatus === "connected" ? "green" : "red"}>
            {mfwState.connectionStatus}
          </Tag>
          <Tag>{mfwState.controllerType ?? "无类型"}</Tag>
          <Tag>名称 {controllerDisplayName}</Tag>
          <Tag>{mfwState.controllerId ?? "无控制器 ID"}</Tag>
          <Button
            size="small"
            icon={<PictureOutlined />}
            onClick={captureScreenshot}
            disabled={!mfwState.controllerId}
          >
            截图
          </Button>
          <Button
            size="small"
            icon={<CaretRightOutlined />}
            onClick={startScreenshotStream}
            disabled={!mfwState.controllerId || screenshotStream?.active}
          >
            开始推流
          </Button>
          <Button
            size="small"
            danger
            icon={<StopOutlined />}
            onClick={stopScreenshotStream}
            disabled={!screenshotStream?.active}
          >
            停止推流
          </Button>
        </Space>
      </DebugSection>
      <DebugSection title="实时截图（Live Screenshot）">
        <Space wrap>
          <InputNumber
            min={250}
            step={250}
            value={profileState.screenshotStreamConfig.intervalMs}
            addonBefore="间隔 ms"
            onChange={(intervalMs) =>
              profileState.setScreenshotStreamConfig({
                ...profileState.screenshotStreamConfig,
                intervalMs: Math.max(250, intervalMs ?? 1000),
              })
            }
          />
          <Checkbox
            checked={profileState.screenshotStreamConfig.force}
            onChange={(event) =>
              profileState.setScreenshotStreamConfig({
                ...profileState.screenshotStreamConfig,
                force: event.target.checked,
              })
            }
          >
            强制截图
          </Checkbox>
          <Tag color={screenshotStream?.active ? "green" : "default"}>
            {screenshotStream?.active ? "推流中" : "已停止"}
          </Tag>
          <Tag>帧数 {screenshotStream?.frameCount ?? 0}</Tag>
        </Space>
      </DebugSection>
      <Alert
        type="info"
        showIcon
        message="控制器能力"
        description="启动请求会自动使用已连接控制器（Controller）；回放（Replay）/录制（Record）因当前 maa-framework-go 未暴露 MaaDbgController，按能力清单标记为不可用。"
      />
    </Space>
  );
}

function AgentSection({
  controller,
}: {
  controller: DebugModalController;
}) {
  const {
    profileState,
    agentDiagnostics,
    agentTestResults,
    testingAgentIds,
    testAgent,
  } = controller;
  const agents = profileState.profile.agents;
  const updateAgent = (
    index: number,
    updates: Partial<DebugAgentProfile>,
  ) => {
    profileState.setAgents(
      agents.map((agent, agentIndex) =>
        agentIndex === index ? { ...agent, ...updates } : agent,
      ),
    );
  };
  const addAgent = () => {
    profileState.setAgents([
      ...agents,
      {
        id: `agent-${agents.length + 1}`,
        enabled: false,
        transport: "identifier",
        identifier: "",
        required: true,
      },
    ]);
  };

  return (
    <Space direction="vertical" size={14} style={{ width: "100%" }}>
      <Button icon={<PlusOutlined />} onClick={addAgent}>
        添加代理（Agent）
      </Button>
      <List
        bordered
        dataSource={agents}
        locale={{ emptyText: "未配置代理（Agent）" }}
        renderItem={(agent, index) => (
          <List.Item
            actions={[
              <Button
                key="delete"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() =>
                  profileState.setAgents(
                    agents.filter((_, agentIndex) => agentIndex !== index),
                  )
                }
              />,
            ]}
          >
            <Space direction="vertical" style={{ width: "100%" }}>
              <Space wrap>
                <Switch
                  checked={agent.enabled}
                  onChange={(enabled) => updateAgent(index, { enabled })}
                />
                <Input
                  value={agent.id}
                  onChange={(event) =>
                    updateAgent(index, { id: event.target.value })
                  }
                  addonBefore="标识"
                  style={{ width: 220 }}
                />
                <Select
                  value={agent.transport}
                  style={{ width: 140 }}
                  onChange={(transport) => updateAgent(index, { transport })}
                  options={[
                    { value: "identifier", label: "标识符（Identifier）" },
                    { value: "tcp", label: "TCP" },
                  ]}
                />
                {agent.transport === "tcp" ? (
                  <InputNumber
                    value={agent.tcpPort}
                    min={1}
                    max={65535}
                    placeholder="TCP 端口"
                    onChange={(tcpPort) =>
                      updateAgent(index, { tcpPort: tcpPort ?? undefined })
                    }
                  />
                ) : (
                  <Input
                    value={agent.identifier}
                    onChange={(event) =>
                      updateAgent(index, { identifier: event.target.value })
                    }
                    placeholder="代理标识符（Identifier）"
                    style={{ width: 240 }}
                  />
                )}
                <InputNumber
                  value={agent.timeoutMs}
                  min={0}
                  step={100}
                  placeholder="超时 ms"
                  onChange={(timeoutMs) =>
                    updateAgent(index, { timeoutMs: timeoutMs ?? undefined })
                  }
                />
                <Checkbox
                  checked={agent.required ?? true}
                  onChange={(event) =>
                    updateAgent(index, { required: event.target.checked })
                  }
                >
                  必需
                </Checkbox>
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  loading={testingAgentIds.has(agent.id.trim() || "agent")}
                  onClick={() => testAgent(agent)}
                >
                  测试连接
                </Button>
              </Space>
              {agentTestResults[agent.id] && (
                <Alert
                  type={agentTestResults[agent.id].success ? "success" : "error"}
                  showIcon
                  message={agentTestResults[agent.id].message}
                  description={
                    <Space wrap>
                      <Text type="secondary">
                        测试连接已断开；正式运行时会按当前配置重新连接。
                      </Text>
                      {stringArray(
                        agentTestResults[agent.id].customRecognitions,
                      ).map((name) => (
                        <Tag key={`test-reco-${name}`} color="blue">
                          reco {name}
                        </Tag>
                      ))}
                      {stringArray(agentTestResults[agent.id].customActions).map(
                        (name) => (
                          <Tag key={`test-act-${name}`} color="purple">
                            act {name}
                          </Tag>
                        ),
                      )}
                    </Space>
                  }
                />
              )}
            </Space>
          </List.Item>
        )}
      />
      <DebugSection title="最近代理（Agent）诊断">
        <List
          size="small"
          dataSource={agentDiagnostics}
          locale={{ emptyText: "暂无代理（Agent）诊断" }}
          renderItem={(diagnostic) => (
            <List.Item>
              <Space direction="vertical" style={{ width: "100%" }}>
                <Space>
                  <Tag>{diagnostic.severity}</Tag>
                  <Text>{diagnostic.message}</Text>
                </Space>
                <Space wrap>
                  {stringArray(diagnostic.data?.customRecognitions).map(
                    (name) => (
                      <Tag key={`reco-${name}`} color="blue">
                        reco {name}
                      </Tag>
                    ),
                  )}
                  {stringArray(diagnostic.data?.customActions).map((name) => (
                    <Tag key={`act-${name}`} color="purple">
                      act {name}
                    </Tag>
                  ))}
                </Space>
              </Space>
            </List.Item>
          )}
        />
      </DebugSection>
      <DebugSection title="代理运行配置">
        <Space direction="vertical" style={{ width: "100%" }}>
          <Space wrap>
            <Tag>已配置 {agents.length}</Tag>
            <Tag color="green">
              已启用 {agents.filter((agent) => agent.enabled).length}
            </Tag>
            <Tag color="purple">
              已连接{" "}
              {
                agentDiagnostics.filter(
                  (diagnostic) => diagnostic.code === "debug.agent.connected",
                ).length
              }
            </Tag>
          </Space>
          <Text type="secondary">
            当前代理（Agent）配置会随调试配置本地持久化；测试连接只验证外部已启动代理，测试结束后会立即断开，正式运行时会重新连接。
          </Text>
        </Space>
      </DebugSection>
    </Space>
  );
}
