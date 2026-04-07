import { memo } from "react";
import { Typography, Input, Alert } from "antd";
import { DesktopOutlined } from "@ant-design/icons";

const { Text } = Typography;

interface WlRootsFormProps {
  socketPath: string;
  onSocketPathChange: (value: string) => void;
}

export const WlRootsForm = memo(
  ({ socketPath, onSocketPathChange }: WlRootsFormProps) => (
    <div style={{ padding: "16px 24px" }}>
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
          WlRoots Socket 路径
        </Text>
        <Input
          placeholder="例如: /run/user/1000/wayland-0"
          value={socketPath}
          onChange={(e) => onSocketPathChange(e.target.value)}
          prefix={<DesktopOutlined style={{ color: "#999" }} />}
          allowClear
        />
      </div>
      <Alert
        message="提示"
        description={
          <div>
            <div>
              请输入 wlroots 合成器的 socket 路径,通常为{" "}
              <Text code>/run/user/$UID/wayland-0</Text>
            </div>
            <div style={{ marginTop: 4 }}>
              建议使用嵌套合成器会话,避免控制当前桌面。
            </div>
          </div>
        }
        type="info"
        showIcon
        style={{ marginTop: 16 }}
      />
    </div>
  ),
);
