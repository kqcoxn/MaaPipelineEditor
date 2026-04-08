import { memo } from "react";
import { List, Typography, Input, Alert } from "antd";
import { DesktopOutlined, CheckCircleOutlined } from "@ant-design/icons";
import type { WlRootsCompositor } from "../../../../stores/mfwStore";

const { Text } = Typography;

interface WlRootsFormProps {
  sockets: WlRootsCompositor[];
  selectedSocket: WlRootsCompositor | null;
  onSelect: (socket: WlRootsCompositor) => void;
  manualPath: string;
  onManualPathChange: (value: string) => void;
  loading: boolean;
}

export const WlRootsForm = memo(
  ({
    sockets,
    selectedSocket,
    onSelect,
    manualPath,
    onManualPathChange,
    loading,
  }: WlRootsFormProps) => {
    const handleSelectPreset = (socket: WlRootsCompositor) => {
      onSelect(socket);
      onManualPathChange(""); // 清空手动输入
    };

    const handleManualChange = (value: string) => {
      onManualPathChange(value);
      if (selectedSocket) {
        onSelect(null as any); // 清空选择
      }
    };

    const hasListSelection = !!selectedSocket;
    const hasManualInput = manualPath.trim().length > 0;

    return (
      <div style={{ padding: "16px 24px" }}>
        {/* 预设列表 */}
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
            可用 Socket 路径
          </Text>
          <List
            loading={loading}
            dataSource={sockets}
            locale={{ emptyText: "暂无可用路径，请手动输入或点击刷新" }}
            split={false}
            renderItem={(socket) => {
              const isSelected =
                selectedSocket?.socket_path === socket.socket_path;
              return (
                <div
                  onClick={() => handleSelectPreset(socket)}
                  style={{
                    cursor: "pointer",
                    padding: "12px 16px",
                    marginBottom: 8,
                    borderRadius: 8,
                    border: isSelected
                      ? "2px solid #1890ff"
                      : "1px solid #f0f0f0",
                    backgroundColor: isSelected ? "#e6f7ff" : "#fafafa",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected)
                      e.currentTarget.style.backgroundColor = "#f5f5f5";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected)
                      e.currentTarget.style.backgroundColor = "#fafafa";
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <DesktopOutlined
                      style={{
                        fontSize: 24,
                        color: isSelected ? "#1890ff" : "#999",
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        strong
                        ellipsis
                        style={{ display: "block", marginBottom: 4 }}
                      >
                        {socket.socket_path}
                      </Text>
                    </div>
                    {isSelected && (
                      <CheckCircleOutlined
                        style={{ color: "#1890ff", fontSize: 18 }}
                      />
                    )}
                  </div>
                </div>
              );
            }}
          />
        </div>

        {/* 分隔线 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            margin: "16px 0",
          }}
        >
          <div style={{ flex: 1, height: 1, backgroundColor: "#f0f0f0" }} />
          <Text type="secondary" style={{ padding: "0 12px" }}>
            或手动输入
          </Text>
          <div style={{ flex: 1, height: 1, backgroundColor: "#f0f0f0" }} />
        </div>

        {/* 手动输入 */}
        <div style={{ marginBottom: 16 }}>
          <Input
            placeholder="例如: /run/user/1000/wayland-0"
            value={manualPath}
            onChange={(e) => handleManualChange(e.target.value)}
            prefix={<DesktopOutlined style={{ color: "#999" }} />}
            allowClear
            status={hasManualInput && hasListSelection ? "warning" : undefined}
          />
          {hasManualInput && hasListSelection && (
            <Text
              type="warning"
              style={{
                display: "block",
                marginTop: 4,
                fontSize: 12,
              }}
            >
              将使用手动输入的路径，列表选择将被忽略
            </Text>
          )}
        </div>

        {/* 提示信息 */}
        <Alert
          message="提示"
          description={
            <div>
              <div>
                选择上方列表中的 socket 路径，或手动输入自定义路径。通常为{" "}
                <Text code>/run/user/$UID/wayland-0</Text>
              </div>
              <div style={{ marginTop: 4 }}>
                建议使用嵌套合成器会话，避免控制当前桌面。
              </div>
            </div>
          }
          type="info"
          showIcon
          style={{ marginTop: 16 }}
        />
      </div>
    );
  },
);
