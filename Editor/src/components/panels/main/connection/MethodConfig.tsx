import { memo, useMemo } from "react";
import { Alert, Select, Typography } from "antd";
import { useTranslation } from "react-i18next";
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
  isAdbManualMode?: boolean;
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
    isAdbManualMode = false,
  }: MethodConfigProps) => {
    const { t } = useTranslation();

    const usesInterception =
      activeTab === "win32" && customInput === "Interception";

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
      if (activeTab === "adb") {
        if (isAdbManualMode) {
          // 手动模式下使用全量方法
          return {
            screencap:
              allMethods.screencap.length > 0
                ? allMethods.screencap
                : [
                    "EncodeToFileAndPull",
                    "Encode",
                    "RawWithGzip",
                    "RawByNetcat",
                    "MinicapDirect",
                    "MinicapStream",
                    "EmulatorExtras",
                  ],
            input:
              allMethods.input.length > 0
                ? allMethods.input
                : [
                    "AdbShell",
                    "MinitouchAndAdbKey",
                    "Maatouch",
                    "EmulatorExtras",
                  ],
          };
        }
        if (selectedAdbDevice) {
          return {
            screencap: selectedAdbDevice.screencap_methods,
            input: selectedAdbDevice.input_methods,
          };
        }
      } else if (activeTab === "win32" && selectedWin32Window) {
        return {
          screencap: selectedWin32Window.screencap_methods,
          input: selectedWin32Window.input_methods,
        };
      }
      return { screencap: [], input: [] };
    }, [
      activeTab,
      selectedAdbDevice,
      selectedWin32Window,
      isAdbManualMode,
      allMethods,
    ]);

    // PlayCover、Gamepad、WlRoots 和 macOS 不显示方法配置
    if (
      activeTab === "playcover" ||
      activeTab === "gamepad" ||
      activeTab === "wlroots" ||
      activeTab === "macos"
    ) {
      return null;
    }

    const multipleSuffix = t(
      "ui.panels.connection.method.multipleSuffix",
      "(可多选)",
    );
    const autoSelect = t(
      "ui.panels.connection.method.autoSelect",
      "自动选择",
    );

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
              {t("ui.panels.connection.method.screencapLabel", "截图方法")}
              {activeTab === "adb" && ` ${multipleSuffix}`}
            </Text>
            <Select
              mode={activeTab === "adb" ? "multiple" : undefined}
              placeholder={autoSelect}
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
              {t("ui.panels.connection.method.inputLabel", "输入方法")}
              {activeTab === "adb" && ` ${multipleSuffix}`}
            </Text>
            <Select
              mode={activeTab === "adb" ? "multiple" : undefined}
              placeholder={autoSelect}
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
        {usesInterception && (
          <Alert
            type="warning"
            showIcon
            title={t(
              "ui.panels.connection.method.interceptionTitle",
              "Interception 驱动要求",
            )}
            description={t(
              "ui.panels.connection.method.interceptionDesc",
              "需要安装 Interception 驱动，并以不低于目标程序的权限运行。鼠标和按键操作通过驱动发送，文本输入仍使用系统 Unicode 输入。",
            )}
            style={{ marginTop: 12 }}
          />
        )}
      </div>
    );
  },
);
