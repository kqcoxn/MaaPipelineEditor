import style from "../styles/Header.module.less";

import { Button, Tag, Dropdown, Space, Tooltip, type MenuProps } from "antd";
import { DownOutlined, SunOutlined, MoonOutlined } from "@ant-design/icons";
import IconFont from "./iconfonts";

import { globalConfig, useConfigStore } from "../stores/configStore";
import classNames from "classnames";

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
    key: "mfw 4.5",
    href: "https://mpe.codax.site/mfw_4_5",
    text: "MFW v4.5",
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
  const useDarkMode = useConfigStore((state) => state.configs.useDarkMode);
  const setConfig = useConfigStore((state) => state.setConfig);

  return (
    <div className={style.container}>
      <div className={style.left}>
        <img className={style.logo} src="/MaaPipelineEditor/logo.png" />
        <div className={style.title}>
          <span className={classNames(style.title, style["full-title"])}>
            MaaPipelineEditor - 可视化 MaaFramework Pipeline 编辑器
          </span>
          <span className={classNames(style.title, style["short-title"])}>
            MaaPipelineEditor
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
          <Button
            shape="circle"
            icon={useDarkMode ? <MoonOutlined /> : <SunOutlined />}
            onClick={() => setConfig("useDarkMode", !useDarkMode)}
          />
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
              src="/MaaPipelineEditor/maafw.png"
              onClick={() => {
                window.open(
                  "https://maafw.xyz/docs/3.1-PipelineProtocol.html?source=mpe"
                );
              }}
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
  );
}

export default Header;
