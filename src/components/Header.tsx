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
import { DownOutlined, SunOutlined, MoonOutlined } from "@ant-design/icons";
import IconFont from "./iconfonts";
import UpdateLog from "./modals/UpdateLog";

import { globalConfig } from "../stores/configStore";
import { useTheme } from "../contexts/ThemeContext";
import classNames from "classnames";
import { useState, useEffect } from "react";

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

function Header() {
  const { isDark, toggleTheme } = useTheme();
  const [updateLogOpen, setUpdateLogOpen] = useState(false);
  const [isNarrowScreen, setIsNarrowScreen] = useState(false);

  // 检测页面宽度
  useEffect(() => {
    const checkWidth = () => {
      setIsNarrowScreen(window.innerWidth < 580);
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
          message="页面宽度过窄"
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
              MaaPipelineEditor - 可视化 MaaFramework Pipeline 编辑器
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
              <Tag bordered={false} color="magenta">
                Preview Version
              </Tag>
            ) : (
              <Tag bordered={false} color="green">
                Stable Version
              </Tag>
            )}
            <Tag bordered={false} color="purple">
              MFW v{globalConfig.mfwVersion}
            </Tag>
          </div>
        </div>
        <div className={style.right}>
          <div className={style.version}>
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
    </>
  );
}

export default Header;
