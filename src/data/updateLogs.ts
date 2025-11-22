/**
 * 更新内容分类
 */
export interface UpdateCategory {
  features?: string[]; // 新功能
  fixes?: string[]; // Bug修复
  optimizations?: string[]; // 性能优化/体验优化
  refactors?: string[]; // 代码重构
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

export const updateLogs: UpdateLogItem[] = [
  {
    version: "0.7.1",
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
      optimizations: ["统一了不同协议版本的导入方式"],
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
      optimizations: ["优化识别类型与动作类型的校验机制"],
      fixes: ["修复 extras 字段未修改时无法导出的问题"],
    },
  },
  {
    version: "0.5.4",
    date: "2025-10-19",
    type: "feature",
    updates: {
      features: ["新增 MaaFramework 版本提示"],
      optimizations: [
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
      optimizations: ["优化在线使用提示", "精简版本发布说明内容"],
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
      optimizations: ["调整无延迟节点模板的显示位置"],
    },
  },
];
