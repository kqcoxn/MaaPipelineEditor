import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "prerequisites",
  title: "调试前置条件",
  summary:
    "在点击运行前，先确认 LocalBridge、控制器、资源路径和截图来源是否就绪。",
  searchText:
    "调试前置条件 LocalBridge 控制器 资源路径 截图 设备连接 调试不可用 MaaFramework 初始化 资源体检",
  steps: [
    {
      id: "why-prerequisites",
      title: "调试依赖本地运行时，不是纯前端能力",
      summary: "调试需要 LocalBridge、控制器和资源三者同时就绪。",
      keywords: ["LocalBridge", "控制器", "资源路径", "MaaFramework"],
      searchText:
        "LocalBridge 控制器 资源路径 调试前置条件 设备连接 MaaFramework 本地运行时",
      blocks: [
        {
          type: "paragraph",
          text: "FlowScope 的调试能力依赖 LocalBridge 提供的本地运行时。LocalBridge 负责与 MaaFramework 通信、管理控制器连接和资源加载。任一环节没有准备好，工作台会在顶部显示黄色警告并说明缺失项。",
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
      summary: "按顺序检查四项前置条件，前一项未通过时后续项必然失败。",
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
          text: "按此顺序逐项确认。资源路径需要指向包含 Pipeline JSON 和图片资源的目录，可以在调试配置面板中添加多个路径。",
        },
      ],
    },
    {
      id: "resource-health",
      title: "用资源体检面板快速定位问题",
      summary: "资源体检面板会集中展示加载失败的具体线索。",
      keywords: ["资源体检", "加载失败", "静态检查"],
      searchText:
        "资源体检 加载失败 静态检查 资源路径 resolution loading graph",
      blocks: [
        {
          type: "paragraph",
          text: "当资源加载失败时，不需要手动排查目录结构。切到资源体检面板，它会列出资源路径解析结果、加载诊断和当前图的静态检查结果，直接告诉你哪个文件或节点有问题。",
        },
      ],
    },
    {
      id: "read-unavailable",
      title: "遇到不可用先读原因，不要盲点重试",
      summary: "工作台顶部警告会明确告诉你缺的是什么。",
      keywords: ["不可用原因", "诊断", "警告"],
      searchText:
        "不可用原因 诊断 警告 设备未连接 LocalBridge 未连接 调试工作台 错误提示",
      blocks: [
        {
          type: "paragraph",
          text: "当工作台顶部出现「调试前置条件未满足」的黄色警告时，先看描述里缺的是 LocalBridge、设备、资源还是截图来源。按原因补齐，比反复点运行更省时间。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
