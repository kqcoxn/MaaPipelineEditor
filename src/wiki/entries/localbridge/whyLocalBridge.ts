import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "why-localbridge",
  title: "何时需要 LocalBridge",
  summary: "LocalBridge 是本地能力入口，只有在你需要文件、截图或调试时才必须接入。",
  searchText:
    "何时需要 LocalBridge 本地能力 文件管理 截图工具 调试 设备连接 在线版",
  steps: [
    {
      id: "recognize-boundary",
      title: "先区分纯编辑和本地能力",
      summary: "不是所有使用场景都必须先装 LocalBridge。",
      keywords: ["纯编辑", "本地能力", "在线版"],
      searchText:
        "纯编辑 本地能力 在线版 LocalBridge 是否必须 文件管理 调试",
      blocks: [
        {
          type: "paragraph",
          text: "如果你只做 Pipeline 编辑、结构梳理或临时导入导出，在线版就够用了；只有当你要接触本地文件、截图工具、设备控制或流程调试时，LocalBridge 才成为必须前置。",
        },
      ],
    },
    {
      id: "open-local-features",
      title: "看到这些能力时，就说明你进入了 LocalBridge 边界",
      summary: "文件面板、字段快捷工具和调试工作台都属于 LocalBridge 世界。",
      keywords: ["文件面板", "字段快捷工具", "调试工作台"],
      searchText:
        "文件面板 字段快捷工具 调试工作台 LocalBridge 边界 本地能力",
      blocks: [
        {
          type: "paragraph",
          text: "本地文件列表、截图/ROI/OCR、控制器连接和调试工作台，都是明显的 LocalBridge 边界。一旦你开始使用这些能力，就应该回到连接状态和资源准备情况来理解问题。",
        },
        {
          type: "markdown",
          text: "完整部署文档见：[本地服务概览与部署](https://mpe.codax.site/docs/guide/server/deploy.html)。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
