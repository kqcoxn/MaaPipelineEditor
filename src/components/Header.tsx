import style from "../styles/Header.module.less";

import IconFont from "./iconfonts";

function Header() {
  return (
    <div className={style.container}>
      <div className={style.left}>
        <IconFont name="icon-dixiaguanxianguanli" color={"#1296db"} size={28} />
        <div className={style.title}>
          MaaPipelineEditor - 可视化 MaaFramework Pipeline 编辑器
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
