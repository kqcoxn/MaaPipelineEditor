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
  ogImage: "/og/landing-og.svg",
  ogAlt: "MaaPipelineEditor Landing placeholder artwork",
};

export const navItems: NavItem[] = [
  { label: "能力", href: "#features" },
  { label: "场景", href: "#showcase" },
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
    demoImages: ["/screens/review.png"],
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
    demoImages: ["/screens/edit.png"],
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
    demoImages: ["/screens/tools-1.png"],
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
    demoImages: ["/screens/lb.png"],
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
      "面向大体量流程的结构化入口，适合先理清主路径，再逐段细化字段与模板。",
    tags: ["复杂流程", "结构化阅读", "占位视觉"],
    accent: "blue",
    detail: "首版以占位场景卡呈现案例密度，第二阶段替换真实大图。",
    href: siteConfig.editorUrl,
    ctaLabel: "打开编辑器",
  },
  {
    title: "快速审阅其他项目逻辑",
    summary:
      "适合贡献者和协作者快速看懂已有流程，不必在长 JSON 中人工定位跳转关系。",
    tags: ["跨项目审阅", "关键路径", "团队协作"],
    accent: "mint",
    detail: "突出“先审阅、后修改”的入口价值，降低接手项目的心理成本。",
    href: siteConfig.docsUrl,
    ctaLabel: "查看文档",
  },
  {
    title: "用辅助工具补全内容",
    summary:
      "把模板、OCR、截图与字段填充组织成同一条工作链，让配置工作不再分散在多个窗口之间。",
    tags: ["模板补全", "截图", "OCR"],
    accent: "orange",
    detail: "案例卡保持写实语气，避免把增强能力包装成泛化的 AI 叙事。",
    href: siteConfig.ecosystemUrl,
    ctaLabel: "了解生态",
  },
  {
    title: "迁移旧项目与混合协议",
    summary:
      "在保留旧资产的前提下逐步进入新工作流，让 v1 / v2 混合导入与结构整理更可控。",
    tags: ["迁移兼容", "协议混合", "渐进升级"],
    accent: "rose",
    detail: "用真实约束表达可信度，而不是堆砌抽象的“企业级”话术。",
    href: siteConfig.githubUrl,
    ctaLabel: "查看仓库",
  },
];

export const statsItems: StatItem[] = [
  {
    kind: "metric",
    value: "0 安装",
    label: "打开网页即可开始可视化审阅与编辑",
    note: "先把理解成本降下来，再决定是否接入增强能力。",
    accent: "blue",
  },
  {
    kind: "metric",
    value: "1 行命令",
    label: "按需启用本地增强服务",
    note: "LocalBridge 以渐进增强方式进入工作流，而不是先逼你配环境。",
    accent: "mint",
  },
  {
    kind: "metric",
    value: "2 代协议",
    label: "支持节点级 v1 / v2 混合导入",
    note: "迁移旧项目时更容易保持上下文与结构稳定。",
    accent: "orange",
  },
  {
    kind: "metric",
    value: "2025 起",
    label: "项目持续演进至今",
    note: "定位明确、节奏稳定，优先服务真实资源开发场景。",
    accent: "rose",
  },
  {
    kind: "ecosystem",
    value: "LocalBridge",
    label: "本地能力增强",
    note: "按需接入文件、截图、OCR 与更多工作流边界能力。",
    href: siteConfig.docsUrl,
    accent: "mint",
  },
  {
    kind: "ecosystem",
    value: "Extremer",
    label: "集成化本地方案",
    note: "为长期使用提供更完整的一体化形态，减少手工拼装成本。",
    href: siteConfig.docsUrl,
    accent: "orange",
  },
  {
    kind: "ecosystem",
    value: "MCP",
    label: "跨工具联动入口",
    note: "把生成、补全和外部工作流衔接到 MPE 的可视化审阅里。",
    href: "https://maa-ai.top/",
    accent: "rose",
  },
];

export const footerColumns: FooterColumn[] = [
  {
    title: "品牌",
    links: [
      { label: "MaaPipelineEditor", href: "/", variant: "text" },
      { label: "在线使用", href: siteConfig.editorUrl, variant: "text" },
      { label: "预览说明", href: siteConfig.docsUrl, variant: "text" },
    ],
  },
  {
    title: "产品入口",
    links: [
      { label: "稳定版编辑器", href: siteConfig.editorUrl, variant: "text" },
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
    title: "资源",
    links: [
      { label: "LocalBridge", href: siteConfig.ecosystemUrl, variant: "text" },
      {
        label: "Issue",
        href: `${siteConfig.githubUrl}/issues`,
        external: true,
        variant: "text",
      },
      {
        label: "License",
        href: `${siteConfig.githubUrl}/blob/main/LICENSE.md`,
        external: true,
        variant: "text",
      },
    ],
  },
  {
    title: "社区与协议",
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
        href: "https://maa-ai.top/",
        external: true,
        variant: "text",
      },
    ],
  },
];
