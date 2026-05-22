import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "tools-search",
  title: "工具与搜索",
  summary: "搜索和常用工具都属于编辑加速器，目标是更快找到节点和完成常见整理动作。",
  searchText:
    "工具与搜索 搜索节点 搜索面板 节点列表 AI搜索 常用工具 编辑加速器 工具箱 视图 排版 对齐 自动布局 分享 实时预览 流程探索",
  steps: [
    {
      id: "search-node-first",
      title: "先用搜索定位节点",
      summary: "当图变大时，搜索节点比手拖画布更高效。",
      keywords: ["搜索节点", "节点列表", "AI搜索", "统计"],
      searchText:
        "搜索节点 节点列表 跨文件搜索 当前文件 定位节点 搜索面板 AI搜索 统计 类型分组",
      blocks: [
        {
          type: "paragraph",
          text: "当节点数量变多后，优先用搜索框或节点列表定位目标节点。搜索面板支持当前文件定位和 AI 智能搜索（根据语义匹配节点）。",
        },
        {
          type: "paragraph",
          text: "节点列表面板提供按类型分组浏览和统计信息，适合快速了解当前文件的节点构成。",
        },
      ],
    },
    {
      id: "toolbox-entry",
      title: "工具箱提供独立入口",
      summary: "6 个字段快捷工具可以脱离字段面板独立使用。",
      keywords: ["工具箱", "OCR", "模板截图", "颜色取点", "ROI"],
      searchText:
        "工具箱 OCR 模板截图 颜色取点 ROI 区域选择 偏移测量 位移差值 独立入口 结果预览",
      blocks: [
        {
          type: "markdown",
          text: "工具箱中的 6 个工具可独立使用，不必先选中节点：\n- **OCR 识别**：截取屏幕文字\n- **模板截图**：捕获并保存模板图片\n- **颜色取点**：提取像素颜色值\n- **区域选择（ROI）**：框选感兴趣区域\n- **偏移测量**：计算两区域偏移量\n- **位移差值**：测量滚动距离",
        },
        {
          type: "paragraph",
          text: "工具结果可直接预览，也可复制到字段中使用。需要 LocalBridge 连接设备后才能使用。",
        },
      ],
    },
    {
      id: "view-and-layout-tools",
      title: "视图与排版工具",
      summary: "对齐、自动布局、路径高亮等帮助整理画布。",
      keywords: ["对齐", "等距", "自动布局", "路径高亮", "导出图片", "分享"],
      searchText:
        "对齐 等距 自动布局 路径高亮 聚焦透明 对齐辅助线 磁性吸附 导出图片 分享链接 实时预览 流程探索",
      blocks: [
        {
          type: "markdown",
          text: "- **视图工具**：聚焦透明度、路径高亮、对齐辅助线、磁性吸附\n- **排版工具**：对齐、等距分布、自动布局、导出为图片\n- **分享**：生成可分享的链接\n- **实时预览**：连接设备后实时显示设备画面\n- **流程探索**：AI 引导式构建线性流程",
        },
        {
          type: "callout",
          calloutType: "info",
          title: "通用工具",
          text: "设置、AI 历史记录、复制/粘贴、撤销/重做等通用操作也在工具栏中，支持标准快捷键。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
