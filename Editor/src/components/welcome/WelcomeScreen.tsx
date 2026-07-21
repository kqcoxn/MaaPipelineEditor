import {
  ArrowRightOutlined,
  BookOutlined,
  GithubOutlined,
  ReadOutlined,
} from "@ant-design/icons";

import style from "./WelcomeScreen.module.less";

const documentLinks = [
  {
    href: "https://mpe.codax.site/docs/guide/start/quick-start.html",
    title: "MPE 快速上手",
    description: "从 Pipeline 导入到可视化编辑",
    icon: <ReadOutlined />,
  },
  {
    href: "https://maafw.com/docs/1.1-QuickStarted",
    title: "MaaFramework 文档",
    description: "框架概念、集成与开发指南",
    icon: <BookOutlined />,
  },
  {
    href: "https://maafw.com/docs/3.1-PipelineProtocol.html",
    title: "Pipeline 协议",
    description: "节点结构、识别与动作字段",
    icon: <ReadOutlined />,
  },
  {
    href: "https://github.com/kqcoxn/MaaPipelineEditor",
    title: "GitHub 仓库",
    description: "源码、版本发布与问题反馈",
    icon: <GithubOutlined />,
  },
] as const;

export function WelcomeScreen() {
  return (
    <main className={style.root} aria-labelledby="mpe-welcome-title">
      <div className={style.layout}>
        <section className={style.identity}>
          <img
            className={style.logo}
            src={`${import.meta.env.BASE_URL}logo.png`}
            alt="MaaPipelineEditor"
          />
          <h1 id="mpe-welcome-title">MaaPipelineEditor</h1>
          <p className={style.subtitle}>MaaFramework 项目工作台</p>
        </section>

        <section className={style.resources} aria-labelledby="welcome-resources-title">
          <div className={style.sectionHeading}>
            <h2 id="welcome-resources-title">文档与资源</h2>
          </div>
          <div className={style.linkList}>
            {documentLinks.map((item) => (
              <a
                key={item.href}
                className={style.resourceLink}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className={style.resourceIcon} aria-hidden="true">
                  {item.icon}
                </span>
                <span className={style.resourceCopy}>
                  <strong>{item.title}</strong>
                  <span>{item.description}</span>
                </span>
                <ArrowRightOutlined
                  className={style.resourceArrow}
                  aria-hidden="true"
                />
              </a>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
