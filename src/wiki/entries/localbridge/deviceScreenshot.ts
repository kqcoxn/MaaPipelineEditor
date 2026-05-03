import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "device-screenshot",
  title: "设备与截图前置",
  summary: "截图类工具能不能工作，关键不只是连上 LocalBridge，还要看控制器和截图来源是否就绪。",
  searchText:
    "设备与截图前置 截图失败 控制器未连接 LocalBridge 已连 截图来源 工具箱",
  steps: [
    {
      id: "localbridge-is-not-enough",
      title: "LocalBridge 已连，不代表截图一定可用",
      summary: "真正决定截图是否成功的是控制器和截图来源。",
      keywords: ["截图失败", "控制器", "截图来源"],
      searchText:
        "截图失败 控制器未连接 截图来源 LocalBridge 已连 工具箱 字段快捷工具",
      blocks: [
        {
          type: "paragraph",
          text: "很多截图失败并不是 LocalBridge 本身掉线，而是控制器没有建立成功、当前设备不可用，或截图来源不支持。看到“请先连接本地服务与设备”时，重点要补的是设备链路，而不只是重连服务。",
        },
      ],
    },
    {
      id: "trace-back-from-tool",
      title: "从工具失败点反推前置条件",
      summary: "OCR、模板截图、ROI、偏移测量共享同一套截图前提。",
      keywords: ["OCR", "模板截图", "ROI", "偏移测量"],
      searchText:
        "OCR 模板截图 ROI 偏移测量 共享前置条件 截图失败",
      blocks: [
        {
          type: "paragraph",
          text: "OCR、模板截图、ROI、偏移测量都建立在同一套截图前提之上。只要其中一个工具因为截图失败而不可用，通常其他几个工具也需要先回到连接面板确认设备与方法配置。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
