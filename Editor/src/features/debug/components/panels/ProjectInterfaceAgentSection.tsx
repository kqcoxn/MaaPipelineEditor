import { Alert, Button, Input, Space, Switch, Tag, Typography } from "antd";
import { ReloadOutlined, StopOutlined } from "@ant-design/icons";
import { List } from "../../../../components/SimpleList";
import type { DebugModalController } from "../../hooks/useDebugModalController";
import type {
  DebugAgentTestResult,
  DebugProtocolError,
} from "../../types";
import { buildAgentFailureGuidance } from "../../utils/agentFailureGuidance";
import styles from "./SetupPanel.module.less";

const { Text } = Typography;

export function ProjectInterfaceAgentSection({
  controller,
}: {
  controller: DebugModalController;
}) {
  const pi = controller.projectInterface;
  const agents = pi.context?.agents ?? [];
  return (
    <List
      bordered
      className={styles.piAgentList}
      dataSource={agents}
      locale={{
        emptyText: pi.context
          ? "Project Interface 未声明 Agent"
          : "正在解析 Project Interface Agent",
      }}
      renderItem={(agent) => {
        const status = pi.agentStatuses[agent.id];
        const override = pi.agentOverrides[agent.id];
        const overrideArgs = override?.childArgs?.join(" ") ?? "";
        const testing = controller.testingAgentIds.has(agent.id);
        const testResult = controller.agentTestResults[agent.id];
        const runError = getAgentRunError(controller.lastError, agent.id, agents.length);
        const failure = agentFailure(testResult, runError, status?.state, status?.message);
        const effectiveExec = override?.childExec || agent.childExec;
        const effectiveArgs = override ? override.childArgs ?? [] : agent.childArgs ?? [];
        const command = formatAgentCommand(effectiveExec, effectiveArgs);
        return (
          <List.Item
            className={styles.piAgentItem}
            style={{
              display: "block",
              padding: "14px 16px 16px",
            }}
          >
            <div className={styles.piAgentContent}>
              <div className={styles.piAgentHeader}>
                <Space size={8} wrap>
                  <Text strong>{agent.id}</Text>
                  <Tag color={agent.enabled ? (failure ? "error" : "green") : undefined}>
                    {agent.enabled ? status?.state ?? "未启动" : "已关闭"}
                  </Tag>
                  {status?.pid && <Tag variant="filled">PID {status.pid}</Tag>}
                  {status?.exitCode !== undefined && <Tag variant="filled">退出码 {status.exitCode}</Tag>}
                  {testResult?.success && !failure && <Tag color="success">测试通过</Tag>}
                </Space>
                <Space size={8}>
                  <Switch
                    size="small"
                    checked={agent.enabled}
                    checkedChildren="启用"
                    unCheckedChildren="关闭"
                    onChange={(enabled) => {
                      if (!enabled && testing) controller.stopProjectInterfaceAgent(agent.index);
                      pi.setAgentEnabled(agent.id, enabled);
                    }}
                  />
                  <Button
                    size="small"
                    icon={testing ? <StopOutlined /> : <ReloadOutlined />}
                    danger={testing}
                    disabled={!agent.enabled}
                    onClick={() => testing ? controller.stopProjectInterfaceAgent(agent.index) : controller.testProjectInterfaceAgent(agent.index)}
                  >
                    {testing ? "停止测试" : "测试并唤起"}
                  </Button>
                </Space>
              </div>
              <Text code className={styles.piAgentCommand}>{command}</Text>
              <div className={styles.piAgentMeta}>
                <Text type="secondary" className={styles.piAgentCommand}>工作目录：{pi.context?.interfaceRoot ?? "-"}</Text>
              </div>
              {failure && <AgentFailureAlert message={failure.message} failureStage={failure.failureStage} command={command} workingDirectory={pi.context?.interfaceRoot} />}
              <div className={styles.piAgentOverride}>
                <label>
                  <Text type="secondary">启动程序覆盖</Text>
                  <Input size="small" placeholder="留空使用 interface.json 中的 child_exec" value={override?.childExec ?? ""} onChange={(event) => pi.setAgentOverride(agent.id, { childExec: event.target.value, childArgs: override?.childArgs })} allowClear />
                </label>
                <label>
                  <Text type="secondary">启动参数覆盖</Text>
                  <Input size="small" placeholder="覆盖完整参数列表；留空表示不传参数" value={overrideArgs} onChange={(event) => pi.setAgentOverride(agent.id, { childExec: override?.childExec || agent.childExec, childArgs: splitAgentArgs(event.target.value) })} allowClear />
                </label>
              </div>
              {status?.output && status.output.length > 0 && (
                <div className={styles.piAgentOutputBlock}>
                  {status.output.slice(-6).map((line, index) => <Text key={`${agent.id}-${index}`} type="secondary" className={styles.piAgentOutput}>{line}</Text>)}
                </div>
              )}
            </div>
          </List.Item>
        );
      }}
    />
  );
}

