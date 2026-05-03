import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "prerequisites",
  title: "调试前置条件",
  summary: "在点击运行前，先确认 LocalBridge、控制器、资源和截图来源是否就绪。",
  searchText:
    "调试前置条件 LocalBridge 控制器 资源路径 截图 设备连接 调试不可用",
  steps: [
    {
      id: "check-runtime",
      title: "先确认本地运行时准备完成",
      summary: "调试依赖 LocalBridge、控制器和资源，不是纯前端能力。",
      keywords: ["LocalBridge", "控制器", "资源路径"],
      searchText:
        "LocalBridge 控制器 资源路径 调试前置条件 设备连接 调试不可用",
      blocks: [
        {
          type: "paragraph",
          text: "流程调试依赖 LocalBridge、已连接的控制器，以及可被 MaaFW 成功加载的资源。任一环节没有准备好，调试按钮就算显示出来，也不代表真正能运行。",
        },
      ],
    },
    {
      id: "read-unavailable",
      title: "遇到不可用先读原因，不要盲点重试",
      summary: "工作台会明确告诉你缺的是连接、设备还是资源。",
      keywords: ["不可用原因", "诊断", "资源预检"],
      searchText:
        "不可用原因 诊断 资源预检 设备未连接 LocalBridge 未连接 调试工作台",
      blocks: [
        {
          type: "paragraph",
          text: "当工作台提示前置条件未满足时，先看描述里缺的是 LocalBridge、设备、资源，还是截图来源。按原因补齐，比反复点运行更省时间。",
        },
        {
          type: "markdown",
          text: "部署与能力说明见：[本地服务概览与部署](https://mpe.codax.site/docs/guide/server/deploy.html) 与 [流程级调试](https://mpe.codax.site/docs/guide/server/debug.html)。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
