import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "timeline-artifacts",
  title: "时间线与产物",
  summary: "当节点线只能告诉你大概位置时，用事件线和图像产物继续向下追证据。",
  searchText:
    "时间线 事件线 产物 图像 调试证据 截图 识别详情 动作详情 detail artifact 原始图 绘制图 性能摘要 懒加载",
  steps: [
    {
      id: "read-timeline-order",
      title: "先用事件线确认发生顺序",
      summary: "事件线适合回答“先发生了什么、后发生了什么”。",
      keywords: ["时间线", "事件线", "顺序"],
      searchText:
        "时间线 事件线 顺序 调试事件 mfw seq 先后顺序 运行轨迹",
      blocks: [
        {
          type: "paragraph",
          text: "节点线更适合定位“哪个节点有问题”，事件线更适合回答“问题是怎么一步步发生的”。当你需要判断识别、动作、节点事件的先后顺序时，优先切到事件线。",
        },
      ],
    },
    {
      id: "artifact-types",
      title: "了解产物类型",
      summary: "不同类型的产物提供不同维度的证据。",
      keywords: ["原始图", "绘制图", "动作详情", "性能摘要"],
      searchText:
        "原始图 绘制图 动作详情 截图 性能摘要 批量识别摘要 产物类型",
      blocks: [
        {
          type: "markdown",
          text: "- **原始图（Raw）**：设备截图原图，确认画面是否正确\n- **绘制图（Draw）**：在截图上标注识别框和点击位置\n- **动作详情**：动作执行的具体参数和结果\n- **截图（Screenshot）**：运行过程中的关键帧\n- **性能摘要**：各节点耗时统计\n- **批量识别摘要**：多次识别的汇总结果",
        },
      ],
    },
    {
      id: "open-artifacts",
      title: "产物按需加载，点击查看",
      summary: "产物不会自动全部加载，需要点击具体条目触发。",
      keywords: ["产物", "懒加载", "点击查看", "LocalBridge"],
      searchText:
        "产物 截图 识别详情 动作详情 图像面板 artifact detail screenshot 懒加载 点击加载",
      blocks: [
        {
          type: "paragraph",
          text: "产物采用懒加载策略——列表中只显示摘要信息，点击具体条目后才从 LocalBridge 加载完整内容（如大图、详细 JSON）。这样避免一次运行产生大量数据时卡顿。",
        },
        {
          type: "callout",
          calloutType: "info",
          title: "临时回放",
          text: "事件线支持临时回放功能，可以按时间顺序逐步重放事件，帮助理解运行过程中的状态变化。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
