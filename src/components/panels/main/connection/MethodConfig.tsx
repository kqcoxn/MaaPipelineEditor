import { memo, useMemo } from "react";
import { Select, Typography } from "antd";
import type { AdbDevice, Win32Window } from "../../../../stores/mfwStore";

const { Text } = Typography;

interface MethodConfigProps {
  activeTab: "adb" | "win32" | "playcover" | "gamepad" | "wlroots" | "macos";
  selectedAdbDevice: AdbDevice | null;
  selectedWin32Window: Win32Window | null;
  adbDevices: AdbDevice[];
  win32Windows: Win32Window[];
  customScreencap: string | string[] | undefined;
  customInput: string | string[] | undefined;
  onScreencapChange: (value: string | string[]) => void;
  onInputChange: (value: string | string[]) => void;
}

export const MethodConfig = memo(
  ({
    activeTab,
    selectedAdbDevice,
    selectedWin32Window,
    adbDevices,
    win32Windows,
    customScreencap,
    customInput,
    onScreencapChange,
    onInputChange,
  }: MethodConfigProps) => {
    // 收集所有可用的截图和输入方法
    const allMethods = useMemo(() => {
      const screencapSet = new Set<string>();
      const inputSet = new Set<string>();

      adbDevices.forEach((d) => {
        d.screencap_methods.forEach((m) => screencapSet.add(m));
        d.input_methods.forEach((m) => inputSet.add(m));
      });
      win32Windows.forEach((w) => {
        w.screencap_methods.forEach((m) => screencapSet.add(m));
        w.input_methods.forEach((m) => inputSet.add(m));
      });

      return {
        screencap: Array.from(screencapSet),
        input: Array.from(inputSet),
      };
    }, [adbDevices, win32Windows]);

    // 获取当前选中设备的方法列表
    const selectedDeviceMethods = useMemo(() => {
      if (activeTab === "adb" && selectedAdbDevice) {
        return {
          screencap: selectedAdbDevice.screencap_methods,
          input: selectedAdbDevice.input_methods,
        };
      } else if (activeTab === "win32" && selectedWin32Window) {
        return {
          screencap: selectedWin32Window.screencap_methods,
          input: selectedWin32Window.input_methods,
        };
      }
      return { screencap: [], input: [] };
    }, [activeTab, selectedAdbDevice, selectedWin32Window]);

    // PlayCover、Gamepad、WlRoots 和 macOS 不显示方法配置
    if (
      activeTab === "playcover" ||
      activeTab === "gamepad" ||
      activeTab === "wlroots" ||
      activeTab === "macos"
    ) {
      return null;
    }

    return (
      <div
        style={{
          padding: "16px 24px",
          backgroundColor: "#fafafa",
          borderBottom: "1px solid #f0f0f0",
        }}
      >
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Text
              type="secondary"
              style={{
                fontSize: 12,
                marginBottom: 6,
                display: "block",
              }}
            >
              截图方法 {activeTab === "adb" && "(可多选)"}
            </Text>
            <Select
              mode={activeTab === "adb" ? "multiple" : undefined}
              placeholder="自动选择"
              allowClear
              value={customScreencap}
              onChange={onScreencapChange}
              style={{ width: "100%" }}
              options={
                selectedDeviceMethods.screencap.length > 0
                  ? selectedDeviceMethods.screencap.map((m) => ({
                      label: m,
                      value: m,
                    }))
                  : allMethods.screencap.map((m) => ({
                      label: m,
                      value: m,
                    }))
              }
            />
          </div>
          <div style={{ flex: 1 }}>
            <Text
              type="secondary"
              style={{
                fontSize: 12,
                marginBottom: 6,
                display: "block",
              }}
            >
              输入方法 {activeTab === "adb" && "(可多选)"}
            </Text>
            <Select
              mode={activeTab === "adb" ? "multiple" : undefined}
              placeholder="自动选择"
              allowClear
              value={customInput}
              onChange={onInputChange}
              style={{ width: "100%" }}
              options={
                selectedDeviceMethods.input.length > 0
                  ? selectedDeviceMethods.input.map((m) => ({
                      label: m,
                      value: m,
                    }))
                  : allMethods.input.map((m) => ({
                      label: m,
                      value: m,
                    }))
              }
            />
          </div>
        </div>
      </div>
    );
  },
);
