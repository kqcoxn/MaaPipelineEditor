import { Alert, Button, Space, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import type { DebugModalController } from "../hooks/useDebugModalController";
import { groupSetupDiagnostics, selectSetupChecks } from "../selectors/setupChecks";
import { ResourceDiagnosticList } from "./ResourceDiagnosticList";

export function DebugSetupChecks({ controller, compact = false, onConfigure }: {
  controller: DebugModalController;
  compact?: boolean;
  onConfigure?: (section: "resources" | "controller") => void;
}) {
  const { diagnostics, counts, checking, ready } = selectSetupChecks(controller);
  const groups = groupSetupDiagnostics(diagnostics);
  const recheck = () => {
    controller.requestResourcePreflight();
    if (controller.resourceHealthRequest) controller.requestResourceHealth();
  };
  const title = checking ? "正在检查调试准备状态"
    : counts.error > 0 ? "调试检查发现问题"
    : ready ? "调试准备就绪" : "调试准备待检查";
  return (
    <Space orientation="vertical" size={10} style={{ width: "100%" }}>
      <Alert
        showIcon
        type={checking ? "info" : counts.error > 0 ? "error" : counts.warning > 0 ? "warning" : ready ? "success" : "info"}
        title={title}
        description={checking
          ? "正在检查资源路径、资源加载、流程图和节点映射。"
          : `发现 ${counts.error} 个错误、${counts.warning} 个警告。${ready ? "可以启动调试。" : "请处理提示中的问题并完成调试配置。"}警告不会阻止调试。`}
      />
      {compact ? (
        <Button onClick={() => controller.handlePanelClick("setup")}>查看调试配置与检查结果</Button>
      ) : (
        <>
          <Button
            icon={<ReloadOutlined />}
            loading={checking}
            disabled={!controller.connected}
            onClick={recheck}
          >重新检查</Button>
          {groups.map((group) => (
            <details key={group.key} open style={{ overflowWrap: "anywhere" }}>
              <summary style={{ cursor: "pointer", paddingBlock: 8 }}>
                <Typography.Text strong>{group.title}</Typography.Text>
                <Typography.Text type="secondary"> · {group.diagnostics.length} 项</Typography.Text>
              </summary>
              {!group.key.startsWith("file:") && onConfigure &&
                ["控制器与设备", "资源路径", "资源静态检查与加载"].includes(group.title) && (
                <Button size="small" onClick={() => onConfigure(group.title === "控制器与设备" ? "controller" : "resources")}>
                  {group.title === "控制器与设备" ? "配置控制器" : "配置资源路径"}
                </Button>
              )}
              <ResourceDiagnosticList
                diagnostics={group.diagnostics}
                focusFile={controller.focusFile}
                focusNode={controller.focusNode}
              />
            </details>
          ))}
        </>
      )}
    </Space>
  );
}
