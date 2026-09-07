import { memo } from "react";
import { Typography, Select, Alert } from "antd";

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
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
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
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
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
        </div>
      </div>
      <Text
        type="secondary"
        style={{ fontSize: 11, display: "block", marginBottom: 12 }}
      >
        ScreenCaptureKit 需 macOS 14.0+；GlobalEvent 自动激活窗口，PostToPid
        支持后台
      </Text>
      <Alert
        title="权限要求"
        description={
          <div style={{ fontSize: 12 }}>
            需授予 LocalBridge <Text strong>录屏</Text>与
            <Text strong>辅助功能</Text>
            权限，窗口 ID 来自 MaaToolkit 桌面窗口列表。如遇权限问题，可执行{" "}
            <Text code style={{ fontSize: 11 }}>
              tccutil reset ScreenCapture
            </Text>{" "}
            <Text code style={{ fontSize: 11 }}>
              tccutil reset Accessibility
            </Text>
            重置。
          </div>
        }
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
      />
    </div>
  ),
);
