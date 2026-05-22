import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "delta-measure",
  title: "位移测量",
  summary: "位移测量用于生成单轴 `dx/dy` 数值，适合相对移动或偏移类动作参数。",
  searchText:
    "位移测量 dx dy 水平位移 垂直位移 单轴偏移 相对移动 截图工具 拖拽 滚动距离",
  steps: [
    {
      id: "measure-single-axis",
      title: "区分单轴位移和矩形偏移",
      summary: "位移测量针对 `dx/dy`，不是 `roi_offset` 的四元组。",
      keywords: ["dx", "dy", "单轴位移", "区别"],
      searchText:
        "dx dy 单轴位移 roi_offset 区别 水平位移 垂直位移 滚动",
      blocks: [
        {
          type: "paragraph",
          text: "位移测量适合得到单轴的 dx 或 dy 值（如滚动距离）；如果你要的是一个矩形范围的整体偏移 [dx, dy, dw, dh]，应回到偏移测量模块。",
        },
        {
          type: "callout",
          calloutType: "info",
          title: "平台限制",
          text: "滚动类操作（Swipe）在 Win32 控制器下支持最完整，ADB 控制器的滚动精度可能受设备影响。",
        },
      ],
    },
    {
      id: "drag-to-measure",
      title: "拖拽测量操作步骤",
      summary: "在截图上拖拽起点到终点，实时显示位移值。",
      keywords: ["拖拽", "起点", "终点", "实时显示"],
      searchText:
        "拖拽 起点 终点 实时显示 位移值 手动调整 精确输入",
      blocks: [
        {
          type: "code",
          language: "text",
          text: "在截图上按住拖拽：起点 → 终点 → 实时显示 dx/dy 值",
        },
        {
          type: "paragraph",
          text: "拖拽过程中实时显示起点坐标、终点坐标和位移差值。松开后可以手动微调数值进行精确输入，确认后复制到对应字段。",
        },
      ],
    },
    {
      id: "use-as-action-parameter",
      title: "优先用在相对移动参数里",
      summary: "当动作需要基于当前位置做小幅偏移时，dx/dy 更直接。",
      keywords: ["相对移动", "动作参数", "偏移", "Swipe"],
      searchText:
        "相对移动 动作参数 偏移 dx dy 复制键值对 位移测量 Swipe",
      blocks: [
        {
          type: "paragraph",
          text: "当某个动作需要从当前落点再做水平或垂直移动时（如 Swipe 滑动），dx/dy 会比重新定义大范围 ROI 更直接。测量完成后，优先复制键值对回填到对应动作参数。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
