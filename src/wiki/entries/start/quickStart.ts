import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "quick-start",
  title: "5 分钟上手",
  summary: "用最短路径理解如何打开 MPE、创建节点、连接流程并跑通第一次编辑。",
  searchText:
    "5 分钟上手 快速上手 初次使用 创建节点 连接节点 字段编辑 在线版 本地一体包 LocalBridge",
  steps: [
    {
      id: "choose-edition",
      title: "先选择可用形态",
      summary: "先决定你是只做编辑，还是需要本地能力和调试。",
      keywords: ["在线版", "LocalBridge", "本地一体包"],
      searchText:
        "在线版 LocalBridge 本地一体包 只编辑 调试 文件管理 字段快捷工具",
      blocks: [
        {
          type: "paragraph",
          text: "如果你只想编辑 Pipeline，直接打开在线版即可开始；如果你需要本地文件管理、字段快捷工具或流程调试，再连接 LocalBridge 或使用本地一体包。",
        },
        {
          type: "markdown",
          text: "完整形态说明见：[快速上手](https://mpe.codax.site/docs/guide/start/quick-start.html) 与 [产品矩阵](https://mpe.codax.site/docs/guide/start/product-matrix.html)。",
        },
      ],
    },
    {
      id: "create-and-connect",
      title: "创建节点并连成流程",
      summary: "先把节点放进画布，再用连接形成最小可执行路径。",
      keywords: ["创建节点", "节点模板", "连接"],
      searchText:
        "创建节点 节点模板 连接 next on_error jump_back 画布 工作流编辑",
      blocks: [
        {
          type: "paragraph",
          text: "先从节点列表或节点模板把需要的节点加入画布，再通过 next、on_error 或 jumpback 等连接关系把流程串起来。P1 的 Wiki 会在节点、连接和字段面板里分别提供更细的上下文说明。",
        },
        {
          type: "code",
          language: "text",
          text: "创建节点 -> 连接节点 -> 选中节点 -> 编辑字段 -> 导入/导出检查结果",
        },
      ],
    },
    {
      id: "edit-core-fields",
      title: "先改关键字段，不必一开始配完整",
      summary: "优先确认节点名、识别/动作关键字段和基本连接是否正确。",
      keywords: ["字段面板", "关键字段", "识别", "动作"],
      searchText:
        "字段面板 节点名 关键字段 recognition action ROI OCR 模板截图",
      blocks: [
        {
          type: "paragraph",
          text: "第一次上手时不用一口气填完所有字段。优先确认节点名、识别/动作关键字段和连接是否正确；涉及截图、OCR、ROI、模板等图像字段时，再借助工具箱或字段快捷工具补充。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
