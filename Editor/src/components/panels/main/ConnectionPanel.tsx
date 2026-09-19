import { useConnectionForm } from "./connection/useConnectionForm";
import { buildConnectionRequest, defaultConnectionForm, restoreConnectionForm } from "./connection/connectionForm";
import { sameControllerConnection } from "@/services/protocols/controllerConnection";
import { useDebugSessionStore } from "@/stores/debug/debugSessionStore";
import { useInterfaceRunStore } from "@/features/project-interface/interfaceRunStore";
import { isInterfaceRunning } from "@/features/project-interface/interfaceRunTypes";
import { memo, useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  Drawer,
  Tabs,
  Button,
  Alert,
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
} from "@/stores/connection/mfwStore";
import { mfwProtocol } from "../../../services/server";
import {
  AdbDeviceList,
  Win32WindowList,
  PlayCoverForm,
  GamepadForm,
  LinuxForm,
  MacOSForm,
  MethodConfig,
  detectPlatform,
  PLATFORM_TABS,
  MACOS_DEFAULT_METHODS,
} from "./connection";
import { WikiAnchor } from "../../wiki/WikiAnchor";

const { Text } = Typography;

interface ConnectionPanelProps {
  open: boolean;
  onClose: () => void;
}

const ConnectionPanelContent = memo(
  ({ open, onClose }: ConnectionPanelProps) => {
    const {
      connectionStatus,
      controllerId,
      deviceInfo,
      adbDevices,
      win32Windows,
      linuxCompositors: linuxSockets,
      errorMessage,
      appliedConnection,
    } = useMFWStore();
    const debugBusy = useDebugSessionStore(state =>
      ["preparing", "running", "stopping"].includes(state.session?.status || ""));
    const interfaceBusy = useInterfaceRunStore(state =>
      !!state.pending || isInterfaceRunning(state.run?.status));
    const executionBusy = debugBusy || interfaceBusy;

    // 检测当前平台
    const currentPlatform = useMemo(() => detectPlatform(), []);
    const availableTabs = useMemo(
      () => PLATFORM_TABS[currentPlatform],
      [currentPlatform],
    );

    const {
      activeTab,
      selectedAdbDevice,
      selectedWin32Window,
      selectedLinuxSocket,
      linuxSocketPath,
      manualAdbPath,
      manualAddress,
      manualConfig,
      manualName,
      playCoverAddress,
      playCoverUUID,
      playCoverName,
      gamepadType,
      gamepadHwnd,
      gamepadScreencap,
      macosScreencap,
      macosInput,
      linuxOptions,
      linuxUseWin32VkCode,
      customScreencap,
      customInput,
      customKeyboard,
      setActiveTab,
      setSelectedAdbDevice,
      setSelectedWin32Window,
      setSelectedLinuxSocket,
      setLinuxSocketPath,
      setManualAdbPath,
      setManualAddress,
      setManualConfig,
      setManualName,
      setPlayCoverAddress,
      setPlayCoverUUID,
      setPlayCoverName,
      setGamepadType,
      setGamepadHwnd,
      setGamepadScreencap,
      setMacosScreencap,
      setMacosInput,
      setLinuxOptions,
      setLinuxUseWin32VkCode,
      setCustomScreencap,
      setCustomInput,
      setCustomKeyboard,
      isAdbManualMode,
      form
    } = useConnectionForm(availableTabs, appliedConnection);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set());
    const [isApplying, setIsApplying] = useState(false);
    const applyingRef = useRef(false);
    const [applyError, setApplyError] = useState<string | null>(null);
    const handleRefresh = useCallback(() => {
      setIsRefreshing(true);
      if (activeTab === "adb") {
        mfwProtocol.refreshAdbDevices();
      } else if (activeTab === "win32") {
        mfwProtocol.refreshWin32Windows();
      } else if (activeTab === "linux") {
        mfwProtocol.refreshLinuxSockets();
      } else if (activeTab === "macos") {
        mfwProtocol.refreshWin32Windows();
      }
      setTimeout(() => setIsRefreshing(false), 1000);
    }, [activeTab]);

    // 第一次打开时自动刷新设备列表，即使当前已有控制器连接
    useEffect(() => {
      if (open && !visitedTabs.has(activeTab)) {
        setVisitedTabs((prev) => new Set(prev).add(activeTab));
        handleRefresh();
      }
    }, [activeTab, connectionStatus, handleRefresh, open, visitedTabs]);

    const request = buildConnectionRequest(form);
    const appliedRequest = appliedConnection
      ? buildConnectionRequest(restoreConnectionForm(defaultConnectionForm(appliedConnection.type), appliedConnection))
      : null;
    const hasChanges = !sameControllerConnection(request, appliedRequest);
    const canConnect = !!request && connectionStatus !== "connecting" && !isApplying && !executionBusy;

    const handleConnect = async () => {
      if (!request || !canConnect || applyingRef.current) return;
      applyingRef.current = true;
      setIsApplying(true);
      setApplyError(null);
      try {
        // 捕获本次提交的参数，等待断开期间的表单修改不会混入请求。
        if (controllerId) await mfwProtocol.disconnectControllerAndWait(controllerId);
        mfwProtocol.connectController(request);
      } catch (error) {
        setApplyError(error instanceof Error ? error.message : "连接失败");
      } finally {
        applyingRef.current = false;
        setIsApplying(false);
      }
    };

    const handleDisconnect = async () => {
      if (!controllerId || applyingRef.current || executionBusy) return;
      applyingRef.current = true;
      setIsApplying(true);
      setApplyError(null);
      try {
        await mfwProtocol.disconnectControllerAndWait(controllerId);
        mfwProtocol.forgetLastController();
      } catch (error) {
        setApplyError(error instanceof Error ? error.message : "断开失败");
      } finally {
        applyingRef.current = false;
        setIsApplying(false);
      }
    };

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
            <span style={{ marginLeft: -10, marginTop: 3 }}>
              <WikiAnchor path="20.本地服务/15.设备连接.html" title="设备连接" description="配置与管理设备连接" />
            </span>
          </div>
        }
        placement="right"
        size={420}
        open={open}
        onClose={onClose}
        rootStyle={{ overflow: "hidden" }}
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

            {connectionStatus === "connected" && (
              <Alert
                type={hasChanges ? "warning" : "info"}
                showIcon
                title={hasChanges ? "配置尚未应用" : "当前配置已生效"}
                description={executionBusy ? "任务运行或准备期间无法更换连接，请先停止任务或等待完成。" : hasChanges ? "当前设备仍使用原配置。完成修改后点击“应用并重连”。" : "修改连接参数后，需要应用并重连才会生效。"}
                style={{ marginBottom: 12 }}
              />
            )}
            {(applyError || errorMessage) && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <Alert
                  title={applyError || errorMessage}
                  type="error"
                  showIcon
                  style={{ marginBottom: 0 }}
                />
              </div>
            )}

            {/* 操作按钮组 */}
            <div style={{ display: "flex", gap: 12 }}>
              {connectionStatus === "connected" ? (
                <>
                  {hasChanges && (
                    <Button
                      type="primary"
                      icon={<SwapOutlined />}
                      onClick={handleConnect}
                      disabled={!canConnect}
                      loading={isApplying}
                      size="large"
                      style={{ flex: 1 }}
                    >
                      应用并重连
                    </Button>
                  )}
                  <Button
                    type="primary"
                    danger
                    icon={<DisconnectOutlined />}
                    onClick={handleDisconnect}
                    disabled={isApplying || executionBusy}
                    size="large"
                    style={{
                      flex: !hasChanges ? 1 : undefined,
                    }}
                    block={!hasChanges}
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
                    loading={connectionStatus === "connecting" || isApplying}
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
            selectedAdbDevice={adbDevices.find(device => device.address === selectedAdbDevice?.address && device.adb_path === selectedAdbDevice?.adb_path) || selectedAdbDevice}
            selectedWin32Window={win32Windows.find(window => window.hwnd === selectedWin32Window?.hwnd) || selectedWin32Window}
            adbDevices={adbDevices}
            win32Windows={win32Windows}
            customScreencap={customScreencap}
            customInput={customInput}
            customKeyboard={customKeyboard}
            onKeyboardChange={setCustomKeyboard}
            onScreencapChange={setCustomScreencap}
            onInputChange={setCustomInput}
            isAdbManualMode={isAdbManualMode}
          />

          {/* 设备类型选择 */}
          <div style={{ padding: "0 24px" }}>
            <Tabs
              activeKey={activeTab}
              onChange={(key) => {
                const nextTab = key as
                  | "adb"
                  | "win32"
                  | "playcover"
                  | "gamepad"
                  | "linux"
                  | "macos";
                setActiveTab(nextTab);
              }}
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
                ...(availableTabs.includes("linux")
                  ? [
                      {
                        key: "linux",
                        label: (
                          <span>
                            <DesktopOutlined style={{ marginRight: 8 }} />
                            Linux
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
            ) : activeTab === "linux" ? (
              <LinuxForm
                options={linuxOptions}
                onOptionsChange={setLinuxOptions}
                sockets={linuxSockets}
                selectedSocket={selectedLinuxSocket}
                onSelect={setSelectedLinuxSocket}
                manualPath={linuxSocketPath}
                onManualPathChange={setLinuxSocketPath}
                useWin32VkCode={linuxUseWin32VkCode}
                onUseWin32VkCodeChange={setLinuxUseWin32VkCode}
                loading={isRefreshing}
              />
            ) : activeTab === "macos" ? (
              <>
                <MacOSForm
                  screencapMethod={macosScreencap}
                  inputMethod={macosInput}
                  screencapMethods={MACOS_DEFAULT_METHODS.screencap}
                  inputMethods={MACOS_DEFAULT_METHODS.input}
                  onScreencapMethodChange={setMacosScreencap}
                  onInputMethodChange={setMacosInput}
                />
                <Win32WindowList
                  windows={win32Windows}
                  selectedWindow={selectedWin32Window}
                  onSelect={setSelectedWin32Window}
                  loading={isRefreshing}
                  platform="macos"
                />
              </>
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

/** 重新打开或连接成功时恢复实际配置，列表刷新不会覆盖正在编辑的参数。 */
export const ConnectionPanel = memo((props: ConnectionPanelProps) => {
  const controllerId = useMFWStore(state => state.controllerId);
  const lastControllerId = useRef(controllerId);
  if (controllerId) lastControllerId.current = controllerId;
  return props.open ? <ConnectionPanelContent key={lastControllerId.current || "initial"} {...props} /> : null;
});
