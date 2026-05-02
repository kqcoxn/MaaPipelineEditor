import { memo, useEffect, useState, useCallback, useMemo } from "react";
import { usePersistedState } from "../../../hooks/usePersistedState";
import {
  Drawer,
  Tabs,
  Button,
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
  type WlRootsCompositor,
} from "../../../stores/mfwStore";
import { mfwProtocol } from "../../../services/server";
import {
  AdbDeviceList,
  Win32WindowList,
  PlayCoverForm,
  GamepadForm,
  WlRootsForm,
  MacOSForm,
  MethodConfig,
  detectPlatform,
  PLATFORM_TABS,
  MACOS_DEFAULT_METHODS,
} from "./connection";

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
      wlrootsCompositors: wlrootsSockets,
      errorMessage,
    } = useMFWStore();

    // 检测当前平台
    const currentPlatform = useMemo(() => detectPlatform(), []);
    const availableTabs = useMemo(
      () => PLATFORM_TABS[currentPlatform],
      [currentPlatform],
    );

    const [activeTab, setActiveTab] = useState<
      "adb" | "win32" | "playcover" | "gamepad" | "wlroots" | "macos"
    >(availableTabs[0]);
    const [selectedAdbDevice, setSelectedAdbDevice] =
      useState<AdbDevice | null>(null);
    const [selectedWin32Window, setSelectedWin32Window] =
      useState<Win32Window | null>(null);
    const [selectedWlRootsSocket, setSelectedWlRootsSocket] =
      useState<WlRootsCompositor | null>(null);
    const [wlrootsSocketPath, setWlrootsSocketPath] = usePersistedState<string>(
      "wl_socket",
      "",
    );
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set());
    const [hasInitialized, setHasInitialized] = useState(false);

    // ADB 手动连接参数
    const [manualAdbPath, setManualAdbPath] = usePersistedState<string>(
      "adb_path",
      "",
    );
    const [manualAddress, setManualAddress] = usePersistedState<string>(
      "adb_address",
      "",
    );
    const [manualConfig, setManualConfig] = usePersistedState<string>(
      "adb_config",
      "",
    );
    const [manualName, setManualName] = usePersistedState<string>(
      "adb_name",
      "",
    );

    // PlayCover 连接参数
    const [playCoverAddress, setPlayCoverAddress] = usePersistedState<string>(
      "pc_address",
      "",
    );
    const [playCoverUUID, setPlayCoverUUID] = usePersistedState<string>(
      "pc_uuid",
      "",
    );
    const [playCoverName, setPlayCoverName] = usePersistedState<string>(
      "pc_name",
      "",
    );

    // Gamepad 连接参数
    const [gamepadType, setGamepadType] = usePersistedState<
      "Xbox360" | "DualShock4"
    >("gp_type", "Xbox360");
    const [gamepadHwnd, setGamepadHwnd] = usePersistedState<string>(
      "gp_hwnd",
      "",
    );
    const [gamepadScreencap, setGamepadScreencap] = usePersistedState<string>(
      "gp_screencap",
      "",
    );

    // macOS 连接参数
    const [macosPid, setMacosPid] = usePersistedState<string>("mac_pid", "");
    const [macosScreencap, setMacosScreencap] = usePersistedState<string>(
      "mac_screencap",
      MACOS_DEFAULT_METHODS.screencap[0],
    );
    const [macosInput, setMacosInput] = usePersistedState<string>(
      "mac_input",
      MACOS_DEFAULT_METHODS.input[0],
    );

    // WlRoots 连接参数
    const [wlrootsUseWin32VkCode, setWlrootsUseWin32VkCode] = usePersistedState<boolean>(
      "wlroots_use_win32_vkcode",
      true,
    );

    // 自定义截图和输入方法
    const [customScreencap, setCustomScreencap] = useState<
      string | string[] | undefined
    >(undefined);
    const [customInput, setCustomInput] = useState<
      string | string[] | undefined
    >(undefined);

    // 是否处于 ADB 手动连接模式
    const isAdbManualMode =
      manualAdbPath.trim().length > 0 || manualAddress.trim().length > 0;

    // ADB 手动连接时的默认可选方法
    const ADB_DEFAULT_SCREENCAP_METHODS = [
      "EncodeToFileAndPull",
      "Encode",
      "RawWithGzip",
      "RawByNetcat",
      "MinicapDirect",
      "MinicapStream",
      "EmulatorExtras",
    ];
    const ADB_DEFAULT_INPUT_METHODS = [
      "AdbShell",
      "MinitouchAndAdbKey",
      "Maatouch",
      "EmulatorExtras",
    ];

    // 获取当前选中设备的方法列表(用于初始化)
    const selectedDeviceMethods = useMemo(() => {
      if (activeTab === "adb") {
        if (isAdbManualMode) {
          return {
            screencap: ADB_DEFAULT_SCREENCAP_METHODS,
            input: ADB_DEFAULT_INPUT_METHODS,
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
    }, [activeTab, selectedAdbDevice, selectedWin32Window, isAdbManualMode]);

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
      if (activeTab === "adb" && isAdbManualMode) {
        // 手动模式下设置默认方法
        const filteredScreencap = ADB_DEFAULT_SCREENCAP_METHODS.filter(
          (m) => m !== "RawByNetcat",
        );
        const filteredInput = ADB_DEFAULT_INPUT_METHODS.filter(
          (m) => m !== "RawByNetcat",
        );
        setCustomScreencap(filteredScreencap);
        setCustomInput(filteredInput);
      } else if (selectedAdbDevice) {
        // ADB 设备默认选择所有方法
        const filteredScreencap = selectedDeviceMethods.screencap.filter(
          (m) => m !== "RawByNetcat",
        );
        const filteredInput = selectedDeviceMethods.input.filter(
          (m) => m !== "RawByNetcat",
        );
        setCustomScreencap(filteredScreencap);
        setCustomInput(filteredInput);
      } else if (selectedWin32Window) {
        // Win32 窗口默认选择 FramePool 截图和 SendMessageWithCursorPos 输入
        const defaultScreencap =
          selectedDeviceMethods.screencap.find((m) => m === "FramePool") ||
          selectedDeviceMethods.screencap[0];
        const defaultInput =
          selectedDeviceMethods.input.find(
            (m) => m === "SendMessageWithCursorPos",
          ) || selectedDeviceMethods.input[0];
        setCustomScreencap(defaultScreencap);
        setCustomInput(defaultInput);
      }
    }, [
      selectedAdbDevice?.address,
      selectedWin32Window?.hwnd,
      selectedDeviceMethods,
      isAdbManualMode,
      activeTab,
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
              (d) => d.address === (deviceInfo as any)?.address,
            );
            if (connectedDevice) {
              setSelectedAdbDevice(connectedDevice);
            }
          } else if (controllerType === "win32") {
            setActiveTab("win32");
            // 尝试找到当前连接的窗口
            const connectedWindow = win32Windows.find(
              (w) => w.hwnd === (deviceInfo as any)?.hwnd,
            );
            if (connectedWindow) {
              setSelectedWin32Window(connectedWindow);
            }
          } else if (controllerType === "wlroots") {
            setActiveTab("wlroots");
            const socketPath = (deviceInfo as any)?.socket_path || "";
            setWlrootsSocketPath(socketPath);
            // 尝试在列表中找到对应的 socket
            const connectedSocket = wlrootsSockets.find(
              (s) => s.socket_path === socketPath,
            );
            if (connectedSocket) {
              setSelectedWlRootsSocket(connectedSocket);
            }
          } else if (controllerType === "macos") {
            setActiveTab("macos");
            setMacosPid((deviceInfo as any)?.pid || "");
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
      wlrootsSockets,
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
      } else if (activeTab === "wlroots") {
        mfwProtocol.refreshWlRootsSockets();
      }
      setTimeout(() => setIsRefreshing(false), 1000);
    }, [activeTab]);

    // 连接设备
    const handleConnect = useCallback(() => {
      if (activeTab === "adb" && (selectedAdbDevice || isAdbManualMode)) {
        if (isAdbManualMode) {
          // 手动连接模式
          if (!manualAdbPath.trim() || !manualAddress.trim()) {
            message.warning("请填写 ADB 路径和设备地址");
            return;
          }

          const screencapMethods = customScreencap
            ? Array.isArray(customScreencap)
              ? customScreencap
              : [customScreencap]
            : ADB_DEFAULT_SCREENCAP_METHODS.filter((m) => m !== "RawByNetcat");
          const inputMethods = customInput
            ? Array.isArray(customInput)
              ? customInput
              : [customInput]
            : ADB_DEFAULT_INPUT_METHODS;

          mfwProtocol.createAdbController({
            adb_path: manualAdbPath.trim(),
            address: manualAddress.trim(),
            screencap_methods: screencapMethods,
            input_methods: inputMethods,
            config: manualConfig.trim() || undefined,
            name: manualName.trim() || undefined,
          });
        } else if (selectedAdbDevice) {
          // 列表选择模式
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
        }
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
      } else if (activeTab === "wlroots") {
        // WlRoots 连接
        const socketPath =
          wlrootsSocketPath.trim() || selectedWlRootsSocket?.socket_path;
        if (!socketPath) {
          message.warning("请选择或输入 socket 路径");
          return;
        }
        mfwProtocol.createWlRootsController({
          socket_path: socketPath,
          use_win32_vk_code: wlrootsUseWin32VkCode
        });
      } else if (activeTab === "macos") {
        // macOS 连接
        if (!macosPid.trim()) {
          message.warning("请输入应用 PID");
          return;
        }
        if (!macosScreencap) {
          message.warning("请选择截图方法");
          return;
        }
        if (!macosInput) {
          message.warning("请选择输入方法");
          return;
        }

        mfwProtocol.createMacosController({
          pid: macosPid.trim(),
          screencap_method: macosScreencap,
          input_method: macosInput,
        });
      } else {
        message.warning("请先选择设备");
      }
    }, [
      activeTab,
      selectedAdbDevice,
      selectedWin32Window,
      selectedWlRootsSocket,
      wlrootsSocketPath,
      customScreencap,
      customInput,
      playCoverAddress,
      playCoverUUID,
      playCoverName,
      gamepadType,
      gamepadHwnd,
      gamepadScreencap,
      macosPid,
      macosScreencap,
      macosInput,
      wlrootsUseWin32VkCode,
      isAdbManualMode,
      manualAdbPath,
      manualAddress,
      manualConfig,
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
        ? !!selectedAdbDevice || isAdbManualMode
        : activeTab === "win32"
          ? !!selectedWin32Window
          : activeTab === "playcover"
            ? !!(playCoverAddress.trim() && playCoverUUID.trim())
            : activeTab === "wlroots"
              ? !!(wlrootsSocketPath.trim() || selectedWlRootsSocket)
              : activeTab === "gamepad"
                ? true // Gamepad 不需要选择设备
                : activeTab === "macos"
                  ? !!macosPid.trim()
                  : false;

    // 检查是否有可用的方法
    const hasValidMethods = useMemo(() => {
      if (activeTab === "adb" && isAdbManualMode) {
        return !!(manualAdbPath.trim() && manualAddress.trim());
      } else if (activeTab === "adb" && selectedAdbDevice) {
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
      } else if (activeTab === "wlroots") {
        return true;
      } else if (activeTab === "macos") {
        return !!macosScreencap && !!macosInput;
      }
      return false;
    }, [
      activeTab,
      selectedAdbDevice,
      selectedWin32Window,
      customScreencap,
      customInput,
      macosScreencap,
      macosInput,
      isAdbManualMode,
      manualAdbPath,
      manualAddress,
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
      } else if (activeTab === "wlroots" && controllerType === "wlroots") {
        return wlrootsSocketPath === (deviceInfo as any)?.socket_path;
      } else if (activeTab === "macos" && controllerType === "macos") {
        return macosPid === (deviceInfo as any)?.pid;
      }
      return false;
    }, [
      connectionStatus,
      controllerType,
      deviceInfo,
      activeTab,
      selectedAdbDevice,
      selectedWin32Window,
      selectedWlRootsSocket,
      wlrootsSocketPath,
      playCoverAddress,
      macosPid,
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

    // 初始化时设置默认值

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
        size={420}
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

          {/* 方法配置区 */}
          <MethodConfig
            activeTab={activeTab}
            selectedAdbDevice={selectedAdbDevice}
            selectedWin32Window={selectedWin32Window}
            adbDevices={adbDevices}
            win32Windows={win32Windows}
            customScreencap={customScreencap}
            customInput={customInput}
            onScreencapChange={setCustomScreencap}
            onInputChange={setCustomInput}
            isAdbManualMode={isAdbManualMode}
          />

          {/* 设备类型选择 */}
          <div style={{ padding: "0 24px" }}>
            <Tabs
              activeKey={activeTab}
              onChange={(key) =>
                setActiveTab(
                  key as "adb" | "win32" | "playcover" | "gamepad" | "wlroots",
                )
              }
              items={[
                ...(availableTabs.includes("adb")
                  ? [
                      {
                        key: "adb",
                        label: (
                          <span>
                            <MobileOutlined style={{ marginRight: 8 }} />
                            ADB 设备
                          </span>
                        ),
                      },
                    ]
                  : []),
                ...(availableTabs.includes("win32")
                  ? [
                      {
                        key: "win32",
                        label: (
                          <span>
                            <DesktopOutlined style={{ marginRight: 8 }} />
                            Win32 窗口
                          </span>
                        ),
                      },
                    ]
                  : []),
                ...(availableTabs.includes("playcover")
                  ? [
                      {
                        key: "playcover",
                        label: (
                          <span>
                            <AppleOutlined style={{ marginRight: 8 }} />
                            PlayCover
                          </span>
                        ),
                      },
                    ]
                  : []),
                ...(availableTabs.includes("gamepad")
                  ? [
                      {
                        key: "gamepad",
                        label: (
                          <span>
                            <RocketOutlined style={{ marginRight: 8 }} />
                            Gamepad
                          </span>
                        ),
                      },
                    ]
                  : []),
                ...(availableTabs.includes("wlroots")
                  ? [
                      {
                        key: "wlroots",
                        label: (
                          <span>
                            <DesktopOutlined style={{ marginRight: 8 }} />
                            WlRoots
                          </span>
                        ),
                      },
                    ]
                  : []),
                ...(availableTabs.includes("macos")
                  ? [
                      {
                        key: "macos",
                        label: (
                          <span>
                            <AppleOutlined style={{ marginRight: 8 }} />
                            macOS 原生
                          </span>
                        ),
                      },
                    ]
                  : []),
              ]}
              style={{ marginBottom: 0 }}
            />
          </div>

          {/* 设备列表 */}
          <div style={{ flex: 1, overflow: "auto", padding: "16px 24px" }}>
            {activeTab === "adb" ? (
              <AdbDeviceList
                devices={adbDevices}
                selectedDevice={selectedAdbDevice}
                onSelect={setSelectedAdbDevice}
                loading={isRefreshing}
                manualAdbPath={manualAdbPath}
                manualAddress={manualAddress}
                manualConfig={manualConfig}
                manualName={manualName}
                onManualAdbPathChange={setManualAdbPath}
                onManualAddressChange={setManualAddress}
                onManualConfigChange={setManualConfig}
                onManualNameChange={setManualName}
              />
            ) : activeTab === "win32" ? (
              <Win32WindowList
                windows={win32Windows}
                selectedWindow={selectedWin32Window}
                onSelect={setSelectedWin32Window}
                loading={isRefreshing}
              />
            ) : activeTab === "playcover" ? (
              <PlayCoverForm
                address={playCoverAddress}
                uuid={playCoverUUID}
                name={playCoverName}
                onAddressChange={setPlayCoverAddress}
                onUuidChange={setPlayCoverUUID}
                onNameChange={setPlayCoverName}
              />
            ) : activeTab === "wlroots" ? (
              <WlRootsForm
                sockets={wlrootsSockets}
                selectedSocket={selectedWlRootsSocket}
                onSelect={setSelectedWlRootsSocket}
                manualPath={wlrootsSocketPath}
                onManualPathChange={setWlrootsSocketPath}
                useWin32VkCode={wlrootsUseWin32VkCode}
                onUseWin32VkCodeChange={setWlrootsUseWin32VkCode}
                loading={isRefreshing}
              />
            ) : activeTab === "macos" ? (
              <MacOSForm
                pid={macosPid}
                screencapMethod={macosScreencap}
                inputMethod={macosInput}
                screencapMethods={MACOS_DEFAULT_METHODS.screencap}
                inputMethods={MACOS_DEFAULT_METHODS.input}
                onPidChange={setMacosPid}
                onScreencapMethodChange={setMacosScreencap}
                onInputMethodChange={setMacosInput}
              />
            ) : (
              <GamepadForm
                gamepadType={gamepadType}
                hwnd={gamepadHwnd}
                screencap={gamepadScreencap}
                onTypeChange={setGamepadType}
                onHwndChange={setGamepadHwnd}
                onScreencapChange={setGamepadScreencap}
              />
            )}
          </div>
        </div>
      </Drawer>
    );
  },
);
