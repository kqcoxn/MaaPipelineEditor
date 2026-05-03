import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "field-panel",
  title: "字段面板",
  summary: "字段面板负责编辑节点字段、查看邻接关系，并作为快捷工具的近场入口。",
  searchText:
    "字段面板 节点字段 邻接信息 字段模式 JSON 编辑 ROI OCR 模板截图 字段快捷工具",
  steps: [
    {
      id: "edit-core-fields",
      title: "先编辑关键字段",
      summary: "优先确认节点名、识别字段、动作字段和必要开关。",
      keywords: ["关键字段", "识别字段", "动作字段"],
      searchText:
        "字段面板 关键字段 recognition action 自由字段 节点名 JSON 编辑",
      blocks: [
        {
          type: "paragraph",
          text: "字段面板是节点配置的主入口。第一次配置时，优先确认节点名、识别字段、动作字段和必要开关；只有在关键路径稳定后，再继续补长尾字段。",
        },
      ],
    },
    {
      id: "use-nearby-tools",
      title: "图像类字段优先配合快捷工具",
      summary: "ROI、OCR、模板截图和偏移字段不要只靠手输。",
      keywords: ["ROI", "OCR", "模板截图", "偏移"],
      searchText:
        "字段快捷工具 ROI OCR 模板截图 偏移 手输 图像字段 字段面板",
      blocks: [
        {
          type: "paragraph",
          text: "遇到 ROI、OCR、模板、偏移等图像类字段时，优先借助字段快捷工具，而不是纯手输坐标或文本。这样更容易和实际截图保持一致，也更方便后续验证。",
        },
      ],
    },
    {
      id: "inspect-adjacency",
      title: "用邻接信息复核上下游",
      summary: "字段面板里的邻接信息适合快速检查前驱、后继和连接顺序。",
      keywords: ["邻接信息", "前驱", "后继", "连接顺序"],
      searchText:
        "邻接信息 前驱 后继 连接顺序 JumpBack 字段面板 连接关系",
      blocks: [
        {
          type: "paragraph",
          text: "当你怀疑节点为什么会跳到某条路径时，先看邻接信息，确认当前节点的前驱、后继和连接顺序是否符合预期。这个视角比直接盯着整张大图更适合排查局部关系。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
