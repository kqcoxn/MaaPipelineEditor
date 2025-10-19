import style from "../styles/Header.module.less";

import { useMemo } from "react";
import { Button, Tag, Dropdown, Space, Tooltip, type MenuProps } from "antd";
import { DownOutlined, SunOutlined, MoonOutlined } from "@ant-design/icons";
import IconFont from "./iconfonts";

import { globalConfig, useConfigStore } from "../stores/configStore";

function Header() {
  const useDarkMode = useConfigStore((state) => state.configs.useDarkMode);
  const setConfig = useConfigStore((state) => state.setConfig);
  const otherVersions = useMemo<MenuProps["items"]>(() => {
    return [
      {
        key: "switch",
        label: (
          <a
            target="_self"
            rel="noopener noreferrer"
            href={
              globalConfig.dev
                ? "https://yamaape.codax.site/MaaPipelineEditor"
                : "https://kqcoxn.github.io/MaaPipelineEditor/"
            }
          >
            {globalConfig.dev ? "稳定版" : "预览版"}
          </a>
        ),
      },
      {
        key: "yamaape",
        label: (
          <a
            target="_self"
            rel="noopener noreferrer"
            href="https://yamaape.codax.site"
          >
            YAMaaPE
          </a>
        ),
      },
    ];
  }, [globalConfig.dev]);

  return (
    <div className={style.container}>
      <div className={style.left}>
        <img className={style.logo} src="/MaaPipelineEditor/logo.png" />
        <div className={style.title}>
          MaaPipelineEditor - 可视化 MaaFramework Pipeline 编辑器
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
                {globalConfig.version}
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
                window.open("https://yamaape.codax.site/docs");
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
