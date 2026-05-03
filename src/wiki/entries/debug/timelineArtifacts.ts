import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "timeline-artifacts",
  title: "时间线与产物",
  summary: "当节点线只能告诉你大概位置时，用事件线和图像产物继续向下追证据。",
  searchText:
    "时间线 事件线 产物 图像 调试证据 截图 识别详情 动作详情 detail artifact",
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
          text: "节点线更适合定位“哪个节点有问题”，事件线更适合回答“问题是怎么一步步发生的”。当你需要判断 reco、action、node 事件的先后顺序时，优先切到事件线。",
        },
      ],
    },
    {
      id: "open-artifacts",
      title: "再用图像和详情产物核对证据",
      summary: "截图、识别详情和动作详情决定你看到的到底是不是同一个问题。",
      keywords: ["产物", "截图", "识别详情", "动作详情"],
      searchText:
        "产物 截图 识别详情 动作详情 图像面板 artifact detail screenshot",
      blocks: [
        {
          type: "paragraph",
          text: "当时间线里已经看到可疑事件后，再去图像面板和详情产物里核对截图、识别框、点击点位或动作详情。不要只看事件名字推测问题，最好回到产物证据本身。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
