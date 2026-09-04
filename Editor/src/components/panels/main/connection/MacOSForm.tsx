import { memo } from "react";
import { Typography, Card, Select, Alert } from "antd";
import { AppleOutlined } from "@ant-design/icons";

const { Text } = Typography;

interface MacOSFormProps {
  screencapMethod: string;
  inputMethod: string;
  screencapMethods: string[];
  inputMethods: string[];
  onScreencapMethodChange: (value: string) => void;
  onInputMethodChange: (value: string) => void;
}

export const MacOSForm = memo(
  ({
    screencapMethod,
    inputMethod,
    screencapMethods,
    inputMethods,
    onScreencapMethodChange,
    onInputMethodChange,
  }: MacOSFormProps) => (
    <div style={{ padding: "16px 24px" }}>
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
            <Text strong>macOS 原生应用</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              控制 macOS 原生应用程序
            </Text>
          </div>
        </div>
      </Card>

      <div style={{ marginBottom: 16 }}>
        <Text
          type="secondary"
          style={{ fontSize: 12, marginBottom: 6, display: "block" }}
        >
          截图方法 <span style={{ color: "#ff4d4f" }}>*</span>
        </Text>
        <Select
          value={screencapMethod}
          onChange={onScreencapMethodChange}
          style={{ width: "100%" }}
          options={screencapMethods.map((m) => ({
            label: m,
            value: m,
          }))}
          placeholder="选择截图方法"
        />
        <Text
          type="secondary"
          style={{ fontSize: 11, marginTop: 4, display: "block" }}
        >
          ScreenCaptureKit: 需要 macOS 14.0+ 和录屏权限
        </Text>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Text
          type="secondary"
          style={{ fontSize: 12, marginBottom: 6, display: "block" }}
        >
          输入方法 <span style={{ color: "#ff4d4f" }}>*</span>
        </Text>
        <Select
          value={inputMethod}
          onChange={onInputMethodChange}
          style={{ width: "100%" }}
          options={inputMethods.map((m) => ({
            label: m,
            value: m,
          }))}
          placeholder="选择输入方法"
        />
        <Text
          type="secondary"
          style={{ fontSize: 11, marginTop: 4, display: "block" }}
        >
          GlobalEvent: 全局事件注入(自动激活窗口) | PostToPid:
          直接发送到进程(支持后台)
        </Text>
      </div>

      <Alert
        title="权限要求"
        description={
          <div>
            <div style={{ marginBottom: 8 }}>需要授予以下权限:</div>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li>
                <Text strong>录屏权限 (Screen Recording)</Text>: 用于截图功能
              </li>
              <li>
                <Text strong>辅助功能权限 (Accessibility)</Text>:
                用于输入控制功能
              </li>
            </ul>
            <div style={{ marginTop: 8 }}>
              如遇权限问题,可执行以下命令重置:
              <br />
              <Text code style={{ fontSize: 11 }}>
                tccutil reset ScreenCapture
              </Text>
              <br />
              <Text code style={{ fontSize: 11 }}>
                tccutil reset Accessibility
              </Text>
            </div>
          </div>
        }
        type="warning"
        showIcon
        style={{ marginTop: 16 }}
      />
    </div>
  ),
);
