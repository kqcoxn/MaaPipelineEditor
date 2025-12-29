/**
 * 置顶公告内容
 */
export interface PinnedNotice {
  title?: string; // 公告标题
  content: string[]; // 公告内容列表
  type?: "info" | "warning" | "success"; // 公告类型
}

/**
 * 更新内容分类
 */
export interface UpdateCategory {
  features?: string[]; // 新功能
  fixes?: string[]; // Bug修复
  perfs?: string[]; // 性能优化/体验优化
  docs?: string[]; // 文档更新
  others?: string[]; // 其他更新
}

/**
 * 更新日志数据类型
 * @param version - 版本号
 * @param date - 发布日期 (YYYY-MM-DD)
 * @param type - 更新类型: major(重大更新) | feature(新功能) | fix(问题修复)
 * @param updates - 更新内容，按类型分类
 */
export interface UpdateLogItem {
  version: string;
  date: string;
  type: "major" | "feature" | "fix";
  updates: UpdateCategory;
}

/**
 * 置顶公告内容配置
 * 此部分内容将始终显示在更新日志顶部
 */
export const pinnedNotice: PinnedNotice = {
  title: "置顶公告",
  type: "info",
  content: [
    "**正式版 LocalBridge🌉 已上线**！目前已全面支持**本地文档管理**与**字段快捷填充**（OCR、图片裁剪等）功能，**仅需一行指令即可下载安装**，我们十分推荐您尝试，详情可查阅 [本地服务文档](https://mpe.codax.site/docs/guide/server/deploy.html)",
  ],
};

