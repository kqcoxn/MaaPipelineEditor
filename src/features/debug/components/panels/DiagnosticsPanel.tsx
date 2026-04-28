import { Empty, List, Space, Tag, Typography } from "antd";
import type { DebugModalController } from "../../hooks/useDebugModalController";

const { Text } = Typography;

export function DiagnosticsPanel({
  controller,
}: {
  controller: DebugModalController;
}) {
  const diagnostics = controller.diagnosticsState.diagnostics;

  return diagnostics.length === 0 ? (
    <Empty description="暂无诊断" />
  ) : (
    <List
      bordered
      dataSource={diagnostics}
      renderItem={(diagnostic) => (
        <List.Item>
          <List.Item.Meta
            title={
              <Space>
                <Tag
                  color={
                    diagnostic.severity === "error"
                      ? "red"
                      : diagnostic.severity === "warning"
                        ? "gold"
                        : "blue"
                  }
                >
                  {diagnostic.severity}
                </Tag>
                <Text>{diagnostic.code}</Text>
              </Space>
            }
            description={diagnostic.message}
          />
        </List.Item>
      )}
    />
  );
}
