import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "quick-start",
  title: "5 分钟上手",
  summary: "用最短路径理解如何打开 MPE、创建节点、连接流程并跑通第一次编辑。",
  searchText:
    "5 分钟上手 快速上手 初次使用 创建节点 连接节点 字段编辑 在线版 本地一体包 LocalBridge 导出 导入 界面",
  steps: [
    {
      id: "choose-edition",
      title: "先选择可用形态",
      summary: "先决定你是只做编辑，还是需要本地能力和调试。",
      keywords: ["在线版", "LocalBridge", "本地一体包", "VSCode"],
      searchText:
        "在线版 LocalBridge 本地一体包 只编辑 调试 文件管理 字段快捷工具 VSCode Simple Browser",
      blocks: [
        {
          type: "paragraph",
          text: "如果你只想编辑 Pipeline，直接打开在线版即可开始；如果你需要本地文件管理、字段快捷工具或流程调试，再连接 LocalBridge 或使用本地一体包。",
        },
        {
          type: "callout",
          calloutType: "info",
          title: "IDE 内使用",
          text: "VSCode 用户可通过 Simple Browser 打开在线版地址，在 IDE 内直接编辑，无需切换窗口。",
        },
      ],
    },
    {
      id: "create-and-connect",
      title: "创建节点并连成流程",
      summary: "先把节点放进画布，再用连接形成最小可执行路径。",
      keywords: ["创建节点", "节点模板", "连接", "端点"],
      searchText:
        "创建节点 节点模板 连接 next on_error jump_back 画布 工作流编辑 端点 标签",
      blocks: [
        {
          type: "paragraph",
          text: "从节点模板面板选择模板添加节点，或右键画布空白处新建空白节点。节点就位后，从源节点端点拖拽到目标节点建立连接。",
        },
        {
          type: "markdown",
          text: "- **next**：正常后继，识别成功后执行\n- **on_error**：异常后继，超时或出错时跳转\n- **interrupt**：中断后继\n- **jump_back**：回跳，用于循环结构\n\n连接上可添加标签备注用途，拖拽中点可调整曲线走向。",
        },
      ],
    },
    {
      id: "edit-core-fields",
      title: "先改关键字段，不必一开始配完整",
      summary: "优先确认节点名、识别/动作关键字段和基本连接是否正确。",
      keywords: ["字段面板", "关键字段", "识别", "动作", "显示模式"],
      searchText:
        "字段面板 节点名 关键字段 recognition action ROI OCR 模板截图 固定 拖动 内嵌",
      blocks: [
        {
          type: "paragraph",
          text: "第一次上手时不用一口气填完所有字段。选中节点后在字段面板中编辑，优先确认节点名、识别类型（recognition）和动作类型（action）是否正确。涉及截图、OCR、ROI 等图像字段时，再借助工具箱补充。",
        },
        {
          type: "paragraph",
          text: "字段面板支持三种显示模式：固定在右侧、拖动浮窗、内嵌缩放，按习惯切换即可。",
        },
      ],
    },
    {
      id: "export-and-verify",
      title: "导出并验证结果",
      summary: "编辑完成后导出 Pipeline，确认 JSON 结构正确。",
      keywords: ["导出", "粘贴板", "文件", "本地保存"],
      searchText:
        "导出 粘贴板 文件 本地保存 JSON 验证 Pipeline 面板 编译预览",
      blocks: [
        {
          type: "paragraph",
          text: "编辑完成后，通过 Pipeline 面板预览编译结果，确认 JSON 结构无误。导出方式有三种：复制到粘贴板（适合快速粘贴到项目）、下载为文件、或通过 LocalBridge 直接保存到本地目录。",
        },
        {
          type: "callout",
          calloutType: "info",
          title: "再次导入",
          text: "导出的 JSON 可随时重新导入 MPE 继续编辑。支持从粘贴板粘贴、文件拖拽或按钮选择文件。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
