import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "delta-measure",
  title: "位移测量",
  summary: "位移测量用于生成单轴 `dx/dy` 数值，适合相对移动或偏移类动作参数。",
  searchText:
    "位移测量 dx dy 水平位移 垂直位移 单轴偏移 相对移动 截图工具",
  steps: [
    {
      id: "measure-single-axis",
      title: "区分单轴位移和矩形偏移",
      summary: "位移测量针对 `dx/dy`，不是 `roi_offset` 的四元组。",
      keywords: ["dx", "dy", "单轴位移"],
      searchText:
        "dx dy 单轴位移 roi_offset 区别 水平位移 垂直位移",
      blocks: [
        {
          type: "paragraph",
          text: "位移测量适合得到单轴的 `dx` 或 `dy` 值；如果你要的是一个矩形范围的整体偏移，应回到偏移测量模块而不是把这两类工具混用。",
        },
      ],
    },
    {
      id: "use-as-action-parameter",
      title: "优先用在相对移动参数里",
      summary: "当动作需要基于当前位置做小幅偏移时，`dx/dy` 更直接。",
      keywords: ["相对移动", "动作参数", "偏移"],
      searchText:
        "相对移动 动作参数 偏移 dx dy 复制键值对 位移测量",
      blocks: [
        {
          type: "paragraph",
          text: "当某个动作需要从当前落点再做水平或垂直小幅移动时，`dx/dy` 会比重新定义大范围 ROI 更直接。测量完成后，优先复制键值对回填到对应动作参数。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
