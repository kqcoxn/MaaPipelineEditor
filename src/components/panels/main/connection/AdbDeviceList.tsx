import { memo } from "react";
import { List, Typography } from "antd";
import { MobileOutlined, CheckCircleOutlined } from "@ant-design/icons";
import type { AdbDevice } from "../../../../stores/mfwStore";
import { AdbManualForm } from "./AdbManualForm";

const { Text } = Typography;

interface AdbDeviceListProps {
  devices: AdbDevice[];
  selectedDevice: AdbDevice | null;
  onSelect: (device: AdbDevice | null) => void;
  loading: boolean;
  manualAdbPath: string;
  manualAddress: string;
  manualConfig: string;
  manualName: string;
  onManualAdbPathChange: (value: string) => void;
  onManualAddressChange: (value: string) => void;
  onManualConfigChange: (value: string) => void;
  onManualNameChange: (value: string) => void;
}

export const AdbDeviceList = memo(
  ({
    devices,
    selectedDevice,
    onSelect,
    loading,
    manualAdbPath,
    manualAddress,
    manualConfig,
    manualName,
    onManualAdbPathChange,
    onManualAddressChange,
    onManualConfigChange,
    onManualNameChange,
  }: AdbDeviceListProps) => {
    const handleSelectPreset = (device: AdbDevice) => {
      onSelect(device);
      // 清空手动输入
      onManualAdbPathChange("");
      onManualAddressChange("");
      onManualConfigChange("");
      onManualNameChange("");
    };

    const handleManualChange = (
      field: "adbPath" | "address" | "config" | "name",
      value: string,
    ) => {
      if (field === "adbPath") onManualAdbPathChange(value);
      else if (field === "address") onManualAddressChange(value);
      else if (field === "config") onManualConfigChange(value);
      else onManualNameChange(value);

      // 有手动输入时清空列表选择
      if (selectedDevice) {
        onSelect(null);
      }
    };

    const hasManualInput =
      manualAdbPath.trim().length > 0 || manualAddress.trim().length > 0;

    return (
      <div>
        {/* 设备列表 */}
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
            已发现的设备
          </Text>
          <List
            loading={loading}
            dataSource={devices}
            locale={{ emptyText: "暂无设备,请点击刷新" }}
            split={false}
            renderItem={(device) => {
              const isSelected = selectedDevice?.address === device.address;
              return (
                <div
                  onClick={() => handleSelectPreset(device)}
                  style={{
                    cursor: "pointer",
                    padding: "12px 16px",
                    marginBottom: 8,
                    borderRadius: 8,
                    border: isSelected
                      ? "2px solid #1890ff"
                      : "1px solid #f0f0f0",
                    backgroundColor: isSelected ? "#e6f7ff" : "#fafafa",
                    opacity: hasManualInput ? 0.5 : 1,
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
                    style={{ display: "flex", alignItems: "center", gap: 12 }}
                  >
                    <MobileOutlined
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
                        {device.name || device.address}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {device.address}
                      </Text>
                    </div>
                    {isSelected && !hasManualInput && (
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
            或手动连接
          </Text>
          <div style={{ flex: 1, height: 1, backgroundColor: "#f0f0f0" }} />
        </div>

        {/* 手动输入 */}
        <AdbManualForm
          adbPath={manualAdbPath}
          address={manualAddress}
          config={manualConfig}
          name={manualName}
          onAdbPathChange={(v) => handleManualChange("adbPath", v)}
          onAddressChange={(v) => handleManualChange("address", v)}
          onConfigChange={(v) => handleManualChange("config", v)}
          onNameChange={(v) => handleManualChange("name", v)}
        />

        {hasManualInput && !!selectedDevice && (
          <Text
            type="warning"
            style={{
              display: "block",
              marginTop: 8,
              fontSize: 12,
            }}
          >
            将使用手动输入的连接信息，列表选择将被忽略
          </Text>
        )}
      </div>
    );
  },
);
