import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "common-connection-issues",
  title: "常见连接问题",
  summary: "连接失败时，先从状态、方法配置和目标设备选择这三类问题切入。",
  searchText:
    "常见连接问题 连接失败 LocalBridge 未连接 方法配置 目标设备 连接面板",
  steps: [
    {
      id: "read-error-first",
      title: "先读错误提示，不要盲目重试",
      summary: "连接失败通常已经给了方向：是服务、设备、方法还是参数问题。",
      keywords: ["连接失败", "错误提示", "重试"],
      searchText:
        "连接失败 错误提示 重试 LocalBridge 未连接 参数问题 方法问题",
      blocks: [
        {
          type: "paragraph",
          text: "当连接失败时，最有价值的信息通常已经在错误提示里。先分辨是 LocalBridge 没连上、目标设备不可用、截图/输入方法不兼容，还是手动连接参数缺失，再决定是否刷新或重试。",
        },
      ],
    },
    {
      id: "switch-device-carefully",
      title: "切换设备前先确认当前状态",
      summary: "已连接状态下切设备，需要区分“断开当前”与“连接新设备”。",
      keywords: ["切换设备", "连接新设备", "断开当前"],
      searchText:
        "切换设备 连接新设备 断开当前 已连接状态 ConnectionPanel",
      blocks: [
        {
          type: "paragraph",
          text: "如果当前已经连着一个控制器，再切到另一个设备或窗口时，先确认你是在替换当前连接，还是只是在预览候选目标。连接面板已经把这两种动作分开，不要混着理解。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
