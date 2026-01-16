import { memo, useEffect, useState, useCallback, useMemo } from "react";
import {
  Drawer,
  Tabs,
  Button,
  List,
  Select,
  Alert,
  message,
  Card,
  Typography,
  Badge,
} from "antd";
import {
  ReloadOutlined,
  ApiOutlined,
  DisconnectOutlined,
  CheckCircleOutlined,
  DesktopOutlined,
  MobileOutlined,
  SwapOutlined,
  AppleOutlined,
  RocketOutlined,
} from "@ant-design/icons";
import {
  useMFWStore,
  type AdbDevice,
  type Win32Window,
} from "../../../stores/mfwStore";
import { mfwProtocol } from "../../../services/server";

const { Text } = Typography;

interface ConnectionPanelProps {
  open: boolean;
  onClose: () => void;
}

export const ConnectionPanel = memo(
  ({ open, onClose }: ConnectionPanelProps) => {
    const {
      connectionStatus,
      controllerId,
      controllerType,
      deviceInfo,
      adbDevices,
      win32Windows,
      errorMessage,
    } = useMFWStore();

    const [activeTab, setActiveTab] = useState<
      "adb" | "win32" | "playcover" | "gamepad"
    >("adb");
    const [selectedAdbDevice, setSelectedAdbDevice] =
      useState<AdbDevice | null>(null);
    const [selectedWin32Window, setSelectedWin32Window] =
      useState<Win32Window | null>(null);
    // PlayCover 连接参数
    const [playCoverAddress, setPlayCoverAddress] = useState<string>("");
    const [playCoverUUID, setPlayCoverUUID] = useState<string>("");
    const [playCoverName, setPlayCoverName] = useState<string>("");
    // Gamepad 连接参数
    const [gamepadType, setGamepadType] = useState<"Xbox360" | "DualShock4">(
      "Xbox360"
    );
    const [gamepadHwnd, setGamepadHwnd] = useState<string>("");
    const [gamepadScreencap, setGamepadScreencap] = useState<string>("");
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set());
    const [hasInitialized, setHasInitialized] = useState(false);

    // 自定义截图和输入方法
    const [customScreencap, setCustomScreencap] = useState<
      string | string[] | undefined
    >(undefined);
    const [customInput, setCustomInput] = useState<
      string | string[] | undefined
    >(undefined);

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

    // 初始化时设置默认值
    useEffect(() => {
      if (
        selectedDeviceMethods.screencap.length > 0 &&
        customScreencap === undefined
      ) {
        if (activeTab === "adb") {
          setCustomScreencap(selectedDeviceMethods.screencap);
        } else {
          setCustomScreencap(selectedDeviceMethods.screencap[0]);
        }
      }
      if (selectedDeviceMethods.input.length > 0 && customInput === undefined) {
        if (activeTab === "adb") {
          setCustomInput(selectedDeviceMethods.input);
        } else {
          setCustomInput(selectedDeviceMethods.input[0]);
        }
      }
    }, [selectedDeviceMethods, activeTab]);

    // 切换设备时重置方法选择
    useEffect(() => {
      if (selectedAdbDevice) {
        // ADB 设备默认选择所有方法
        const filteredScreencap = selectedDeviceMethods.screencap.filter(
          (m) => m !== "RawByNetcat"
        );
        const filteredInput = selectedDeviceMethods.input.filter(
          (m) => m !== "RawByNetcat"
        );
        setCustomScreencap(filteredScreencap);
        setCustomInput(filteredInput);
      } else if (selectedWin32Window) {
        // Win32 窗口默认选择第一个非 RawByNetcat 的方法
        const firstScreencap =
          selectedDeviceMethods.screencap.find((m) => m !== "RawByNetcat") ||
          selectedDeviceMethods.screencap[0];
        const firstInput =
          selectedDeviceMethods.input.find((m) => m !== "RawByNetcat") ||
          selectedDeviceMethods.input[0];
        setCustomScreencap(firstScreencap);
        setCustomInput(firstInput);
      }
    }, [
      selectedAdbDevice?.address,
      selectedWin32Window?.hwnd,
      selectedDeviceMethods,
    ]);

    // 打开面板时的初始化逻辑
    useEffect(() => {
      if (open && !hasInitialized) {
        setHasInitialized(true);

        // 如果已连接，设置对应的 Tab 和设备选中状态
        if (connectionStatus === "connected" && deviceInfo) {
          if (controllerType === "adb") {
            setActiveTab("adb");
            // 尝试找到当前连接的设备
            const connectedDevice = adbDevices.find(
              (d) => d.address === (deviceInfo as any)?.address
            );
            if (connectedDevice) {
              setSelectedAdbDevice(connectedDevice);
            }
          } else if (controllerType === "win32") {
            setActiveTab("win32");
            // 尝试找到当前连接的窗口
            const connectedWindow = win32Windows.find(
              (w) => w.hwnd === (deviceInfo as any)?.hwnd
            );
            if (connectedWindow) {
              setSelectedWin32Window(connectedWindow);
            }
          }
          // 已连接状态下不触发刷新
          return;
        }

        setVisitedTabs((prev) => new Set(prev).add(activeTab));
      }
    }, [
      open,
      hasInitialized,
      connectionStatus,
      controllerType,
      deviceInfo,
      adbDevices,
      win32Windows,
      activeTab,
    ]);

    // 未连接且第一次打开时自动刷新设备列表
    useEffect(() => {
      if (
        open &&
        !visitedTabs.has(activeTab) &&
        connectionStatus !== "connected"
      ) {
        setVisitedTabs((prev) => new Set(prev).add(activeTab));
        handleRefresh();
      }
    }, [activeTab, open, visitedTabs, connectionStatus]);

    // 关闭面板时重置访问记录和初始化状态
    useEffect(() => {
      if (!open) {
        setVisitedTabs(new Set());
        setHasInitialized(false);
      }
    }, [open]);

    // 刷新设备列表
    const handleRefresh = useCallback(() => {
      setIsRefreshing(true);
      if (activeTab === "adb") {
        mfwProtocol.refreshAdbDevices();
      } else if (activeTab === "win32") {
        mfwProtocol.refreshWin32Windows();
      }
      setTimeout(() => setIsRefreshing(false), 1000);
    }, [activeTab]);

    // 连接设备
    const handleConnect = useCallback(() => {
      if (activeTab === "adb" && selectedAdbDevice) {
        // ADB 设备的方法支持多选
        const screencapMethods = customScreencap
          ? Array.isArray(customScreencap)
            ? customScreencap
            : [customScreencap]
          : selectedAdbDevice.screencap_methods;
        const inputMethods = customInput
          ? Array.isArray(customInput)
            ? customInput
            : [customInput]
          : selectedAdbDevice.input_methods;

        if (screencapMethods.length === 0 || inputMethods.length === 0) {
          message.warning("设备没有可用的截图或输入方法");
          return;
        }

        mfwProtocol.createAdbController({
          adb_path: selectedAdbDevice.adb_path,
          address: selectedAdbDevice.address,
          screencap_methods: screencapMethods,
          input_methods: inputMethods,
          config: selectedAdbDevice.config,
        });
      } else if (activeTab === "win32" && selectedWin32Window) {
        // Win32 窗口的方法只支持单选
        const screencapMethod = Array.isArray(customScreencap)
          ? customScreencap[0]
          : customScreencap || selectedWin32Window.screencap_methods[0];
        const inputMethod = Array.isArray(customInput)
          ? customInput[0]
          : customInput || selectedWin32Window.input_methods[0];

        if (!screencapMethod || !inputMethod) {
          message.warning("窗口没有可用的截图或输入方法");
          return;
        }

        mfwProtocol.createWin32Controller({
          hwnd: selectedWin32Window.hwnd,
          screencap_method: screencapMethod,
          input_method: inputMethod,
        });
      } else if (activeTab === "playcover") {
        // PlayCover 连接
        if (!playCoverAddress.trim()) {
          message.warning("请输入 PlayCover 地址");
          return;
        }
        if (!playCoverUUID.trim()) {
          message.warning("请输入设备 UUID");
          return;
        }

        mfwProtocol.createPlayCoverController({
          address: playCoverAddress.trim(),
          uuid: playCoverUUID.trim(),
          name: playCoverName.trim() || "PlayCover Device",
        });
      } else if (activeTab === "gamepad") {
        // Gamepad 连接
        mfwProtocol.createGamepadController({
          hwnd: gamepadHwnd.trim() || undefined,
          gamepad_type: gamepadType,
          screencap_method: gamepadScreencap || undefined,
        });
      } else {
        message.warning("请先选择设备");
      }
    }, [
      activeTab,
      selectedAdbDevice,
      selectedWin32Window,
      customScreencap,
      customInput,
      playCoverAddress,
      playCoverUUID,
      playCoverName,
      gamepadType,
      gamepadHwnd,
      gamepadScreencap,
    ]);

    // 断开连接
    const handleDisconnect = useCallback(() => {
      if (controllerId) {
        mfwProtocol.disconnectController(controllerId);
      }
    }, [controllerId]);

    // 渲染连接状态徽章
    const getStatusBadge = () => {
      const statusConfig = {
        disconnected: { status: "default" as const, text: "未连接" },
        connecting: { status: "processing" as const, text: "连接中" },
        connected: { status: "success" as const, text: "已连接" },
        failed: { status: "error" as const, text: "连接失败" },
      };
      return statusConfig[connectionStatus];
    };

    // 获取当前选中设备
    const hasSelectedDevice =
      activeTab === "adb"
        ? !!selectedAdbDevice
        : activeTab === "win32"
        ? !!selectedWin32Window
        : activeTab === "playcover"
        ? !!(playCoverAddress.trim() && playCoverUUID.trim())
        : activeTab === "gamepad"
        ? true // Gamepad 不需要选择设备
        : false;

    // 检查是否有可用的方法
    const hasValidMethods = useMemo(() => {
      if (activeTab === "adb" && selectedAdbDevice) {
        const screencapMethods = customScreencap
          ? Array.isArray(customScreencap)
            ? customScreencap
            : [customScreencap]
          : selectedAdbDevice.screencap_methods;
        const inputMethods = customInput
          ? Array.isArray(customInput)
            ? customInput
            : [customInput]
          : selectedAdbDevice.input_methods;
        return screencapMethods.length > 0 && inputMethods.length > 0;
      } else if (activeTab === "win32" && selectedWin32Window) {
        const screencap = Array.isArray(customScreencap)
          ? customScreencap[0]
          : customScreencap || selectedWin32Window.screencap_methods[0];
        const input = Array.isArray(customInput)
          ? customInput[0]
          : customInput || selectedWin32Window.input_methods[0];
        return !!screencap && !!input;
      } else if (activeTab === "playcover") {
        return true;
      } else if (activeTab === "gamepad") {
        return true; // Gamepad 不需要验证方法
      }
      return false;
    }, [
      activeTab,
      selectedAdbDevice,
      selectedWin32Window,
      customScreencap,
      customInput,
    ]);

    const canConnect =
      hasSelectedDevice && hasValidMethods && connectionStatus !== "connecting";

    // 判断当前选中的设备是否是已连接的设备
    const isCurrentDevice = useMemo(() => {
      if (connectionStatus !== "connected" || !deviceInfo) return false;

      if (
        activeTab === "adb" &&
        controllerType === "adb" &&
        selectedAdbDevice
      ) {
        return selectedAdbDevice.address === (deviceInfo as any)?.address;
      } else if (
        activeTab === "win32" &&
        controllerType === "win32" &&
        selectedWin32Window
      ) {
        return selectedWin32Window.hwnd === (deviceInfo as any)?.hwnd;
      } else if (activeTab === "playcover" && controllerType === "playcover") {
        return playCoverAddress === (deviceInfo as any)?.address;
      }
      return false;
    }, [
      connectionStatus,
      controllerType,
      deviceInfo,
      activeTab,
      selectedAdbDevice,
      selectedWin32Window,
      playCoverAddress,
    ]);

    // 连接新设备
    const handleConnectNew = useCallback(() => {
      if (!controllerId) return;

      // 先断开当前连接
      mfwProtocol.disconnectController(controllerId);

      // 等待断开完成后再连接新设备
      setTimeout(() => {
        handleConnect();
      }, 500);
    }, [controllerId, handleConnect]);

    // 渲染 ADB 设备列表
    const renderAdbDevices = () => (
      <List
        loading={isRefreshing}
        dataSource={adbDevices}
        locale={{ emptyText: "暂无设备，请点击刷新" }}
        split={false}
        renderItem={(device) => {
          const isSelected = selectedAdbDevice?.address === device.address;
          return (
            <div
              onClick={() => setSelectedAdbDevice(device)}
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
    );

    // 渲染 Win32 窗口列表
    const renderWin32Windows = () => (
      <List
        loading={isRefreshing}
        dataSource={win32Windows}
        locale={{ emptyText: "暂无窗口，请点击刷新" }}
        split={false}
        renderItem={(window) => {
          const isSelected = selectedWin32Window?.hwnd === window.hwnd;
          return (
            <div
              onClick={() => setSelectedWin32Window(window)}
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
                <DesktopOutlined
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
                    {window.window_name || window.class_name}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    句柄: {window.hwnd}
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
    );

    // 渲染 PlayCover 连接表单
    const renderPlayCoverForm = () => (
      <div style={{ padding: "8px 0" }}>
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
              <Text strong>PlayCover 连接</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                连接 macOS 上运行的 iOS 应用
              </Text>
            </div>
          </div>
        </Card>

        <div style={{ marginBottom: 16 }}>
          <Text
            type="secondary"
            style={{ fontSize: 12, marginBottom: 6, display: "block" }}
          >
            PlayCover 地址 <span style={{ color: "#ff4d4f" }}>*</span>
          </Text>
          <input
            type="text"
            value={playCoverAddress}
            onChange={(e) => setPlayCoverAddress(e.target.value)}
            placeholder="例如: 127.0.0.1:1234"
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #d9d9d9",
              fontSize: 14,
              outline: "none",
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <Text
            type="secondary"
            style={{ fontSize: 12, marginBottom: 6, display: "block" }}
          >
            设备 UUID <span style={{ color: "#ff4d4f" }}>*</span>
          </Text>
          <input
            type="text"
            value={playCoverUUID}
            onChange={(e) => setPlayCoverUUID(e.target.value)}
            placeholder="例如: 12345678-1234-1234-1234-123456789abc"
            style={{
              width: "100%",
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
            style={{ fontSize: 12, marginBottom: 6, display: "block" }}
          >
            设备名称 (可选)
          </Text>
          <input
            type="text"
            value={playCoverName}
            onChange={(e) => setPlayCoverName(e.target.value)}
            placeholder="自定义设备名称"
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #d9d9d9",
              fontSize: 14,
              outline: "none",
            }}
          />
        </div>
      </div>
    );

    // 渲染 Gamepad 表单
    const renderGamepadForm = () => (
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
            onChange={setGamepadType}
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
            value={gamepadHwnd}
            onChange={(e) => setGamepadHwnd(e.target.value)}
            placeholder="例: 0x123456 (可以为空)"
            style={{
              width: "100%",
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
            value={gamepadScreencap || undefined}
            onChange={(value) => setGamepadScreencap(value || "")}
            style={{ width: "100%" }}
            options={[
              { label: "FramePool", value: "FramePool" },
              { label: "GDI", value: "GDI" },
              { label: "DXGI_DesktopDup", value: "DXGIDesktopDup" },
              { label: "PrintWindow", value: "PrintWindow" },
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
    );

    const statusBadge = getStatusBadge();

    return (
      <Drawer
        title={
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontSize: 16,
            }}
          >
            <span>连接配置</span>
            <Badge status={statusBadge.status} text={statusBadge.text} />
          </div>
        }
        placement="right"
        size={490}
        open={open}
        onClose={onClose}
        styles={{
          body: { display: "flex", flexDirection: "column", padding: 0 },
        }}
      >
        <div
          style={{ display: "flex", flexDirection: "column", height: "100%" }}
        >
          {/* 顶部操作区 */}
          <div
            style={{
              padding: "16px 24px",
              borderBottom: "1px solid #f0f0f0",
            }}
          >
            {/* 连接状态信息 */}
            {connectionStatus === "connected" && deviceInfo && (
              <Card
                size="small"
                style={{
                  marginBottom: 20,
                  backgroundColor: "#f6ffed",
                  borderColor: "#b7eb8f",
                  padding: "4px 0",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <CheckCircleOutlined
                    style={{ color: "#52c41a", fontSize: 16 }}
                  />
                  <Text style={{ fontSize: 14 }}>
                    已连接:{" "}
                    {(deviceInfo as any)?.name ||
                      (deviceInfo as any)?.window_name ||
                      "未知设备"}
                  </Text>
                </div>
              </Card>
            )}

            {errorMessage && (
              <Alert
                title={errorMessage}
                type="error"
                showIcon
                style={{ marginBottom: 20 }}
              />
            )}

            {/* 操作按钮组 */}
            <div style={{ display: "flex", gap: 12 }}>
              {connectionStatus === "connected" ? (
                <>
                  {!isCurrentDevice && canConnect && (
                    <Button
                      type="primary"
                      icon={<SwapOutlined />}
                      onClick={handleConnectNew}
                      size="large"
                      style={{ flex: 1 }}
                    >
                      连接新设备
                    </Button>
                  )}
                  <Button
                    type="primary"
                    danger
                    icon={<DisconnectOutlined />}
                    onClick={handleDisconnect}
                    size="large"
                    style={{
                      flex: isCurrentDevice || !canConnect ? 1 : undefined,
                    }}
                    block={isCurrentDevice || !canConnect}
                  >
                    断开连接
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="primary"
                    icon={<ApiOutlined />}
                    onClick={handleConnect}
                    loading={connectionStatus === "connecting"}
                    disabled={!canConnect}
                    size="large"
                    style={{ flex: 1 }}
                  >
                    连接设备
                  </Button>
                  <Button
                    icon={<ReloadOutlined spin={isRefreshing} />}
                    onClick={handleRefresh}
                    loading={isRefreshing}
                    size="large"
                    style={{ flex: 1 }}
                  >
                    刷新
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* 方法配置区 - PlayCover 和 Gamepad 不显示 */}
          {activeTab !== "playcover" && activeTab !== "gamepad" && (
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
                    style={{ fontSize: 12, marginBottom: 6, display: "block" }}
                  >
                    截图方法 {activeTab === "adb" && "(可多选)"}
                  </Text>
                  <Select
                    mode={activeTab === "adb" ? "multiple" : undefined}
                    placeholder="自动选择"
                    allowClear
                    value={customScreencap}
                    onChange={setCustomScreencap}
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
                    style={{ fontSize: 12, marginBottom: 6, display: "block" }}
                  >
                    输入方法 {activeTab === "adb" && "(可多选)"}
                  </Text>
                  <Select
                    mode={activeTab === "adb" ? "multiple" : undefined}
                    placeholder="自动选择"
                    allowClear
                    value={customInput}
                    onChange={setCustomInput}
                    style={{ width: "100%" }}
                    options={
                      selectedDeviceMethods.input.length > 0
                        ? selectedDeviceMethods.input.map((m) => ({
                            label: m,
                            value: m,
                          }))
                        : allMethods.input.map((m) => ({ label: m, value: m }))
                    }
                  />
                </div>
              </div>
            </div>
          )}

          {/* 设备类型选择 */}
          <div style={{ padding: "0 24px" }}>
            <Tabs
              activeKey={activeTab}
              onChange={(key) =>
                setActiveTab(key as "adb" | "win32" | "playcover" | "gamepad")
              }
              items={[
                {
                  key: "adb",
                  label: (
                    <span>
                      <MobileOutlined style={{ marginRight: 8 }} />
                      ADB 设备
                    </span>
                  ),
                },
                {
                  key: "win32",
                  label: (
                    <span>
                      <DesktopOutlined style={{ marginRight: 8 }} />
                      Win32 窗口
                    </span>
                  ),
                },
                {
                  key: "playcover",
                  label: (
                    <span>
                      <AppleOutlined style={{ marginRight: 8 }} />
                      PlayCover
                    </span>
                  ),
                },
                {
                  key: "gamepad",
                  label: (
                    <span>
                      <RocketOutlined style={{ marginRight: 8 }} />
                      Gamepad
                    </span>
                  ),
                },
              ]}
              style={{ marginBottom: 0 }}
            />
          </div>

          {/* 设备列表 */}
          <div style={{ flex: 1, overflow: "auto", padding: "16px 24px" }}>
            {activeTab === "adb"
              ? renderAdbDevices()
              : activeTab === "win32"
              ? renderWin32Windows()
              : activeTab === "playcover"
              ? renderPlayCoverForm()
              : renderGamepadForm()}
          </div>
        </div>
      </Drawer>
    );
  }
);
