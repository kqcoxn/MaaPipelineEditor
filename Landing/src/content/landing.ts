import { siteConfig } from "@/lib/site-config";

export type ActionLink = {
  label: string;
  href: string;
  description?: string;
  external?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "text";
};

export type NavItem = {
  label: string;
  href: string;
};

export type FeatureItem = {
  id: string;
  label: string;
  title: string;
  description: string;
  tags: string[];
  tone: "blue" | "mint" | "orange" | "rose";
  demoImages?: string[];
  demoLabel?: string;
  demoTitle?: string;
  demoDescription?: string;
  demoSteps?: string[];
  metrics: string[];
};

export type ShowcaseItem = {
  title: string;
  summary: string;
  tags: string[];
  accent: "blue" | "mint" | "orange" | "rose";
  detail: string;
  href: string;
  ctaLabel: string;
};

export type StatItem =
  | {
      kind: "metric";
      value: string;
      label: string;
      note: string;
      accent: "blue" | "mint" | "orange" | "rose";
    }
  | {
      kind: "ecosystem";
      value: string;
      label: string;
      note: string;
      href: string;
      accent: "blue" | "mint" | "orange" | "rose";
    };

export type FooterColumn = {
  title: string;
  links: ActionLink[];
};

export const siteMeta = {
  title: "MaaPipelineEditor",
  description:
    "MaaPipelineEditor 是面向 MaaFramework 资源开发者的可视化 Pipeline 审阅与编辑工作台，让 JSON 流程更容易阅读、修改与调试。",
  keywords: [
    "MaaPipelineEditor",
    "MaaFramework Pipeline",
    "可视化编辑器",
    "流程工作台",
    "Pipeline 审阅",
  ],
  ogImage: siteConfig.resolveLandingPath("/og/landing-og.svg"),
  ogAlt: "MaaPipelineEditor Landing placeholder artwork",
};

export const navItems: NavItem[] = [
  { label: "能力", href: "#features" },
  // { label: "场景", href: "#showcase" },
  { label: "生态", href: "#ecosystem" },
  { label: "文档", href: siteConfig.docsUrl },
];

export const heroContent = {
  eyebrow: "可视化构建 MaaFramework Pipeline 的下一代工作流编辑器",
  title: "MaaPipelineEditor",
  description:
    "告别手调千行 JSON！用拖拽+配置的方式，高效构建、调试、分享您的 MFW 自动化流程",
  highlightItems: ["可视化审阅与编辑", "本地能力按需接入", "AI 辅助 MCP 联动"],
  primaryAction: {
    label: "在线使用",
    href: siteConfig.editorUrl,
    description: "直接打开稳定版编辑器",
    variant: "primary",
  } satisfies ActionLink,
  secondaryAction: {
    label: "查看文档",
    href: siteConfig.docsUrl,
    description: "先读核心概念和快速上手",
    variant: "secondary",
  } satisfies ActionLink,
  tertiaryAction: {
    label: "查看 GitHub",
    href: siteConfig.githubUrl,
    description: "了解仓库、Issue 与更新记录",
    external: true,
    variant: "ghost",
  } satisfies ActionLink,
};

export const featureItems: FeatureItem[] = [
  {
    id: "review",
    label: "清晰审阅",
    title: "所见即所思，流程即逻辑",
    description:
      "配合粘贴板导入、自动布局、协议兼容、节点聚焦、关键路径、AI 搜索等功能，您可以快速了解自己或其他项目的某个功能是如何实现的，打开网页粘贴即用，无需下载或面对成堆 JSON",
    tags: ["粘贴板导入", "自动布局", "节点聚焦", "关键路径", "AI 搜索"],
    tone: "blue",
    demoImages: [siteConfig.resolveLandingPath("/screens/review.png")],
    metrics: [
      "梳理任务流程",
      "快速理解其他项目思路",
      "提升 AI 生成后 Review 效率",
    ],
  },
  {
    id: "edit",
    label: "高效编辑",
    title: "拖拽构建，字段即配即得",
    description:
      "将原本需要手写数百行 JSON 的配置工作转化为直观的图形化操作，通过节点拖拽、字段补全与模板填充，快速搭建完整 Pipeline，即使复杂也能维持清晰的逻辑，兼具易用性与可读性",
    tags: ["节点拖拽", "字段补全", "模板填充", "v1/v2 兼容"],
    tone: "orange",
    demoImages: [siteConfig.resolveLandingPath("/screens/edit.png")],
    metrics: ["从零搭建新流程", "修改已有节点配置"],
  },
  {
    id: "tools",
    label: "全面辅助",
    title: "全面辅助，模板自由",
    description:
      "内置常用节点模板快速填充，支持流程级调试定位问题，自动识别并迁移废弃字段，让配置维护不再是负担",
    tags: ["节点模板", "流程调试", "废弃字段迁移", "自动保存"],
    tone: "mint",
    demoImages: [siteConfig.resolveLandingPath("/screens/tools-1.png")],
    metrics: ["快速初始化标准节点", "调试定位执行问题", "平滑升级旧配置"],
  },
  {
    id: "lb",
    label: "本地增强",
    title: "一键启用本地截图、文件与 OCR 能力",
    description:
      "通过 LocalBridge 按需接入本地能力，无需繁琐配置即可实现截图预览、文件管理、本地资源同步，让在线编辑与本地工作流无缝衔接",
    tags: ["LocalBridge", "本地截图", "文件管理", "资源同步"],
    tone: "orange",
    demoImages: [siteConfig.resolveLandingPath("/screens/lb.png")],
    metrics: ["本地文件直接管理", "快速截图、ROI 测绘", "资源变更实时同步"],
  },
  {
    id: "ai",
    label: "AI 辅助",
    title: "智能搜索与上下文感知补全",
    description:
      "基于当前节点上下文提供精准的字段补全建议，智能搜索快速定位目标节点，MCP 联动实现跨工具流程打开",
    tags: ["智能搜索", "上下文补全", "MCP 联动", "节点定位"],
    tone: "rose",
    demoLabel: "AI 能力预览",
    demoTitle: "智能补全与搜索",
    demoDescription: "输入时自动提示可用字段，支持模糊搜索快速定位节点",
    demoSteps: [
      "在节点编辑器中输入字段名称",
      "根据上下文获得精准补全建议",
      "使用搜索框快速定位目标节点",
      "通过 MCP 联动外部工具",
    ],
    metrics: [
      "快速定位复杂流程节点",
      "减少字段记忆成本",
      "RLHF-Mode Coming Soon!",
    ],
  },
];

