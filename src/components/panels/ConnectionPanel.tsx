import { memo, useEffect, useState, useCallback } from "react";
import { Drawer, Tabs, Button, List, Select, Space, Spin, Alert, message } from "antd";
import { ReloadOutlined, ApiOutlined, DisconnectOutlined, CheckCircleOutlined, LoadingOutlined, CloseCircleOutlined } from "@ant-design/icons";
import { useMFWStore, type AdbDevice, type Win32Window } from "../../stores/mfwStore";
import { mfwProtocol } from "../../services/server";

interface ConnectionPanelProps {
  open: boolean;
  onClose: () => void;
}

export const ConnectionPanel = memo(({ open, onClose }: ConnectionPanelProps) => {
  const {
    connectionStatus,
    controllerType,
    controllerId,
    deviceInfo,
    adbDevices,
    win32Windows,
    errorMessage,
  } = useMFWStore();

  const [activeTab, setActiveTab] = useState<"adb" | "win32">("adb");
  const [selectedAdbDevice, setSelectedAdbDevice] = useState<AdbDevice | null>(null);
  const [selectedWin32Window, setSelectedWin32Window] = useState<Win32Window | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 首次打开时自动刷新设备列表
  useEffect(() => {
    if (open && adbDevices.length === 0 && win32Windows.length === 0) {
      handleRefresh();
    }
  }, [open]);

  // 刷新设备列表
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    if (activeTab === "adb") {
      mfwProtocol.refreshAdbDevices();
    } else {
      mfwProtocol.refreshWin32Windows();
    }
    setTimeout(() => setIsRefreshing(false), 1000);
  }, [activeTab]);

  // 连接设备
  const handleConnect = useCallback(() => {
    if (activeTab === "adb" && selectedAdbDevice) {
      mfwProtocol.createAdbController({
        adb_path: selectedAdbDevice.adb_path,
        address: selectedAdbDevice.address,
        screencap_methods: selectedAdbDevice.screencap_methods,
        input_methods: selectedAdbDevice.input_methods,
        config: selectedAdbDevice.config,
      });
    } else if (activeTab === "win32" && selectedWin32Window) {
      mfwProtocol.createWin32Controller({
        hwnd: selectedWin32Window.hwnd,
        screencap_method: selectedWin32Window.screencap_methods[0] || "",
        input_method: selectedWin32Window.input_methods[0] || "",
      });
    } else {
      message.warning("请先选择设备");
    }
  }, [activeTab, selectedAdbDevice, selectedWin32Window]);

  // 断开连接
  const handleDisconnect = useCallback(() => {
    if (controllerId) {
      mfwProtocol.disconnectController(controllerId);
    }
  }, [controllerId]);

  // 渲染连接状态
  const renderStatus = () => {
    const statusConfig = {
      disconnected: { icon: <CloseCircleOutlined />, text: "未连接", color: "#999" },
      connecting: { icon: <LoadingOutlined />, text: "连接中...", color: "#faad14" },
      connected: {
        icon: <CheckCircleOutlined />,
        text: `已连接 - ${(deviceInfo as any)?.name || (deviceInfo as any)?.window_name || "未知设备"}`,
        color: "#52c41a",
      },
      failed: { icon: <CloseCircleOutlined />, text: "连接失败", color: "#ff4d4f" },
    };

    const config = statusConfig[connectionStatus];
    return (
      <Space style={{ color: config.color, marginBottom: 16 }}>
        {config.icon}
        <span>{config.text}</span>
      </Space>
    );
  };

  // 渲染 ADB 设备列表
  const renderAdbDevices = () => (
    <List
      loading={isRefreshing}
      dataSource={adbDevices}
      locale={{ emptyText: "暂无设备，请点击刷新" }}
      renderItem={(device) => (
        <List.Item
          onClick={() => setSelectedAdbDevice(device)}
          style={{
            cursor: "pointer",
            backgroundColor: selectedAdbDevice?.address === device.address ? "#e6f7ff" : undefined,
          }}
        >
          <List.Item.Meta
            title={device.name || device.address}
            description={
              <Space direction="vertical" size={0}>
                <span>地址: {device.address}</span>
                <span>截图: {device.screencap_methods.join(", ")}</span>
                <span>输入: {device.input_methods.join(", ")}</span>
              </Space>
            }
          />
        </List.Item>
      )}
    />
  );

  // 渲染 Win32 窗口列表
  const renderWin32Windows = () => (
    <List
      loading={isRefreshing}
      dataSource={win32Windows}
      locale={{ emptyText: "暂无窗口，请点击刷新" }}
      renderItem={(window) => (
        <List.Item
          onClick={() => setSelectedWin32Window(window)}
          style={{
            cursor: "pointer",
            backgroundColor: selectedWin32Window?.hwnd === window.hwnd ? "#e6f7ff" : undefined,
          }}
        >
          <List.Item.Meta
            title={window.window_name || window.class_name}
            description={
              <Space direction="vertical" size={0}>
                <span>句柄: {window.hwnd}</span>
                <span>截图: {window.screencap_methods.join(", ")}</span>
                <span>输入: {window.input_methods.join(", ")}</span>
              </Space>
            }
          />
        </List.Item>
      )}
    />
  );

  return (
    <Drawer
      title="连接配置"
      placement="right"
      width={480}
      open={open}
      onClose={onClose}
    >
      {/* 连接状态 */}
      <div style={{ marginBottom: 24 }}>
        {renderStatus()}
        {errorMessage && (
          <Alert message={errorMessage} type="error" showIcon style={{ marginTop: 8 }} />
        )}
      </div>

      {/* 设备类型选择 */}
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as "adb" | "win32")}
        items={[
          { key: "adb", label: "ADB 设备" },
          { key: "win32", label: "Win32 窗口" },
        ]}
      />

      {/* 刷新按钮 */}
      <div style={{ marginBottom: 16 }}>
        <Button
          icon={<ReloadOutlined />}
          onClick={handleRefresh}
          loading={isRefreshing}
          block
        >
          刷新设备列表
        </Button>
      </div>

      {/* 设备列表 */}
      <div style={{ marginBottom: 24, maxHeight: 400, overflow: "auto" }}>
        {activeTab === "adb" ? renderAdbDevices() : renderWin32Windows()}
      </div>

      {/* 操作按钮 */}
      <Space style={{ width: "100%" }}>
        {connectionStatus === "connected" ? (
          <Button
            type="primary"
            danger
            icon={<DisconnectOutlined />}
            onClick={handleDisconnect}
            block
          >
            断开连接
          </Button>
        ) : (
          <Button
            type="primary"
            icon={<ApiOutlined />}
            onClick={handleConnect}
            loading={connectionStatus === "connecting"}
            disabled={
              connectionStatus === "connecting" ||
              (activeTab === "adb" && !selectedAdbDevice) ||
              (activeTab === "win32" && !selectedWin32Window)
            }
            block
          >
            连接
          </Button>
        )}
      </Space>
    </Drawer>
  );
});
