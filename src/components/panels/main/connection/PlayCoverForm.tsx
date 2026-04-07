import { memo } from "react";
import { Typography, Card } from "antd";
import { AppleOutlined } from "@ant-design/icons";

const { Text } = Typography;

interface PlayCoverFormProps {
  address: string;
  uuid: string;
  name: string;
  onAddressChange: (value: string) => void;
  onUuidChange: (value: string) => void;
  onNameChange: (value: string) => void;
}

export const PlayCoverForm = memo(
  ({
    address,
    uuid,
    name,
    onAddressChange,
    onUuidChange,
    onNameChange,
  }: PlayCoverFormProps) => (
    <div style={{ padding: "8px 0" }}>
      <Card
        size="small"
        style={{
          backgroundColor: "#f5f5f5",
          borderColor: "#d9d9d9",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <AppleOutlined style={{ color: "#1890ff", fontSize: 20 }} />
          <div>
            <Text strong>PlayCover 连接</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              连接 macOS 上运行的 iOS 应用
            </Text>
          </div>
        </div>
      </Card>

      <div style={{ marginBottom: 16 }}>
        <Text
          type="secondary"
          style={{ fontSize: 12, marginBottom: 6, display: "block" }}
        >
          PlayCover 地址 <span style={{ color: "#ff4d4f" }}>*</span>
        </Text>
        <input
          type="text"
          value={address}
          onChange={(e) => onAddressChange(e.target.value)}
          placeholder="例如: 127.0.0.1:1234"
          style={{
            width: "100%",
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #d9d9d9",
            fontSize: 14,
            outline: "none",
          }}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <Text
          type="secondary"
          style={{ fontSize: 12, marginBottom: 6, display: "block" }}
        >
          设备 UUID <span style={{ color: "#ff4d4f" }}>*</span>
        </Text>
        <input
          type="text"
          value={uuid}
          onChange={(e) => onUuidChange(e.target.value)}
          placeholder="例如: 12345678-1234-1234-1234-123456789abc"
          style={{
            width: "100%",
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #d9d9d9",
            fontSize: 14,
            outline: "none",
          }}
        />
      </div>

      <div>
        <Text
          type="secondary"
          style={{ fontSize: 12, marginBottom: 6, display: "block" }}
        >
          设备名称 (可选)
        </Text>
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="自定义设备名称"
          style={{
            width: "100%",
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #d9d9d9",
            fontSize: 14,
            outline: "none",
          }}
        />
      </div>
    </div>
  ),
);
