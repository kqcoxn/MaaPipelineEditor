import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "prerequisites",
  title: "调试前置条件",
  summary: "在点击运行前，先确认 LocalBridge、控制器、资源和截图来源是否就绪。",
  searchText:
    "调试前置条件 LocalBridge 控制器 资源路径 截图 设备连接 调试不可用 MaaFramework 初始化",
  steps: [
    {
      id: "check-runtime",
      title: "先确认本地运行时准备完成",
      summary: "调试依赖 LocalBridge、控制器和资源，不是纯前端能力。",
      keywords: ["LocalBridge", "控制器", "资源路径", "MaaFramework"],
      searchText:
        "LocalBridge 控制器 资源路径 调试前置条件 设备连接 调试不可用 MaaFramework 初始化",
      blocks: [
        {
          type: "paragraph",
          text: "流程调试依赖 LocalBridge、已连接的控制器，以及可被 MaaFramework 成功加载的资源。任一环节没有准备好，调试按钮就算显示出来，也不代表真正能运行。",
        },
        {
          type: "callout",
          calloutType: "warning",
          title: "纯 Web 模式",
          text: "纯 Web 模式（未连接 LocalBridge）没有调试能力，所有调试相关功能都需要本地运行时支持。",
        },
      ],
    },
    {
      id: "checklist",
      title: "前置条件清单",
      summary: "按顺序检查四项前置条件。",
      keywords: ["清单", "检查", "顺序"],
      searchText:
        "前置条件清单 检查顺序 LocalBridge启动 MaaFramework初始化 资源路径 Pipeline节点",
      blocks: [
        {
          type: "code",
          language: "text",
          text: "1. LocalBridge 已启动并连接\n2. MaaFramework 已初始化 + 控制器已连接设备\n3. 资源路径已配置且加载成功\n4. 当前文件中有可运行的 Pipeline 节点",
        },
        {
          type: "paragraph",
          text: "按此顺序逐项确认，前一项未通过时后续项必然失败。资源路径需要指向包含 Pipeline JSON 和图片资源的目录。",
        },
      ],
    },
    {
      id: "read-unavailable",
      title: "遇到不可用先读原因，不要盲点重试",
      summary: "工作台会明确告诉你缺的是连接、设备还是资源。",
      keywords: ["不可用原因", "诊断", "资源预检"],
      searchText:
        "不可用原因 诊断 资源预检 设备未连接 LocalBridge 未连接 调试工作台 错误提示",
      blocks: [
        {
          type: "paragraph",
          text: "当工作台提示前置条件未满足时，先看描述里缺的是 LocalBridge、设备、资源，还是截图来源。按原因补齐，比反复点运行更省时间。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
