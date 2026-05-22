import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "node-templates",
  title: "节点模板",
  summary: "节点模板面板用于更快地创建常见节点，并复用已经整理好的结构。",
  searchText:
    "节点模板 模板面板 搜索节点模板 预设模板 自定义模板 粘贴节点 创建节点 快捷键 保存模板",
  steps: [
    {
      id: "pick-template-fast",
      title: "优先从模板开始，而不是空白手填",
      summary: "模板能帮你更快得到接近目标的起点。",
      keywords: ["预设模板", "自定义模板", "创建节点", "分类"],
      searchText:
        "预设模板 自定义模板 创建节点 搜索节点模板 节点模板面板 空白 识别 动作 特殊 辅助",
      blocks: [
        {
          type: "paragraph",
          text: "节点模板面板适合在创建节点时快速选一个最接近目标的起点。相比空白手填，模板能减少识别类型、动作类型和常见字段的重复录入。",
        },
        {
          type: "markdown",
          text: "预设模板分类：\n- **空白节点**：最小起点\n- **识别类**：DirectHit、TemplateMatch、OCR 等常见识别模板\n- **动作类**：Click、Swipe、Key 等常见动作模板\n- **特殊节点**：External、Anchor\n- **辅助节点**：便签、分组",
        },
      ],
    },
    {
      id: "search-preview-paste",
      title: "搜索、预览和粘贴板是同一条复用链路",
      summary: "模板搜索和粘贴板都服务于“少重复输入”。",
      keywords: ["搜索节点模板", "预览", "粘贴板"],
      searchText:
        "搜索节点模板 预览 粘贴板 复制节点 复用结构 自定义模板 模糊匹配",
      blocks: [
        {
          type: "paragraph",
          text: "在面板里搜索模板（支持模糊匹配）、看左侧节点预览确认结构、或者直接粘贴刚复制过的节点，本质上都是为了复用已有结构。找得到现成结构时，优先复用而不是重新创建。",
        },
        {
          type: "callout",
          calloutType: "info",
          title: "自定义模板保存",
          text: "选中节点后点击工具栏的保存模板按钮，输入名称即可保存为自定义模板。最多保存 50 个，存储在浏览器 localStorage 中。悬停自定义模板可显示删除按钮。",
        },
      ],
    },
    {
      id: "keyboard-shortcuts",
      title: "用键盘快速操作面板",
      summary: "方向键选择、Enter 添加、Esc 关闭。",
      keywords: ["快捷键", "键盘操作"],
      searchText:
        "快捷键 键盘操作 方向键 Enter Esc 上下选择 添加节点 关闭面板",
      blocks: [
        {
          type: "code",
          language: "text",
          text: "↑ / ↓  选择模板\nEnter   添加选中模板到画布\nEsc     关闭面板",
        },
        {
          type: "paragraph",
          text: "鼠标点击模板项也可直接添加节点。面板打开时输入文字会自动聚焦搜索框进行过滤。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