export const updateLogs: UpdateLogItem[] = [
  {
    version: "0.13.1",
    date: "2025-12-29",
    type: "feature",
    updates: {
      features: [
        "➕ 适配 And、Or 识别类型",
        "🦕 添加快捷复制 reco json 功能，更丝滑的使用组合逻辑识别",
        "🔧 添加配置导出功能，现在可以快速同步使用设备与版本的偏好了！",
      ],
    },
  },
  {
    version: "0.13.0",
    date: "2025-12-24",
    type: "major",
    updates: {
      features: [
        "🔧 配置文件可以独立保存了，支持三模式切换！",
        "📍 新增节点右键菜单，更快捷的处理整体级操作！",
        "🐛 调试功能初步实装，支持进度可视、暂停、断点等操作（仍在完善中，目前仅建议尝鲜，欢迎提供建议与想法！）",
      ],
      perfs: [
        "导出文件后自动添加路径配置",
        "自动将 TemplateMatch-method: 1 迁移为 10001",
      ],
      fixes: ["修复了以文件形式仍然无法导入空文件的问题"],
    },
  },
  {
    version: "0.12.0",
    date: "2025-12-21",
    type: "feature",
    updates: {
      features: [
        "🧰 小工具支持 Action 系列字段了！（target、begin、end、dx、dy）",
        "🌉 本地服务所有配置项可以在前端可视化更改了！",
      ],
      perfs: [
        "优化了 focus 渲染显示",
        "优化了连接半透明状态的表现",
        "提高前端 OCR 精度，持久化模型加载",
        "移除了不必要的节点顺序持久化",
        "导入空文件时自动解析为空 JSON",
      ],
      fixes: ["修复了意外断开重连后，控制器不存在也无法关闭连接的问题"],
    },
  },
  {
    version: "0.11.4",
    date: "2025-12-20",
    type: "fix",
    updates: {
      features: ["支持全量 focus 子字段快捷配置"],
      perfs: ["JSON的导入与导出与原顺序相同了！", "优化 LB 导出交互体验"],
      fixes: [
        "修复了字段工具无法重新截图的问题",
        "修复了本地服务无法索引中文路径的问题",
      ],
    },
  },
  {
    version: "0.11.2",
    date: "2025-12-18",
    type: "fix",
    updates: {
      features: ["📄 未连接本地服务时也可以直接导出为文件了！"],
      fixes: ["修复了无法高亮全部的关键路径的问题"],
    },
  },
  {
    version: "0.11.1",
    date: "2025-12-16",
    type: "feature",
    updates: {
      features: [
        "🦕 适配 repeat、repeat_delay、repeat_wait_freezes 字段",
        "👀 新增聚焦透明度功能，可自由调控不透明度与是否启用，让节点关系更清晰！",
        "🔍 新增路径高亮功能，高亮显示指定起始与结束路径上的所有节点，快捷梳理可达路径",
        "☝️ 连接可以自由拖拽曲率了，可以通过连接中点的手柄改变连接的形态",
      ],
    },
  },
  {
    version: "0.11.0",
    date: "2025-12-15",
    type: "feature",
    updates: {
      features: [
        "🔗 新增分享链接功能，一键分享你的 Pipeline",
        "🍟 适配 on_error jump_back 节点属性",
      ],
    },
  },
  {
    version: "0.10.4",
    date: "2025-12-14",
    type: "feature",
    updates: {
      features: ["🤖 节点级 AI 预测，使用大模型起草你的新节点！"],
      fixes: [
        "修复了运行目录确认后无法更改的问题，文件索引逻辑：指定 --root 参数优先于运行 mpelb 的目录，无其他配置项。",
      ],
    },
  },
  {
    version: "0.10.3",
    date: "2025-12-14",
    type: "feature",
    updates: {
      features: [
        "🧰 新增**字段截图小工具**，支持 expected 字段 OCR、template 字段截图、颜色拾取、roi 字段划选区域等功能，启动 LocalBridge 并连接到你的模拟器即可享用！",
        "🖥️ 新增设备连接面板，**支持全输出输出模式模拟器与Win32窗口连接**",
      ],
      perfs: ["优化嵌套列表的编辑体验", "优化本地服务交互体验"],
    },
  },
  {
    version: "0.9.1",
    date: "2025-12-11",
    type: "feature",
    updates: {
      features: [
        "🔃 新增**自动同步本地文件变更配置**，双向协同，效率翻倍！",
        "📜 新增**自定义模板**功能，可在选中节点后在字段面板左上角按钮添加，详情请参考[文档节点模板面板部分](https://mpe.codax.site/docs/guide/core/node-template-panel.html)。",
      ],
      fixes: [
        "修复了变更通知没有确认按钮的问题，变更确认面板一定要有确认✍️✍️✍️",
      ],
    },
  },
  {
    version: "0.9.0",
    date: "2025-12-10",
    type: "major",
    updates: {
      features: [
        "🌉 正式版 LocalBridge 已上线！现已支持极致😎的**本地文件传输**功能，详情请参考[文档本地服务部分](https://mpe.codax.site/docs/guide/server/deploy.html)。",
        "🎯 现在可以在配置面板自由选择节点属性的导出形式了！",
        "🖱️ 为字段面板与连接面板添加了删除节点与连接按键",
      ],
      perfs: [
        "🗺️ 关闭或切换面板时会自动保存视口位置，下次打开时会自动恢复",
        "👍优化节点渲染性能",
      ],
      fixes: ["修复锚点节点无法保存位置的问题"],
    },
  },
  {
    version: "0.8.5",
    date: "2025-12-7",
    type: "fix",
    updates: {
      fixes: ["修复无法导入异构数组式 jump_back 的问题"],
    },
  },
  {
    version: "0.8.4",
    date: "2025-12-7",
    type: "feature",
    updates: {
      features: [
        "⭐ 全新**现代主题**（可在设置面板切回旧版主题）",
        "🔧 排版栏新增节点间距缩放工具（配合迁移新主题）",
        "⭐ 全新**右键节点模板预览与添加面板**",
        "🔍 新增**节点搜索**功能（with AI 🤖）",
        "🤖 添加 AI 对话记录面板与相关配置",
      ],
      perfs: [
        "自动迁移 interrupt 与 is_sub 字段",
        "大幅提升节点较多时拖拽面板的渲染性能",
      ],
    },
  },
  {
    version: "0.8.1",
    date: "2025-12-4",
    type: "major",
    updates: {
      features: [
        "单节点内部可混合协议导入",
        "提供 MFW 快照版本选择功能",
        "适配 anchor、maxHit、scroll、order_by 字段更新",
        "将 interrupt 连接与端点更新为 jump_back",
        "新增边编辑器，可调节连接顺序",
        "新增重定向节点模板，视为 Anchor 到的位置",
      ],
      fixes: ["修复潜在的选中状态失效或历史记录异常"],
      perfs: ["优化页面响应式显示"],
    },
  },
  {
    version: "0.7.2",
    date: "2025-11-22",
    type: "feature",
    updates: {
      features: [
        "新增可视化更新日志弹窗",
        "新增撤回与重做功能",
        "新增导出为图片功能",
        "新增本地通信框架，支持与外部程序实时通信",
        "支持通过文件系统与外部程序进行数据交互",
      ],
      fixes: ["修复列表同时出现加减号图标时图标变小的问题"],
    },
  },
  {
    version: "0.7.0",
    date: "2025-11-15",
    type: "major",
    updates: {
      features: [
        "新增历史版本快速跳转功能",
        "支持 attach 字段配置",
        "target_offset 字段现在支持数组格式 [x, y]",
        "新增 Touch Down/Move/Up 和 Key Down/Up 系列触控与按键动作",
        "支持 JSONC 格式文件导入（支持注释）",
        "支持从文件管理器拖拽导入 Pipeline 文件",
      ],
      perfs: ["统一了不同协议版本的导入方式"],
      fixes: [
        "修复旧版本配置文件无法导入的问题",
        "修复文件导入时不解析配置的问题",
      ],
    },
  },
  {
    version: "0.5.5",
    date: "2025-10-21",
    type: "fix",
    updates: {
      features: ["新增大小写自动校正功能"],
      perfs: ["优化识别类型与动作类型的校验机制"],
      fixes: ["修复 extras 字段未修改时无法导出的问题"],
    },
  },
  {
    version: "0.5.4",
    date: "2025-10-19",
    type: "feature",
    updates: {
      features: ["新增 MaaFramework 版本提示"],
      perfs: [
        "优化自动布局算法，提升节点排列效果",
        "数字数组现在支持中文逗号分隔",
        "优化响应式标题显示",
        "改进自动布局行为，导入 MPE 导出的文件时保持原有布局",
        "兼容旧版本 action-Key 字段",
        "优化一级字段下拉菜单的排列顺序",
      ],
    },
  },
  {
    version: "0.5.3",
    date: "2025-09-16",
    type: "major",
    updates: {
      features: ["新增暗色/夜间模式支持", "新增 Star 提醒功能"],
      perfs: ["优化在线使用提示", "精简版本发布说明内容"],
    },
  },
  {
    version: "0.5.2",
    date: "2025-09-14",
    type: "feature",
    updates: {
      features: ["新增无延迟节点模板", "支持 MaaFramework 4.5 的 Swipe 新特性"],
      fixes: [
        "修复 wait_freezes 字段的解析与编译错误",
        "修复复制节点时名称异常的问题",
      ],
      perfs: ["调整无延迟节点模板的显示位置"],
    },
  },
];
