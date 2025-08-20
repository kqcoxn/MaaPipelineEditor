import style from "../styles/Header.module.less";

import { Tag } from "antd";
import IconFont from "./iconfonts";

import { globalConfig } from "../stores/configStore";

function Header() {
  return (
    <div className={style.container}>
      <div className={style.left}>
        <img className={style.logo} src="/MaaPipelineEditor/logo.png" />
        <div className={style.title}>
          MaaPipelineEditor - 可视化 MaaFramework Pipeline 编辑器
        </div>
        <div className={style.version}>
          <Tag bordered={false} color="processing">
            {globalConfig.version}
          </Tag>
          {globalConfig.dev ? (
            <Tag bordered={false} color="magenta">
              Preview Version
            </Tag>
          ) : null}
        </div>
      </div>
      <div className={style.links}>
        <IconFont
          className="icon-interactive"
          name="icon-icon_wendangziliaopeizhi"
          size={26}
        />
        <IconFont
          className="icon-interactive"
          name="icon-githublogo"
          size={32}
        />
      </div>
    </div>
  );
}

export default Header;
