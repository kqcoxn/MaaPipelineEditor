import { memo } from "react";
import { Input, Typography } from "antd";
import {
  FolderOutlined,
  GlobalOutlined,
  MobileOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";

const { Text } = Typography;

interface AdbManualFormProps {
  adbPath: string;
  address: string;
  config: string;
  name: string;
  onAdbPathChange: (value: string) => void;
  onAddressChange: (value: string) => void;
  onConfigChange: (value: string) => void;
  onNameChange: (value: string) => void;
}

export const AdbManualForm = memo(
  ({
    adbPath,
    address,
    config,
    name,
    onAdbPathChange,
    onAddressChange,
    onConfigChange,
    onNameChange,
  }: AdbManualFormProps) => {
    const { t } = useTranslation();

    return (
      <div>
        {/* 设备名称 */}
        <div style={{ marginBottom: 12 }}>
          <Text
            type="secondary"
            style={{ fontSize: 12, display: "block", marginBottom: 4 }}
          >
            {t(
              "ui.panels.connection.adb.deviceNameOptional",
              "设备名称（可选）",
            )}
          </Text>
          <Input
            placeholder={t(
              "ui.panels.connection.adb.deviceNamePlaceholder",
              "例如: mumu模拟器",
            )}
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            prefix={<MobileOutlined style={{ color: "#999" }} />}
            allowClear
          />
        </div>

        {/* ADB 路径 */}
        <div style={{ marginBottom: 12 }}>
          <Text
            type="secondary"
            style={{ fontSize: 12, display: "block", marginBottom: 4 }}
          >
            {t("ui.panels.connection.adb.adbPath", "ADB 路径")}
          </Text>
          <Input
            placeholder={t(
              "ui.panels.connection.adb.adbPathPlaceholder",
              "例如: C:\\platform-tools\\adb.exe",
            )}
            value={adbPath}
            onChange={(e) => onAdbPathChange(e.target.value)}
            prefix={<FolderOutlined style={{ color: "#999" }} />}
            allowClear
          />
        </div>

        {/* 设备地址 */}
        <div style={{ marginBottom: 12 }}>
          <Text
            type="secondary"
            style={{ fontSize: 12, display: "block", marginBottom: 4 }}
          >
            {t("ui.panels.connection.adb.deviceAddress", "设备地址")}
          </Text>
          <Input
            placeholder={t(
              "ui.panels.connection.adb.deviceAddressPlaceholder",
              "例如: 127.0.0.1:5555",
            )}
            value={address}
            onChange={(e) => onAddressChange(e.target.value)}
            prefix={<GlobalOutlined style={{ color: "#999" }} />}
            allowClear
          />
        </div>

        {/* 额外配置 */}
        <div>
          <Text
            type="secondary"
            style={{ fontSize: 12, display: "block", marginBottom: 4 }}
          >
            {t(
              "ui.panels.connection.adb.extraConfigOptional",
              "额外配置（可选）",
            )}
          </Text>
          <Input.TextArea
            placeholder={t(
              "ui.panels.connection.adb.extraConfigPlaceholder",
              '例如: {"extras":{}}',
            )}
            value={config}
            onChange={(e) => onConfigChange(e.target.value)}
            autoSize={{ minRows: 1, maxRows: 3 }}
            allowClear
          />
        </div>
      </div>
    );
  },
);
