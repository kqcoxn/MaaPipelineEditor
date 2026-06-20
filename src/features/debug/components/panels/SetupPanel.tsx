import { List } from "../../../../components/SimpleList";
import { Typography, Button, Input, Space, Tag, Modal, Alert, Select, Checkbox, Switch, Collapse, InputNumber, Result } from "antd";
import {
  DeleteOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { DebugSection } from "../DebugSection";
import type { DebugModalController } from "../../hooks/useDebugModalController";
import type { DebugAgentProfile, DebugArtifactPolicy } from "../../types";
import {
  DEFAULT_DEBUG_AGENT_TIMEOUT_MS,
  getDebugAgentProfileKey,
} from "../../agentProfile";
import { getDebugStatusLabel } from "../../capabilityLabels";
import { stringArray } from "../../modalUtils";

const { Text } = Typography;

export function SetupPanel({
  controller,
}: {
  controller: DebugModalController;
}) {
  return (
    <Space orientation="vertical" size={14} style={{ width: "100%" }}>
      <DebugSection title="关于 MPE FlowScope (调试模块)">
        <Space orientation="vertical" size={8} style={{ width: "100%" }}>
          <Text>
            本调试模块定位为临时调试，适合在编辑流程时快速验证节点行为。
          </Text>
          <Text>
            使用 MPE FlowScope
            调试时，识别、执行的耗时会因特殊设计有明显延长，此问题不影响节点效果。
          </Text>
          <Text>如需进行正式、系统化的调试，推荐使用以下工具：</Text>

          <Space wrap>
            <Button
              type="link"
              icon={<InfoCircleOutlined />}
              href="https://github.com/MaaXYZ/MaaDebugger"
              target="_blank"
              rel="noopener noreferrer"
              style={{ padding: 0 }}
            >
              MaaDebugger
            </Button>
            <Button
              type="link"
              icon={<InfoCircleOutlined />}
              href="https://github.com/neko-para/maa-support-extension"
              target="_blank"
              rel="noopener noreferrer"
              style={{ padding: 0 }}
            >
              maa-support-extension
            </Button>
          </Space>
        </Space>
      </DebugSection>
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
            label: "控制器（Controller）",
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

function agentResultKey(agent: DebugAgentProfile, index: number): string {
  return getDebugAgentProfileKey(agent) ?? `agent-${index + 1}`;
}

function ProfileSection({
  controller,
}: {
  controller: DebugModalController;
}) {
  const {
    profileState,
    invalidateResourcePreflight,
    autoGenerateAiSummary,
    setAutoGenerateAiSummary,
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
    <Space orientation="vertical" size={14} style={{ width: "100%" }}>
      <DebugSection title="基础配置">
        <Space orientation="vertical" style={{ width: "100%" }}>
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
          <Space.Compact>
            <Button disabled>名称</Button>
            <Input
              value={profileState.profile.name}
              onChange={(event) =>
                profileState.updateProfile({ name: event.target.value })
              }
            />
          </Space.Compact>
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
      <DebugSection title="AI 总结">
        <Space orientation="vertical" size={8} style={{ width: "100%" }}>
          <Space wrap>
            <Switch
              checked={autoGenerateAiSummary}
              onChange={setAutoGenerateAiSummary}
            />
            <Text>运行结束后自动生成 AI 总结</Text>
          </Space>
          <Text type="secondary">
            关闭时只会在中控台或 AI 总结面板手动生成；开启后不会阻塞调试运行完成。
          </Text>
        </Space>
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
    <Space orientation="vertical" size={14} style={{ width: "100%" }}>
      <Alert
        type={
          resourcePreflightStatus === "ready"
            ? "success"
            : resourcePreflightStatus === "error"
              ? "error"
              : "info"
        }
        showIcon
        title={
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
    controllerDisplayName,
  } = controller;

  return (
    <Space orientation="vertical" size={14} style={{ width: "100%" }}>
      <DebugSection title="当前控制器（Controller）">
        <Space wrap>
          <Tag color={mfwState.connectionStatus === "connected" ? "green" : "red"}>
            {mfwState.connectionStatus}
          </Tag>
          <Tag>{mfwState.controllerType ?? "无类型"}</Tag>
          <Tag>名称 {controllerDisplayName}</Tag>
          <Tag>{mfwState.controllerId ?? "无控制器 ID"}</Tag>
        </Space>
      </DebugSection>
      <Alert
        type="info"
        showIcon
        title="控制器能力"
        description="启动请求会自动使用已连接控制器（Controller）"
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
    diagnosticsState,
    agentTestResults,
    testingAgentIds,
    testAgent,
  } = controller;
  const agents = profileState.profile.agents ?? [];
  const agentDiagnostics = diagnosticsState.diagnostics.filter(
    (d) => typeof d.code === "string" && d.code.startsWith("debug.agent."),
  );
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
        timeoutMs: DEFAULT_DEBUG_AGENT_TIMEOUT_MS,
        required: true,
      },
    ]);
  };

  return (
    <Space orientation="vertical" size={14} style={{ width: "100%" }}>
      <Button icon={<PlusOutlined />} onClick={addAgent}>
        添加代理（Agent）
      </Button>
      <List
        bordered
        dataSource={agents}
        locale={{ emptyText: "未配置代理（Agent）" }}
        renderItem={(agent, index) => {
          const resultKey = agentResultKey(agent, index);
          const testResult = agentTestResults[resultKey];

          return (
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
              <Space orientation="vertical" style={{ width: "100%" }}>
                <Space wrap>
                  <Switch
                    checked={agent.enabled}
                    onChange={(enabled) => updateAgent(index, { enabled })}
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
                    loading={testingAgentIds.has(resultKey)}
                    onClick={() => testAgent(agent)}
                  >
                    测试连接
                  </Button>
                </Space>
                {testResult && (
                  <Alert
                    type={testResult.success ? "success" : "error"}
                    showIcon
                    title={testResult.message}
                    description={
                      testResult.success ? (
                        <Text type="secondary">
                          测试连接已断开；正式运行时会按当前配置重新连接。
                        </Text>
                      ) : (
                        <Text type="secondary">
                          常见的原因包括：未启动项目 Agent、项目 Agent 版本（一般为
                          python/go 的 maafw 库版本）与 MPE 的依赖版本（可自行替换，即填写的
                          Lib 目录）不一致、连接前未成功加载资源等。
                        </Text>
                      )
                    }
                  />
                )}
              </Space>
            </List.Item>
          );
        }}
      />
      <DebugSection title="最近代理（Agent）诊断">
        <List
          size="small"
          dataSource={agentDiagnostics}
          locale={{ emptyText: "暂无代理（Agent）诊断" }}
          renderItem={(diagnostic) => (
            <List.Item>
              <Space orientation="vertical" style={{ width: "100%" }}>
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
        <Space orientation="vertical" style={{ width: "100%" }}>
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
