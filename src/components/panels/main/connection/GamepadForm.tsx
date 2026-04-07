import { memo } from "react";
import { Typography, Select, Alert } from "antd";

const { Text } = Typography;

interface GamepadFormProps {
  gamepadType: "Xbox360" | "DualShock4";
  hwnd: string;
  screencap: string;
  onTypeChange: (value: "Xbox360" | "DualShock4") => void;
  onHwndChange: (value: string) => void;
  onScreencapChange: (value: string) => void;
}

export const GamepadForm = memo(
  ({
    gamepadType,
    hwnd,
    screencap,
    onTypeChange,
    onHwndChange,
    onScreencapChange,
  }: GamepadFormProps) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <Text
          type="secondary"
          style={{ fontSize: 12, marginBottom: 8, display: "block" }}
        >
          手柄类型 *
        </Text>
        <Select
          value={gamepadType}
          onChange={onTypeChange}
          style={{ width: "100%" }}
          options={[
            { label: "Xbox 360 Controller", value: "Xbox360" },
            { label: "DualShock 4 Controller", value: "DualShock4" },
          ]}
        />
      </div>

      <div>
        <Text
          type="secondary"
          style={{ fontSize: 12, marginBottom: 8, display: "block" }}
        >
          窗口句柄 (可选,用于截图)
        </Text>
        <input
          value={hwnd}
          onChange={(e) => onHwndChange(e.target.value)}
          placeholder="例: 0x123456 (可以为空)"
          style={{
            width: "93%",
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
          style={{ fontSize: 12, marginBottom: 8, display: "block" }}
        >
          截图方法 (可选)
        </Text>
        <Select
          placeholder="自动选择"
          allowClear
          value={screencap || undefined}
          onChange={(value) => onScreencapChange(value || "")}
          style={{ width: "100%" }}
          options={[
            { label: "FramePool", value: "FramePool" },
            {
              label: "FramePool (伪最小化)",
              value: "FramePoolWithPseudoMinimize",
            },
            { label: "GDI", value: "GDI" },
            { label: "DXGI_DesktopDup", value: "DXGI_DesktopDup" },
            {
              label: "DXGI_DesktopDup_Window",
              value: "DXGI_DesktopDup_Window",
            },
            { label: "PrintWindow", value: "PrintWindow" },
            {
              label: "PrintWindow (伪最小化)",
              value: "PrintWindowWithPseudoMinimize",
            },
            { label: "ScreenDC", value: "ScreenDC" },
          ]}
        />
      </div>

      <Alert
        message="前置要求"
        description="需要安装 ViGEm Bus Driver 才能使用手柄功能。下载: https://github.com/ViGEm/ViGEmBus/releases"
        type="info"
        showIcon
      />
    </div>
  ),
);
