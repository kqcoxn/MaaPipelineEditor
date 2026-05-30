import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "quick-start",
  title: "快速上手",
  summary: "从零开始创建节点、连接流程、编辑字段并导出第一个 Pipeline。",
  searchText:
    "快速上手 教程 打开 Editor 浏览器 VSCode LocalBridge 本地一体包 节点 创建 连接 字段 导出 导入",
  steps: [
    {
      id: "open-editor",
      title: "打开 Editor",
      summary: "在浏览器或 IDE 中打开 MPE 开始编辑。",
      keywords: ["打开", "浏览器", "VSCode", "在线版"],
      searchText:
        "打开 Editor 浏览器 在线网页 VSCode Simple Browser Cursor IDE 部署",
      blocks: [
        {
          type: "paragraph",
          text: "MPE 前端以 Web 页面形式部署，您可以在任意能打开网页的程序中使用。",
        },
        {
          type: "markdown",
          text: "- **浏览器**：直接访问在线编辑器 (stable / preview)，或自行部署\n- **类 VSCode IDE**：使用 Ctrl+Shift+P 打开指令框，输入 simple browser 回车，在网址框输入编辑器地址即可",
        },
        {
          type: "callout",
          calloutType: "info",
          title: "本地服务（可选）",
          text: "如需文件管理、截图工具或调试能力，可一行命令启动 LocalBridge；或使用本地一体包 (Extremer) 开箱即用。",
        },
      ],
    },
    {
      id: "create-nodes",
      title: "添加节点",
      summary: "通过模板面板或右键菜单创建节点。",
      keywords: ["添加节点", "节点模板", "右键", "空节点"],
      searchText:
        "添加节点 创建节点 节点模板 右键 空节点 OCR 文字识别 DirectHit DoNothing",
      blocks: [
        {
          type: "paragraph",
          text: "右键画布空白处唤起模板与添加面板，点击或回车即可在右键位置添加节点。左侧节点工具模块也提供了常用节点的快捷按钮。",
        },
        {
          type: "paragraph",
          text: "不同节点模板用于快速初始化不同字段组合，创建后可自行调整任意字段。已选中节点时再创建，新节点会生成在已选节点后方并自动添加连接。",
        },
      ],
    },
    {
      id: "edit-fields",
      title: "编辑节点字段",
      summary: "在字段面板中配置识别、动作等关键字段。",
      keywords: ["字段面板", "识别", "动作", "节点名"],
      searchText:
        "字段面板 编辑字段 recognition action OCR Click Swipe expected 节点名 key 添加字段 删除字段",
      blocks: [
        {
          type: "paragraph",
          text: "选中节点后，右上角显示节点字段面板。优先确认节点名（key）、识别类型（recognition）和动作类型（action）是否正确。切换识别或动作值时，面板会自动筛选可配置的字段。",
        },
        {
          type: "markdown",
          text: "- 修改 key 值即可修改节点名，编译器会将其编译为 Pipeline 的键值\n- 使用右侧下拉选项添加字段，使用删除按键移除字段\n- 鼠标悬停字段名可查看相关提示\n- 字段面板支持固定、拖动、内嵌三种显示模式",
        },
      ],
    },
    {
      id: "connect-nodes",
      title: "连接节点",
      summary: "通过端点拖拽建立节点间的流程关系。",
      keywords: ["连接", "端点", "next", "on_error", "jump_back"],
      searchText:
        "连接 端点 拖拽 next on_error jump_back target 标签 顺序 数组",
      blocks: [
        {
          type: "paragraph",
          text: "每个节点有四个端点：右侧为出口（next 和 on_error），左侧为入口（target 和 jump_back）。从出口端点拖拽到目标节点入口即可建立连接。",
        },
        {
          type: "markdown",
          text: "- **next**：正常后继，识别成功后执行\n- **on_error**：异常后继，超时或出错时跳转\n- **jump_back**：回跳，用于循环结构\n\n连接中间的数字标签表示编译后在数组中的顺序。",
        },
      ],
    },
    {
      id: "export",
      title: "导出与再次导入",
      summary: "将编辑结果导出为 Pipeline JSON，支持多种导入导出方式。",
      keywords: ["导出", "导入", "粘贴板", "文件", "本地保存"],
      searchText:
        "导出 导入 粘贴板 文件 本地保存 JSON Pipeline 面板 预览 集成导出 分离导出 拖拽导入",
      blocks: [
        {
          type: "paragraph",
          text: "编辑完成后，通过右侧 Pipeline JSON 面板预览编译结果。导出支持复制到粘贴板、下载为文件，连接 LocalBridge 后还可直接保存到本地工作目录。",
        },
        {
          type: "markdown",
          text: "**导入方式：**\n- 从粘贴板导入：复制 Pipeline 代码后点击导入按钮\n- 从文件导入：拖拽 .json/.jsonc 文件到页面，或点击按钮选择文件\n- 本地服务导入：通过 LocalBridge 快捷导入\n\nMPE 自动兼容 v1 和 v2 协议格式，支持同一文件中混合使用两种协议。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
