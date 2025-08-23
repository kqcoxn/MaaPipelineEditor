import { defineConfig } from "vitepress";
import { defineTeekConfig } from "vitepress-theme-teek/config";
import { version } from "vitepress-theme-teek/es/version";
import llmstxt from "vitepress-plugin-llms";

const description = [
  "欢迎来到 MaaPipelineEditor 使用文档",
  "MaaPipelineEditor (MPE) 是基于一款 Web 前端相关开发框架、运用 YAMaaPE 开发经验去芜存菁、资源开发者充分微调、完全重写的 MaaFramework Pipeline 工作流式可视化编辑器。",
  "“由您设计，由我们支持。” 如您所需皆已存在：添加、配置、连接，只需稍作思考，想法之外尽在其中！",
].toString();

const teekConfig = defineTeekConfig({
  sidebarTrigger: true,
  author: { name: "kqcoxn", link: "https://github.com/kqcoxn" },
  backTop: {
    content: "icon",
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
    copiedDone: (TkMessage) => TkMessage.success("复制成功！"),
  },
  themeEnhance: {
    themeColor: {
      customize: {
        elementPlusTheme: false,
      },
    },
  },
  post: {
    showCapture: true,
  },
  articleShare: { enabled: true },
  vitePlugins: {
    sidebarOption: {
      initItems: false,
    },
  },
  markdown: {
    demo: {
      githubUrl: "https://github.com/kqcoxn/MaaPipelineEditor/docs",
    },
  },
  articleUpdate: {
    enabled: false,
  },
});

export default defineConfig({
  extends: teekConfig,
  base: "/docs/",
  title: "MaaPipelineEditor - 文档站",
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
    ["meta", { property: "og:image", content: "" }],
    ["meta", { property: "og:url", content: "" }],
    ["meta", { property: "og:description", description }],
    ["meta", { name: "description", description }],
    ["meta", { name: "author", content: "kqcoxn" }],
    // [
    //   "meta",
    //   {
    //     name: "viewport",
    //     content: "width=device-width,initial-scale=1,minimum-scale=1.0,maximum-scale=1.0,user-scalable=no",
    //   },
    // ],
    ["meta", { name: "keywords", description }],
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
    hostname: "https://yamaape.codax.site",
    transformItems: (items) => {
      const permalinkItemBak: typeof items = [];
      const permalinks = (globalThis as any).VITEPRESS_CONFIG.site.themeConfig
        .permalinks;
      items.forEach((item) => {
        const permalink = permalinks?.map[item.url];
        if (permalink)
          permalinkItemBak.push({ url: permalink, lastmod: item.lastmod });
      });
      return [...items, ...permalinkItemBak];
    },
  },
  themeConfig: {
    logo: "/docs/logo.png",
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
        link: "/guide/intro",
        activeMatch: "/01.指南/",
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
    },
    editLink: {
      text: "在 GitHub 上编辑此页",
      pattern: "https://github.com/kqcoxn/MaaPipelineEditor/docs/:path",
    },
  },
  vite: {
    plugins: [llmstxt() as any],
  },
});
