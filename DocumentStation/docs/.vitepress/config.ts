import { defineConfig } from "vitepress";
import { defineTeekConfig } from "vitepress-theme-teek/config";
import { version } from "vitepress-theme-teek/es/version";
import llmstxt from "vitepress-plugin-llms";

const description = [
  "欢迎来到 MaaPipelineEditor 使用文档",
  "MaaPipelineEditor (MPE) 是基于一款 Web 前端相关开发框架、运用 YAMaaPE 开发经验去芜存菁、资源开发者充分微调、完全重写的 MaaFramework Pipeline 工作流式可视化编辑器。",
  "“由您设计，由我们支持。” 如您所需皆已存在：添加、配置、连接，只需稍作思考，想法之外尽在其中！",
].join(" ");

const siteUrl = "https://mpe.codax.site";
const docsUrl = `${siteUrl}/docs/`;
const keywords = [
  "MaaPipelineEditor",
  "MPE",
  "MaaFramework",
  "Pipeline",
  "工作流编辑器",
  "可视化编辑器",
].join(",");

const teekConfig = defineTeekConfig({
  sidebarTrigger: true,
  anchorScroll: true,
  viewTransition: {
    enabled: true,
    mode: "out-in",
    duration: 400,
  },
  author: { name: "kqcoxn", link: "https://github.com/kqcoxn" },
  backTop: {
    content: "progress",
  },
  breadcrumb: {
    enabled: true,
    showCurrentName: true,
  },
  footerInfo: {
    theme: {
      name: `Theme By Teek@${version}`,
    },
    copyright: {
      createYear: 2025,
      suffix: "kqcoxn/codax",
    },
  },
  codeBlock: {
    collapseHeight: 700,
    overlay: true,
    overlayHeight: 420,
    copiedDone: (TkMessage) => TkMessage.success("复制成功！"),
  },
  themeEnhance: {
    themeColor: {
      customize: false,
      defaultColorName: "vp-primary",
      defaultSpread: true,
    },
  },
  post: {
    showCapture: true,
  },
  articleShare: {
    enabled: true,
    text: "分享此页",
    copiedText: "链接已复制",
  },
  vitePlugins: {
    sidebarOption: {
      initItems: false,
    },
  },
  markdown: {
    demo: {
      githubUrl:
        "https://github.com/kqcoxn/MaaPipelineEditor/tree/main/DocumentStation",
    },
  },
  articleAnalyze: {
    dateFormat: "yyyy-MM-dd",
    showCreateDate: false,
    showUpdateDate: true,
    imageViewer: {
      enabled: true,
      hideOnClickModal: true,
      teleported: true,
      showProgress: true,
    },
  },
  articleUpdate: {
    enabled: false,
  },
});

export default defineConfig({
  extends: teekConfig,
  base: "/docs/",
  title: "MaaPipelineEditor",
  description: description,
  cleanUrls: false,
  lastUpdated: true,
  lang: "zh-CN",
  head: [
    ["link", { rel: "icon", type: "image/png", href: "/docs/logo.png" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:locale", content: "zh-CN" }],
    ["meta", { property: "og:title", content: "MaaPipelineEditor - 文档站" }],
    ["meta", { property: "og:site_name", content: "MaaPipelineEditor" }],
    ["meta", { property: "og:image", content: `${siteUrl}/docs/logo.png` }],
    ["meta", { property: "og:url", content: docsUrl }],
    ["meta", { property: "og:description", content: description }],
    ["meta", { name: "description", content: description }],
    ["meta", { name: "author", content: "kqcoxn" }],
    ["meta", { name: "keywords", content: keywords }],
    ["meta", { name: "robots", content: "index,follow" }],
  ],
  markdown: {
    lineNumbers: true,
    image: {
      lazyLoading: true,
    },
    container: {
      tipLabel: "提示",
      warningLabel: "警告",
      dangerLabel: "危险",
      infoLabel: "信息",
      detailsLabel: "详细信息",
    },
  },
  sitemap: {
    hostname: docsUrl,
    transformItems: (items) => {
      const permalinkItemBak: typeof items = [];
      const permalinks = (globalThis as any).VITEPRESS_CONFIG.site.themeConfig
        .permalinks;
      items.forEach((item) => {
        const permalink = permalinks?.map[item.url.replace(".html", "")];
        if (permalink)
          permalinkItemBak.push({
            url: permalink.replace(/^\/+/, ""),
            lastmod: item.lastmod,
          });
      });
      return [...items, ...permalinkItemBak];
    },
  },
  themeConfig: {
    logo: "/logo.png",
    darkModeSwitchLabel: "主题",
    sidebarMenuLabel: "菜单",
    returnToTopLabel: "返回顶部",
    lastUpdatedText: "上次更新时间",
    outline: {
      level: [2, 4],
      label: "本页导航",
    },
    docFooter: {
      prev: "上一页",
      next: "下一页",
    },
    nav: [
      { text: "首页", link: "/" },
      {
        text: "指南",
        link: "/guide/start/intro",
        activeMatch: "/01.指南/",
      },
      {
        text: "资料",
        link: "/resources/reports/performance-engineering",
        activeMatch: "/02.资料/",
      },
      {
        text: "相关链接",
        items: [
          {
            text: "MaaPipelineEditor",
            link: "https://mpe.codax.site/stable",
          },
          {
            text: "Pipeline 协议",
            link: "https://maafw.xyz/docs/3.1-PipelineProtocol.html",
          },
          {
            text: "MaaFramework",
            link: "https://github.com/MaaXYZ/MaaFramework",
          },
          {
            text: "MPE 预览版",
            link: "https://kqcoxn.github.io/MaaPipelineEditor/",
          },
          {
            text: "YAMaaPE",
            link: "https://yamaape.codax.site",
          },
        ],
      },
      {
        text: "友情链接",
        items: [
          {
            text: "MaaMCP",
            link: "https://maa-ai.com/",
          },
          {
            text: "MaaLogAnalyzer",
            link: "https://maaloganalyzer.maafw.xyz/",
          },
        ],
      },
    ],
    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/kqcoxn/MaaPipelineEditor",
      },
    ],
    search: {
      provider: "local",
      options: {
        detailedView: true,
        translations: {
          button: {
            buttonText: "搜索文档",
            buttonAriaLabel: "搜索文档",
          },
          modal: {
            displayDetails: "显示详细列表",
            resetButtonTitle: "清除查询条件",
            backButtonTitle: "关闭搜索",
            noResultsText: "未找到相关结果",
            footer: {
              selectText: "选择",
              selectKeyAriaLabel: "回车",
              navigateText: "切换",
              navigateUpKeyAriaLabel: "上方向键",
              navigateDownKeyAriaLabel: "下方向键",
              closeText: "关闭",
              closeKeyAriaLabel: "Esc",
            },
          },
        },
        miniSearch: {
          options: {
            tokenize: (text) =>
              Array.from(
                new Intl.Segmenter("zh-CN", { granularity: "word" }).segment(
                  text,
                ),
              )
                .filter(({ isWordLike }) => isWordLike)
                .map(({ segment }) => segment),
          },
        },
      },
    },
    editLink: {
      text: "在 GitHub 上编辑此页",
      pattern:
        "https://github.com/kqcoxn/MaaPipelineEditor/edit/main/DocumentStation/docs/:path",
    },
  },
  vite: {
    plugins: [llmstxt({ domain: siteUrl }) as any],
  },
});
