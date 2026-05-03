import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "troubleshooting",
  title: "调试排障",
  summary: "当调试失败或结果不符合预期时，先按可复现顺序排查前置条件、证据和运行范围。",
  searchText:
    "调试排障 调试失败 运行失败 前置条件 证据 排查 LocalBridge 资源 控制器",
  steps: [
    {
      id: "check-preconditions-first",
      title: "调试失败先回头看前置条件",
      summary: "LocalBridge、控制器、资源和截图来源任一缺失都会让结果失真。",
      keywords: ["调试失败", "前置条件", "LocalBridge"],
      searchText:
        "调试失败 前置条件 LocalBridge 控制器 资源路径 截图来源 运行失败",
      blocks: [
        {
          type: "paragraph",
          text: "当调试根本跑不起来，或者跑出来的结果明显不可信时，不要先怀疑业务节点。先确认 LocalBridge 已连、控制器就绪、资源加载成功、截图来源正常，再看节点本身。",
        },
      ],
    },
    {
      id: "shrink-scope",
      title: "把排查范围缩小到最短可复现路径",
      summary: "从节点运行、仅识别、仅动作通常比整图重跑更高效。",
      keywords: ["从节点运行", "仅识别", "仅动作"],
      searchText:
        "从节点运行 仅识别 仅动作 缩小范围 最短复现 调试排障",
      blocks: [
        {
          type: "paragraph",
          text: "如果整图运行太长或信息过多，优先改用从节点运行、单节点运行、仅识别或仅动作，把问题压缩到最短可复现路径。P1 的调试模型更适合通过重新发起小范围运行来排障，而不是在一条超长记录里回溯。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
