import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "connection-prerequisites",
  title: "连接状态与前置条件",
  summary: "连接面板负责回答“现在有没有连上”和“还差哪一步才算真的能用”。",
  searchText:
    "连接状态 前置条件 LocalBridge 未连接 连接失败 控制器 设备 连接面板",
  steps: [
    {
      id: "read-status",
      title: "先看状态词，再决定下一步",
      summary: "未连接、连接中、已连接、连接失败分别对应不同动作。",
      keywords: ["未连接", "连接中", "已连接", "连接失败"],
      searchText:
        "未连接 连接中 已连接 连接失败 状态词 LocalBridge 连接面板",
      blocks: [
        {
          type: "paragraph",
          text: "连接面板里最先要读的是状态词，而不是设备列表。未连接表示还没建立控制器会话；连接中说明正在尝试；已连接表示当前控制器已可用；连接失败则需要去看错误信息和方法配置。",
        },
      ],
    },
    {
      id: "check-methods",
      title: "已选设备不等于前置条件满足",
      summary: "还要确认截图方法、输入方法和必要参数都可用。",
      keywords: ["截图方法", "输入方法", "手动连接"],
      searchText:
        "截图方法 输入方法 手动连接 前置条件 已选设备 不等于 已连接",
      blocks: [
        {
          type: "paragraph",
          text: "即使已经选中了 ADB 设备或 Win32 窗口，也不代表一定能连上。截图方法、输入方法、手动连接参数和平台差异都会影响是否真的满足连接前置条件。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
