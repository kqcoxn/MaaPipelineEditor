import style from "../styles/Header.module.less";

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
  ShareAltOutlined,
} from "@ant-design/icons";
import IconFont from "./iconfonts";
import UpdateLog from "./modals/UpdateLog";
import { ConnectionPanel } from "./panels/ConnectionPanel";
import { localServer } from "../services/server";
import { useMFWStore } from "../stores/mfwStore";

import { globalConfig } from "../stores/configStore";
import { useTheme } from "../contexts/ThemeContext";
import classNames from "classnames";
import { useState, useEffect } from "react";
import { generateShareLink } from "../utils/shareHelper";

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
  {
    key: "mfw_5_0",
    href: "https://mpe.codax.site/mfw_5_0/",
    text: "MFW 5.0 快照",
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
  })
);

type ConnectionStatus = "connected" | "disconnected" | "connecting";

const ConnectionButton: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");

  useEffect(() => {
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
  }, []);

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

// 设备连接按钮
const DeviceConnectionButton: React.FC<{ onOpenPanel: () => void }> = ({
  onOpenPanel,
}) => {
  const { connectionStatus, controllerType, deviceInfo } = useMFWStore();

  // 获取设备名称
  const getDeviceName = () => {
    if (!deviceInfo) return "未知设备";
    const name =
      (deviceInfo as any)?.name ||
      (deviceInfo as any)?.window_name ||
      (deviceInfo as any)?.address ||
      (deviceInfo as any)?.class_name ||
      "未知设备";
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
  const { isDark, toggleTheme } = useTheme();
  const [updateLogOpen, setUpdateLogOpen] = useState(false);
  const [connectionPanelOpen, setConnectionPanelOpen] = useState(false);
  const [isNarrowScreen, setIsNarrowScreen] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

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
      setIsNarrowScreen(window.innerWidth < 790);
    };

    checkWidth();
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, []);

  // 检测版本更新
  useEffect(() => {
    const lastVersion = localStorage.getItem("mpe_last_version");
    const currentVersion = globalConfig.version;
    if (lastVersion !== currentVersion) {
      setTimeout(() => {
        setUpdateLogOpen(true);
      }, 500);
      localStorage.setItem("mpe_last_version", currentVersion);
    }
  }, []);

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
              MaaPipelineExtremer - Editor
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
          </div>
        </div>
        <div className={style.right}>
          <Tooltip placement="bottom" title="生成分享链接">
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
          </Tooltip>
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
            <Tooltip placement="bottom" title="文档站">
              <IconFont
                className="icon-interactive"
                name="icon-icon_wendangziliaopeizhi"
                size={25}
                onClick={() => {
                  window.open("https://mpe.codax.site/docs");
                }}
              />
            </Tooltip>
            <Tooltip placement="bottom" title="Pipeline协议">
              <img
                className="icon-interactive"
                style={{ width: 29, marginLeft: 7, marginRight: 2 }}
                src={`${import.meta.env.BASE_URL}maafw.png`}
                onClick={() => {
                  window.open(
                    "https://maafw.xyz/docs/3.1-PipelineProtocol.html?source=mpe"
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