export const showcaseItems: ShowcaseItem[] = [
  {
    title: "编辑复杂 Pipeline",
    summary:
      "从主路径到字段细节的分层编辑，让大体量流程保持清晰可读，不再淹没在千行 JSON 中。",
    tags: ["节点拖拽", "字段补全", "自动布局"],
    accent: "blue",
    detail:
      "支持关键路径高亮、节点聚焦与智能搜索，复杂流程也能快速定位与修改。",
    href: siteConfig.editorUrl,
    ctaLabel: "打开编辑器",
  },
  {
    title: "快速审阅其他项目逻辑",
    summary:
      "粘贴即审阅，无需配置环境即可理解任意 MaaFramework 项目的流程结构与跳转关系。",
    tags: ["粘贴板导入", "跨项目审阅", "零安装"],
    accent: "mint",
    detail: "适合贡献者快速上手新项目，或维护者向他人讲解实现思路。",
    href: siteConfig.docsUrl,
    ctaLabel: "查看文档",
  },
];

export const statsItems: StatItem[] = [
  {
    kind: "metric",
    value: "0 安装",
    label: "打开网页即可使用",
    note: "零门槛上手，极致轻量跨平台。",
    accent: "blue",
  },
  {
    kind: "metric",
    value: "1 行命令",
    label: "按需启用本地服务",
    note: "渐进式增强，让在线编辑器无缝衔接本地文件与截图能力。",
    accent: "mint",
  },
  {
    kind: "metric",
    value: "开源免费",
    label: "MIT 协议无限制使用",
    note: "社区驱动，代码透明，可自由二次开发与集成。",
    accent: "orange",
  },
  {
    kind: "metric",
    value: "2025 起",
    label: "持续演进的项目承诺",
    note: "专注服务 MaaFramework 资源开发场景，稳定迭代。",
    accent: "rose",
  },
  {
    kind: "ecosystem",
    value: "Editor",
    label: "在线编辑器",
    note: "零安装的可视化 Pipeline 审阅与编辑工作台，打开即用。",
    href: siteConfig.editorUrl,
    accent: "blue",
  },
  {
    kind: "ecosystem",
    value: "LocalBridge",
    label: "本地能力增强",
    note: "一键启用本地截图、文件管理、OCR 与资源同步能力。",
    href: siteConfig.docsUrl,
    accent: "mint",
  },
  {
    kind: "ecosystem",
    value: "Extremer",
    label: "集成化客户端",
    note: "编辑器 + LocalBridge + MFW 依赖 + OCR 模型一体化打包，开箱即用的完整方案。",
    href: siteConfig.docsUrl,
    accent: "orange",
  },
];

export const footerColumns: FooterColumn[] = [
  {
    title: "本页导航",
    links: [
      { label: "回到顶部", href: "#", variant: "text" },
      { label: "能力", href: "#features", variant: "text" },
      { label: "生态", href: "#ecosystem", variant: "text" },
    ],
  },
  {
    title: "产品入口",
    links: [
      { label: "在线使用", href: siteConfig.editorUrl, variant: "text" },
      { label: "文档站", href: siteConfig.docsUrl, variant: "text" },
      {
        label: "GitHub",
        href: siteConfig.githubUrl,
        external: true,
        variant: "text",
      },
    ],
  },
  {
    title: "协议与反馈",
    links: [
      {
        label: "License",
        href: `${siteConfig.githubUrl}/blob/main/LICENSE.md`,
        external: true,
        variant: "text",
      },
      {
        label: "Issue",
        href: `${siteConfig.githubUrl}/issues`,
        external: true,
        variant: "text",
      },
    ],
  },
  {
    title: "社区与联动",
    links: [
      {
        label: "QQ群 595990173",
        href: "https://qm.qq.com/q/gqSv6ukjV8",
        external: true,
        variant: "text",
      },
      {
        label: "MaaFramework",
        href: "https://github.com/MaaXYZ/MaaFramework",
        external: true,
        variant: "text",
      },
      {
        label: "MaaMCP",
        href: "https://maa-ai.com/",
        external: true,
        variant: "text",
      },
    ],
  },
];
