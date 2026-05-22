import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "troubleshooting",
  title: "调试排障",
  summary: "当调试失败或结果不符合预期时，先按可复现顺序排查前置条件、证据和运行范围。",
  searchText:
    "调试排障 调试失败 运行失败 前置条件 证据 排查 LocalBridge 资源 控制器 常见错误 日志",
  steps: [
    {
      id: "check-preconditions-first",
      title: "调试失败先回头看前置条件",
      summary: "LocalBridge、控制器、资源和截图来源任一缺失都会让结果失真。",
      keywords: ["调试失败", "前置条件", "LocalBridge", "日志"],
      searchText:
        "调试失败 前置条件 LocalBridge 控制器 资源路径 截图来源 运行失败 maa.log 日志",
      blocks: [
        {
          type: "paragraph",
          text: "当调试根本跑不起来，或者跑出来的结果明显不可信时，不要先怀疑业务节点。先确认 LocalBridge 已连、控制器就绪、资源加载成功、截图来源正常，再看节点本身。",
        },
        {
          type: "paragraph",
          text: "长期排查时可以查看 maa.log 日志文件，里面有 MaaFramework 的详细运行记录。",
        },
      ],
    },
    {
      id: "common-errors",
      title: "常见错误与解决",
      summary: "几个高频错误的快速定位方法。",
      keywords: ["资源路径", "控制器不可用", "图片未显示", "回放"],
      searchText:
        "缺少资源路径 控制器不可用 识别图未显示 回放控制器不可用 常见错误 解决方案",
      blocks: [
        {
          type: "callout",
          calloutType: "warning",
          title: "缺少资源路径",
          text: "运行配置中未添加资源路径，或路径指向的目录不包含有效的 Pipeline JSON 文件。检查路径是否正确，目录下是否有 .json 文件。",
        },
        {
          type: "callout",
          calloutType: "warning",
          title: "控制器不可用",
          text: "设备未连接或连接已断开。ADB 设备检查 adb devices 是否可见；Win32 检查目标窗口是否存在且未最小化。",
        },
        {
          type: "callout",
          calloutType: "warning",
          title: "识别图/详情未显示",
          text: "产物策略设置为不保存，或产物尚未加载。检查运行配置中的产物策略，确认设置为保存截图和识别图。",
        },
      ],
    },
    {
      id: "shrink-scope",
      title: "把排查范围缩小到最短可复现路径",
      summary: "从节点运行、仅识别、仅动作通常比整图重跑更高效。",
      keywords: ["从节点运行", "仅识别", "仅动作", "缩小范围"],
      searchText:
        "从节点运行 仅识别 仅动作 缩小范围 最短复现 调试排障 重新发起",
      blocks: [
        {
          type: "paragraph",
          text: "如果整图运行太长或信息过多，优先改用从节点运行、单节点运行、仅识别或仅动作，把问题压缩到最短可复现路径。通过重新发起小范围运行来排障，比在一条超长记录里回溯更高效。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
