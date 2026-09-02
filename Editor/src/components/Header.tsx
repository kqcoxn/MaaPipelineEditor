import style from "../styles/layout/Header.module.less";

import {
  Button,
  Tag,
  Dropdown,
  Space,
  Tooltip,
  Alert,
  type MenuProps,
} from "antd";
import {
  DownOutlined,
  SunOutlined,
  MoonOutlined,
  LinkOutlined,
  DisconnectOutlined,
  LoadingOutlined,
  MobileOutlined,
  DesktopOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import IconFont from "./iconfonts";
import UpdateLog from "./modals/UpdateLog";
import { ConnectionPanel } from "./panels/main/ConnectionPanel";
import { localServer } from "../services/server";
import { useMFWStore, type DeviceInfo } from "@/stores/connection/mfwStore";
import { useWSStore } from "@/stores/connection/wsStore";

import { globalConfig } from "@/stores/app/configStore";
import { useTheme } from "../contexts/ThemeContext";
import { WikiAnchor } from "./wiki/WikiAnchor";
import classNames from "classnames";
import { useState, useEffect } from "react";
import {
  checkUpdateFromFrontend,
  type UpdateInfo,
} from "../utils/updateChecker";
import { useEmbedMode } from "../hooks/useEmbedMode";
import { showEmbedServiceNotice } from "../features/embed/components/serviceNotice";
import { openExternalUrl } from "../features/embed/navigation/externalNavigation";
import { usePanelOccupancy } from "../hooks/usePanelOccupancy";

const versionLinks = [
  {
    key: "stable",
    href: "https://mpe.codax.site/stable",
    text: "稳定版",
  },
  {
    key: "preview",
    href: "https://kqcoxn.github.io/MaaPipelineEditor/",
    text: "预览版",
  },
  { key: "yamaape", href: "https://yamaape.codax.site", text: "YAMaaPE" },
];

const otherVersions: MenuProps["items"] = versionLinks.map(
  ({ key, href, text }) => ({
    key,
    label: (
      <a target="_self" rel="noopener noreferrer" href={href}>
        {text}
      </a>
    ),
  }),
);

type ConnectionStatus = "connected" | "disconnected" | "connecting";

const ConnectionButton: React.FC = () => {
  const { isEmbed } = useEmbedMode();
  const connected = useWSStore((state) => state.connected);
  const connecting = useWSStore((state) => state.connecting);
  const status: ConnectionStatus = connected
    ? "connected"
    : connecting
      ? "connecting"
      : "disconnected";

  // 嵌入模式下显示 EmbedBridge，并说明本地服务能力边界
  if (isEmbed) {
    return (
      <Tooltip title="EmbedBridge 嵌入模式">
        <Button
          type="primary"
          icon={<LinkOutlined />}
          size="small"
          style={{
            borderRadius: "999px",
            paddingLeft: "12px",
            paddingRight: "12px",
            cursor: "pointer",
          }}
          onClick={() => showEmbedServiceNotice("LocalBridge")}
        >
          EmbedBridge
        </Button>
      </Tooltip>
    );
  }

  const handleClick = () => {
    if (status === "connected") {
      localServer.disconnect();
    } else if (status === "disconnected") {
      localServer.connect();
    }
  };

  const getButtonConfig = () => {
    switch (status) {
      case "connected":
        return {
          icon: <LinkOutlined />,
          text: "MPE LocalBridge",
          type: "primary" as const,
          tooltip: "点击断开本地服务连接",
        };
      case "connecting":
        return {
          icon: <LoadingOutlined />,
          text: "连接服务中...",
          type: "default" as const,
          tooltip: "正在连接本地服务",
        };
      case "disconnected":
        return {
          icon: <DisconnectOutlined />,
          text: "未连接本地服务",
          type: "default" as const,
          tooltip: "点击连接本地服务",
        };
    }
  };

  const config = getButtonConfig();

  return (
    <Tooltip title={config.tooltip}>
      <Button
        type={config.type}
        icon={config.icon}
        onClick={handleClick}
        disabled={status === "connecting"}
        size="small"
        style={{
          borderRadius: "999px",
          paddingLeft: "12px",
          paddingRight: "12px",
        }}
      >
        {config.text}
      </Button>
    </Tooltip>
  );
};

function getDeviceDisplayName(deviceInfo: NonNullable<DeviceInfo>) {
  if ("name" in deviceInfo && deviceInfo.name) {
    return deviceInfo.name;
  }
  if ("window_name" in deviceInfo && deviceInfo.window_name) {
    return deviceInfo.window_name;
  }
  if ("address" in deviceInfo && deviceInfo.address) {
    return deviceInfo.address;
  }
  if ("class_name" in deviceInfo && deviceInfo.class_name) {
    return deviceInfo.class_name;
  }
  return "未知设备";
}

// 设备连接按钮
const DeviceConnectionButton: React.FC<{ onOpenPanel: () => void }> = ({
  onOpenPanel,
}) => {
  const connectionStatus = useMFWStore((state) => state.connectionStatus);
  const controllerType = useMFWStore((state) => state.controllerType);
  const deviceInfo = useMFWStore((state) => state.deviceInfo);

  // 获取设备名称
  const getDeviceName = () => {
    if (!deviceInfo) return "未知设备";
    const name = getDeviceDisplayName(deviceInfo);
    return name.length > 15 ? name.substring(0, 15) + "..." : name;
  };

  const isConnected = connectionStatus === "connected";
  const isConnecting = connectionStatus === "connecting";

  if (isConnected || isConnecting) {
    return (
      <Tooltip
        placement="bottom"
        title={isConnecting ? "正在连接设备" : "点击管理设备连接"}
      >
        <Button
          type={isConnecting ? "default" : "primary"}
          size="small"
          icon={
            isConnecting ? (
              <LoadingOutlined />
            ) : controllerType === "adb" ? (
              <MobileOutlined />
            ) : (
              <DesktopOutlined />
            )
          }
          onClick={isConnecting ? undefined : onOpenPanel}
          disabled={isConnecting}
          className={style.deviceButton}
          style={{
            borderRadius: "999px",
            paddingLeft: "12px",
            paddingRight: "12px",
            maxWidth: "140px",
          }}
        >
          {isConnecting ? "连接设备中..." : getDeviceName()}
        </Button>
      </Tooltip>
    );
  }

  return (
    <Tooltip placement="bottom" title="设备连接配置">
      <Button
        type="default"
        size="small"
        icon={<LinkOutlined />}
        onClick={onOpenPanel}
        className={style.deviceButton}
        style={{
          borderRadius: "999px",
          paddingLeft: "12px",
          paddingRight: "12px",
          maxWidth: "140px",
        }}
      >
        连接设备
      </Button>
    </Tooltip>
  );
};

function Header() {
  const { isDark, toggleTheme } = useTheme();
  const { isEmbed } = useEmbedMode();
  const [updateLogOpen, setUpdateLogOpen] = useState(false);
  const [lastOpenedVersion, setLastOpenedVersion] = useState<string | null>(
    null,
  );
  const {
    isActive: connectionPanelOpen,
    activate: openConnectionPanel,
    deactivate: closeConnectionPanel,
  } = usePanelOccupancy("connection");
  const [isNarrowScreen, setIsNarrowScreen] = useState(false);
  const wsConnected = useWSStore((state) => state.connected);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  // 检测页面宽度
  useEffect(() => {
    const checkWidth = () => {
      setIsNarrowScreen(window.innerWidth < 950);
    };

    checkWidth();
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, []);

  // 检测版本更新
  useEffect(() => {
    if (localStorage.getItem("mpe_newcomer_passed") !== "true") return;

    const lastVersion = localStorage.getItem("mpe_last_version");
    const currentVersion = globalConfig.version;
    if (lastVersion === currentVersion) return;

    setLastOpenedVersion(lastVersion);
    let openTimer: number | null = null;
    if (!isEmbed) {
      openTimer = window.setTimeout(() => {
        setUpdateLogOpen(true);
      }, 500);
    }
    localStorage.setItem("mpe_last_version", currentVersion);

    return () => {
      if (openTimer !== null) {
        window.clearTimeout(openTimer);
      }
    };
  }, [isEmbed]);

  // 答题通过后弹出更新日志
  useEffect(() => {
    if (isEmbed) return;
    const handler = () => setUpdateLogOpen(true);
    window.addEventListener("mpe:newcomer-passed", handler);
    return () => window.removeEventListener("mpe:newcomer-passed", handler);
  }, [isEmbed]);

  // 检查新版本
  useEffect(() => {
    if (globalConfig.dev || isEmbed) return;
    checkUpdateFromFrontend(globalConfig.version).then((info) => {
      if (info && info.hasUpdate) {
        setUpdateInfo(info);
      }
    });
  }, [isEmbed]);

  return (
    <>
      {isNarrowScreen && (
        <Alert
          title="页面宽度过窄"
          description="当前页面宽度过小，可能影响使用体验，建议使用更大的屏幕或调整浏览器窗口大小。"
          type="warning"
          closable
          banner
          style={{ marginBottom: 0 }}
        />
      )}
      <div className={style.container}>
        <div className={style.left}>
          <img
            className={style.logo}
            src={`${import.meta.env.BASE_URL}logo.png`}
          />
          <div className={style.title}>
            <span className={classNames(style.title, style["full-title"])}>
              MaaPipelineEditor
            </span>
            <span className={classNames(style.title, style["medium-title"])}>
              MaaPipelineEditor
            </span>
            <span className={classNames(style.title, style["short-title"])}>
              MPE
            </span>
          </div>
          <div className={style.version}>
            {globalConfig.dev ? (
              <Tag variant="filled" color="magenta">
                Preview Version
              </Tag>
            ) : (
              <Tag variant="filled" color="green">
                Stable Version
              </Tag>
            )}
            <Tag variant="filled" color="purple">
              MFW v{globalConfig.mfwVersion}
            </Tag>
            <WikiAnchor path="10.工作流面板/50.文件与视口.html" title="文件与视口" description="文件管理与视口操作" />
          </div>
        </div>
        <div className={style.right}>
          {/* <Tooltip placement="bottom" title="生成分享链接">
            <Button
              type="default"
              size="small"
              icon={<ShareAltOutlined />}
              onClick={generateShareLink}
              style={{
                borderRadius: "999px",
                paddingLeft: "12px",
                paddingRight: "12px",
              }}
            >
              分享
            </Button>
          </Tooltip> */}
          <ConnectionButton />
          {wsConnected && (
            <DeviceConnectionButton
              onOpenPanel={openConnectionPanel}
            />
          )}
          <div className={style.versionInfo}>
            {isEmbed ? (
              <span>{`v${globalConfig.version}`}</span>
            ) : (
              <Dropdown menu={{ items: otherVersions }} placement="bottom">
                <a>
                  <Space>
                    {`v${globalConfig.version}`}
                    <DownOutlined />
                  </Space>
                </a>
              </Dropdown>
            )}
            {updateInfo && (
              <Tooltip
                title={
                  <span>
                    发现新版本：{updateInfo.latestVersion}，点击前往下载
                    <br />
                    在线使用时可按 Ctrl+R 快捷刷新页面缓存以更新
                  </span>
                }
              >
                <Tag
                  color="processing"
                  style={{ marginLeft: 8, cursor: "pointer" }}
                  icon={<DownloadOutlined />}
                  onClick={() => {
                    openExternalUrl(
                      "https://github.com/kqcoxn/MaaPipelineEditor/releases/latest",
                    );
                  }}
                >
                  新版本可用
                </Tag>
              </Tooltip>
            )}
          </div>
          <div className={style.theme}>
            <Tooltip
              placement="bottom"
              title={isDark ? "切换到亮色模式" : "切换到暗色模式"}
            >
              <Button
                type="text"
                shape="circle"
                icon={isDark ? <MoonOutlined /> : <SunOutlined />}
                onClick={toggleTheme}
                className={style.themeButton}
                aria-label={isDark ? "切换到亮色模式" : "切换到暗色模式"}
              />
            </Tooltip>
          </div>
          <div className={style.links}>
            <Tooltip placement="bottom" title="Pipeline协议">
              <img
                className="icon-interactive"
                style={{ width: 29, marginLeft: 7, marginRight: 2 }}
                src={`${import.meta.env.BASE_URL}maafw.png`}
                onClick={() => {
                  openExternalUrl(
                    "https://maafw.xyz/docs/3.1-PipelineProtocol.html?source=mpe",
                  );
                }}
              />
            </Tooltip>
            <Tooltip placement="bottom" title="更新日志">
              <IconFont
                className="icon-interactive"
                name="icon-gengxinrizhi"
                size={32}
                onClick={() => setUpdateLogOpen(true)}
              />
            </Tooltip>
            <Tooltip placement="bottom" title="Github">
              <IconFont
                className="icon-interactive"
                name="icon-githublogo"
                size={32}
                onClick={() => {
                  openExternalUrl(
                    "https://github.com/kqcoxn/MaaPipelineEditor",
                  );
                }}
              />
            </Tooltip>
          </div>
        </div>
      </div>
      <UpdateLog
        open={updateLogOpen}
        currentVersion={globalConfig.version}
        lastOpenedVersion={lastOpenedVersion}
        onClose={() => setUpdateLogOpen(false)}
      />
      <ConnectionPanel
        open={connectionPanelOpen}
        onClose={closeConnectionPanel}
      />
    </>
  );
}

export default Header;
