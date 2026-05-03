import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "roi-offset",
  title: "偏移测量",
  summary: "偏移测量工具适合为 roi_offset、dx/dy 一类相对位移字段提供基准值。",
  searchText:
    "偏移测量 roi_offset 位移 dx dy 相对坐标 两点距离 字段快捷工具",
  steps: [
    {
      id: "measure-offset",
      title: "先确认基准点，再测相对偏移",
      summary: "偏移不是绝对位置，而是相对于已有范围或目标点的位移。",
      keywords: ["roi_offset", "偏移", "相对坐标"],
      searchText:
        "roi_offset 偏移 相对坐标 基准点 两点测量 目标点 字段",
      blocks: [
        {
          type: "paragraph",
          text: "偏移测量更适合处理相对于已有区域或目标点的变化量，而不是直接给出绝对位置。测量前先确认基准点，否则算出来的偏移值很容易方向反了或基准错位。",
        },
      ],
    },
    {
      id: "reuse-offset",
      title: "把偏移和 ROI 一起理解",
      summary: "偏移通常不是独立字段，而是 ROI 的延伸描述。",
      keywords: ["ROI", "偏移", "位移"],
      searchText:
        "ROI 偏移 位移 组合使用 roi_offset 先框选再测偏移",
      blocks: [
        {
          type: "paragraph",
          text: "很多时候偏移字段并不会单独存在，而是建立在某个 ROI 已经成立的前提下。建议先把主 ROI 定下来，再测补充偏移，这样更容易理解最终落点。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
