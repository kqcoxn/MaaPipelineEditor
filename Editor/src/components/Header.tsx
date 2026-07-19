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
import { useMFWStore, type DeviceInfo } from "../stores/mfwStore";

import { globalConfig } from "../stores/configStore";
import { WikiAnchor } from "./wiki/WikiAnchor";
import classNames from "classnames";
import { useState, useEffect } from "react";
import { checkUpdateFromFrontend, type UpdateInfo } from "../utils/updateCheck";
import { useEmbedMode } from "../hooks/useEmbedMode";

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
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");

  useEffect(() => {
    if (isEmbed) return;

    // 初始化状态
    const updateStatus = () => {
      if (localServer.isConnected()) {
        setStatus("connected");
      } else if (localServer.getIsConnecting()) {
        setStatus("connecting");
      } else {
        setStatus("disconnected");
      }
    };

    updateStatus();

    // 注册状态变化回调
    localServer.onStatus((connected) => {
      setStatus(connected ? "connected" : "disconnected");
    });

    localServer.onConnecting((isConnecting) => {
      if (isConnecting) {
        setStatus("connecting");
      }
    });

    // 定期检查状态
    const interval = setInterval(() => {
      updateStatus();
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [isEmbed]);

  // 嵌入模式下显示 EmbedBridge，不可点击断开
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
            cursor: "default",
          }}
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
  const { connectionStatus, controllerType, deviceInfo } = useMFWStore();

  // 获取设备名称
  const getDeviceName = () => {
    if (!deviceInfo) return "未知设备";
    const name = getDeviceDisplayName(deviceInfo);
    return name.length > 15 ? name.substring(0, 15) + "..." : name;
  };

  const isConnected = connectionStatus === "connected";

  if (isConnected) {
    return (
      <Tooltip placement="bottom" title="点击管理设备连接">
        <Button
          type="primary"
          size="small"
          icon={
            controllerType === "adb" ? <MobileOutlined /> : <DesktopOutlined />
          }
          onClick={onOpenPanel}
          className={style.deviceButton}
          style={{
            borderRadius: "999px",
            paddingLeft: "12px",
            paddingRight: "12px",
            maxWidth: "140px",
          }}
        >
          {getDeviceName()}
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
  const { isEmbed } = useEmbedMode();
  const [updateLogOpen, setUpdateLogOpen] = useState(false);
  const [connectionPanelOpen, setConnectionPanelOpen] = useState(false);
  const [isNarrowScreen, setIsNarrowScreen] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  // 检测WebSocket连接状态
  useEffect(() => {
    const updateWsStatus = () => {
      setWsConnected(localServer.isConnected());
    };

    updateWsStatus();

    // 注册状态变化回调
    localServer.onStatus((connected) => {
      setWsConnected(connected);
    });

    // 定期检查状态
    const interval = setInterval(() => {
      updateWsStatus();
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

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
    const handler = () => setUpdateLogOpen(true);
    window.addEventListener("mpe:newcomer-passed", handler);
    return () => window.removeEventListener("mpe:newcomer-passed", handler);
  }, []);

  // 检查新版本
  useEffect(() => {
    if (globalConfig.dev) return;
    checkUpdateFromFrontend(globalConfig.version).then((info) => {
      if (info && info.hasUpdate) {
        setUpdateInfo(info);
      }
    });
  }, []);

  return (
    <>
      {isNarrowScreen && (
        <Alert
          className={style.narrowWarning}
          title="页面宽度过窄"
          description="当前页面宽度过小，可能影响使用体验，建议使用更大的屏幕或调整浏览器窗口大小。"
          type="warning"
          closable
          banner
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
              onOpenPanel={() => setConnectionPanelOpen(true)}
            />
          )}
          <div className={style.versionInfo}>
            <Dropdown menu={{ items: otherVersions }} placement="bottom">
              <a>
                <Space>
                  {`v${globalConfig.version}`}
                  <DownOutlined />
                </Space>
              </a>
            </Dropdown>
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
                    window.open(
                      "https://github.com/kqcoxn/MaaPipelineEditor/releases/latest",
                      "_blank",
                    );
                  }}
                >
                  新版本可用
                </Tag>
              </Tooltip>
            )}
          </div>
          <div className={style.links}>
            <Tooltip placement="bottom" title="Pipeline协议">
              <img
                className="icon-interactive"
                style={{ width: 29, marginLeft: 7, marginRight: 2 }}
                src={`${import.meta.env.BASE_URL}maafw.png`}
                onClick={() => {
                  window.open(
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
                  window.open("https://github.com/kqcoxn/MaaPipelineEditor");
                }}
              />
            </Tooltip>
          </div>
        </div>
      </div>
      <UpdateLog open={updateLogOpen} onClose={() => setUpdateLogOpen(false)} />
      <ConnectionPanel
        open={connectionPanelOpen}
        onClose={() => setConnectionPanelOpen(false)}
      />
    </>
  );
}

export default Header;
