import { memo } from "react";
import { List, Typography } from "antd";
import { MobileOutlined, CheckCircleOutlined } from "@ant-design/icons";
import type { AdbDevice } from "../../../../stores/mfwStore";

const { Text } = Typography;

interface AdbDeviceListProps {
  devices: AdbDevice[];
  selectedDevice: AdbDevice | null;
  onSelect: (device: AdbDevice) => void;
  loading: boolean;
}

export const AdbDeviceList = memo(
  ({ devices, selectedDevice, onSelect, loading }: AdbDeviceListProps) => (
    <List
      loading={loading}
      dataSource={devices}
      locale={{ emptyText: "暂无设备,请点击刷新" }}
      split={false}
      renderItem={(device) => {
        const isSelected = selectedDevice?.address === device.address;
        return (
          <div
            onClick={() => onSelect(device)}
            style={{
              cursor: "pointer",
              padding: "12px 16px",
              marginBottom: 8,
              borderRadius: 8,
              border: isSelected ? "2px solid #1890ff" : "1px solid #f0f0f0",
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
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
  ),
);
