import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "nodes",
  title: "节点",
  summary: "理解 Pipeline 节点的类型、风格、创建方式和常用操作。",
  searchText:
    "节点 节点模板 节点名 复制节点 Anchor External Group 调试入口 从节点运行 节点风格 现代 经典 极简 便签 分组 右键菜单",
  steps: [
    {
      id: "create-node",
      title: "创建或插入节点",
      summary: "从节点模板、连接空白处或右键菜单创建节点。",
      keywords: ["创建节点", "节点模板", "节点类型"],
      searchText:
        "创建节点 节点列表 节点模板 连接空白处创建 节点类型 Pipeline External Anchor 便签 分组",
      blocks: [
        {
          type: "paragraph",
          text: "节点可以来自节点模板面板、从一条连接拖到空白处直接创建、或右键画布空白处新建。第一次编辑时，优先把最小路径上的字段节点搭起来，再补充辅助节点。",
        },
        {
          type: "markdown",
          text: "- **字段节点**：标准 Pipeline 节点，承载识别/动作字段\n- **外部节点（External）**：引用其他文件中的节点，不含字段\n- **Anchor 节点**：重定向跳板，简化复杂连接\n- **便签节点**：纯文本备注，不参与编译\n- **分组节点**：将多个节点归组，便于整理和折叠",
        },
      ],
    },
    {
      id: "node-styles",
      title: "选择合适的节点风格",
      summary: "三种渲染风格在信息密度和视觉清晰度上各有侧重。",
      keywords: ["节点风格", "现代", "经典", "极简"],
      searchText:
        "节点风格 现代 经典 极简 渲染模式 字段折叠 显示模式 信息密度",
      blocks: [
        {
          type: "markdown",
          text: "- **现代风格**（默认）：分区展示字段，信息密度高，适合日常编辑\n- **经典风格**：类似传统流程图，端点在左右两侧，适合阅读连接关系\n- **极简风格**：只显示节点名，最小占用空间，适合大图总览",
        },
        {
          type: "paragraph",
          text: "风格可在设置中全局切换，也可对单个节点单独设置。字段支持折叠显示，减少节点高度。",
        },
      ],
    },
    {
      id: "reuse-node",
      title: "复用节点与右键操作",
      summary: "复制、模板保存和右键菜单是高频操作入口。",
      keywords: ["复制节点", "保存模板", "右键菜单", "对齐", "分组"],
      searchText:
        "复制节点 保存模板 部分导出 节点复用 右键菜单 对齐 等距 分组 复制节点名 编辑JSON 端点位置",
      blocks: [
        {
          type: "paragraph",
          text: "当某类节点需要反复出现时，优先使用复制、保存为自定义模板或部分导出，而不是每次从零手填。",
        },
        {
          type: "markdown",
          text: "右键菜单常用操作：\n- 复制节点名（用于连接配置）\n- 保存为模板\n- 编辑原始 JSON\n- 调整端点位置\n- 多选时：对齐、等距分布、创建分组\n- 调试操作：从此节点运行、单节点运行、仅识别、仅动作",
        },
      ],
    },
    {
      id: "debug-from-node",
      title: "从节点开始调试",
      summary: "Pipeline 节点的调试入口会打开调试工作台发起运行。",
      keywords: ["从节点运行", "单节点运行", "仅识别", "仅动作"],
      searchText:
        "从节点运行 单节点运行 仅识别 仅动作 调试工作台 新调试记录",
      blocks: [
        {
          type: "paragraph",
          text: "当 LocalBridge、控制器和资源准备就绪后，右键节点可选择多种调试方式：从此节点开始完整运行、单节点运行、仅识别或仅动作。这是理解单个节点行为最快的入口。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