function AgentFailureAlert({
  message,
  failureStage,
  command,
  workingDirectory,
}: {
  message: string;
  failureStage?: string;
  command: string;
  workingDirectory?: string;
}) {
  const guidance = buildAgentFailureGuidance(message, failureStage);
  return (
    <Alert
      type="error"
      showIcon
      title={guidance.title}
      description={
        <div className={styles.piAgentFailure}>
          <div className={styles.piAgentFailureMessage}>{message}</div>
          <div className={styles.piAgentFailureFacts}>
            <div className={styles.piAgentFailureFact}>
              <Text type="secondary" className={styles.piAgentFailureLabel}>启动指令</Text>
              <Text code className={styles.piAgentFailureValue}>{command}</Text>
            </div>
            <div className={styles.piAgentFailureFact}>
              <Text type="secondary" className={styles.piAgentFailureLabel}>工作目录</Text>
              <Text className={styles.piAgentFailureValue}>{workingDirectory ?? "-"}</Text>
            </div>
          </div>
          <div className={styles.piAgentFailureChecks}>
            <Text type="secondary" className={styles.piAgentFailureLabel}>排查建议</Text>
            <ul>
              {guidance.checks.map((check) => <li key={check}>{check}</li>)}
            </ul>
          </div>
        </div>
      }
    />
  );
}

function formatAgentCommand(executable: string, args: string[]): string {
  return [executable, ...args]
    .filter((part) => part.trim() !== "")
    .map((part) => /[\s"]/.test(part) ? `"${part.replaceAll('"', '\\"')}"` : part)
    .join(" ");
}

function agentFailure(
  testResult: DebugAgentTestResult | undefined,
  runError: { message: string; failureStage?: string } | undefined,
  statusState: string | undefined,
  statusMessage: string | undefined,
) {
  if (testResult && !testResult.success) return testResult;
  if (runError) return runError;
  if ((statusState === "failed" || statusState === "exited") && statusMessage) {
    return { message: statusMessage, failureStage: statusState === "exited" ? "exit" : "start" };
  }
  return undefined;
}

function getAgentRunError(
  error: DebugProtocolError | undefined,
  agentId: string,
  agentCount: number,
): { message: string; failureStage?: string } | undefined {
  if (!error) return undefined;
  const detail = asRecord(error.detail);
  const detailAgentId = typeof detail.agentId === "string" ? detail.agentId : undefined;
  const agentIds = Array.isArray(detail.agentIds)
    ? detail.agentIds.filter((value): value is string => typeof value === "string")
    : [];
  if (!error.code.includes("agent") && !detailAgentId && agentIds.length === 0) {
    return undefined;
  }
  if (detailAgentId ? detailAgentId !== agentId : agentIds.length ? !agentIds.includes(agentId) : agentCount !== 1) {
    return undefined;
  }
  return {
    message: error.message,
    failureStage: typeof detail.failureStage === "string" ? detail.failureStage : undefined,
  };
}

function splitAgentArgs(value: string): string[] {
  return value.match(/"[^"]*"|'[^']*'|\S+/g)?.map((item) => {
    if ((item.startsWith('"') && item.endsWith('"')) || (item.startsWith("'") && item.endsWith("'"))) {
      return item.slice(1, -1);
    }
    return item;
  }) ?? [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
