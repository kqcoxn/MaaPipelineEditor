import { Button, Space, Typography } from "antd";
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
    : ready ? "调试检查通过" : "调试准备待检查";
  return (
    <Space orientation="vertical" size={10} style={{ width: "100%" }}>
      <div role="status" aria-live="polite">
        <Space wrap size={8}>
          <Typography.Text strong>{title}</Typography.Text>
          {!checking && <Typography.Text type={counts.error > 0 ? "danger" : "secondary"}>
            {counts.error} 个错误 · {counts.warning} 个警告
          </Typography.Text>}
        </Space>
        {!checking && (counts.error > 0 || counts.warning > 0) && (
          <div><Typography.Text type="secondary">
            {counts.error > 0 ? "需处理错误后才能调试。" : "警告不会阻止调试。"}
          </Typography.Text></div>
        )}
      </div>
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
            <details key={group.key} open={group.diagnostics.some((item) => item.severity === "error")} style={{ overflowWrap: "anywhere" }}>
              <summary title={group.title} style={{ cursor: "pointer", paddingBlock: 8 }}>
                <Typography.Text strong>{group.key.startsWith("file:") ? group.title.replaceAll("\\", "/").split("/").pop() : group.title}</Typography.Text>
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
