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
  demoLabel: string;
  demoTitle: string;
  demoDescription: string;
  demoSteps: string[];
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
    id: "review-edit",
    label: "审阅与编辑",
    title: "把复杂 Pipeline 拆成能讨论、能修改的画布",
    description:
      "大型流程不再只是一段长 JSON。节点、连接和分组把审阅焦点拉回结构本身，适合排查逻辑、对齐设计和做增量修改。",
    tags: ["关键路径高亮", "节点分组", "结构审阅"],
    tone: "blue",
    demoLabel: "Graph Review",
    demoTitle: "按节点理解流程，而不是手动翻整段协议",
    demoDescription:
      "占位 Demo 先强调信息结构和工作节奏，后续替换为真实流程截图。",
    demoSteps: [
      "聚焦主任务链路",
      "高亮关键入口与出口",
      "在同一画布里审阅节点差异",
    ],
    metrics: ["适合跨项目审阅", "保留分组视角", "先读后改"],
  },
  {
    id: "local-bridge",
    label: "本地增强",
    title: "在线编辑之外，按需补上本地文件、截图与 OCR 能力",
    description:
      "首版 Landing 不直接承载工具本体，但要明确表达 MPE 可以从纯网页体验逐步升级到贴近本地工作流的增强形态。",
    tags: ["LocalBridge", "文件管理", "截图与 OCR"],
    tone: "mint",
    demoLabel: "Local Extension",
    demoTitle: "一行命令接入本地能力，不把首屏变成安装门槛",
    demoDescription:
      "用占位面板表现本地服务入口、文件选择与识别结果，突出渐进增强的产品节奏。",
    demoSteps: [
      "按需启动 LocalBridge",
      "选择本地资源或截图",
      "把识别结果回填到流程配置",
    ],
    metrics: ["渐进增强", "不强绑环境", "对齐资源开发场景"],
  },
  {
    id: "debug-template",
    label: "调试与模板",
    title: "把重复搭建成本收敛成模板，把调试反馈放回流程语境",
    description:
      "模板、字段补全和流程调试并不是额外噱头，而是让团队更快进入有效编辑状态的基础设施。",
    tags: ["节点模板", "字段填充", "流程调试"],
    tone: "orange",
    demoLabel: "Debug & Templates",
    demoTitle: "从占位模版到稳定工作流，减少重复配置",
    demoDescription:
      "左侧 Demo 先用字段清单、调试日志与模板卡片表现工作流搭建节奏。",
    demoSteps: [
      "插入常用节点模板",
      "补齐字段与默认值",
      "在调试面板确认执行反馈",
    ],
    metrics: ["减少重复劳动", "更快完成原型", "回到流程上下文"],
  },
  {
    id: "ai-mcp",
    label: "AI 与 MCP",
    title: "让流程定位、补全与生态联动更智能，但不喧宾夺主",
    description:
      "AI 与 MCP 在这里是增强器，不是首页噱头。首版文案只强调它们如何帮助开发者更快找到节点、更稳地补全配置。",
    tags: ["智能搜索", "AI 补全", "MCP 联动"],
    tone: "rose",
    demoLabel: "AI Assist",
    demoTitle: "把节点搜索、补全与跨工具联动组织成可信的辅助层",
    demoDescription:
      "占位 Demo 以命令面板、联动状态和建议结果表现未来可扩展的智能入口。",
    demoSteps: [
      "通过搜索快速定位节点",
      "让 AI 生成或补齐配置草稿",
      "把外部工作流联动到 MPE 中审阅",
    ],
    metrics: ["以辅助为主", "强调可控性", "便于后续扩展"],
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
