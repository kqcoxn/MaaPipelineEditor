import type { WikiModule } from "../../types";

const module: WikiModule = {
  id: "showcase",
  title: "功能展示",
  summary: "快速认识 FlowScope 调试工作台里的核心视图。",
  steps: [
    {
      id: "open-workbench",
      title: "打开调试工作台",
      summary: "主视图左上角的调试按钮会打开 FlowScope，而不是切换全局调试模式。",
      blocks: [
        {
          type: "paragraph",
          text: "点击左上角工具列表里的调试入口后，MPE 会打开 FlowScope 调试工作台。调试信息集中显示在工作台和画布覆盖层里，不再散落到节点字段面板。",
        },
        {
          type: "callout",
          calloutType: "info",
          title: "P1 示例内容",
          text: "这里先用短说明验证 Wiki 的条目、模块和步骤结构；后续阶段会替换为动图或视频教程。",
        },
      ],
    },
    {
      id: "read-results",
      title: "查看运行结果",
      summary: "用中控台、节点线、事件线和图像面板拆解一次调试运行。",
      blocks: [
        {
          type: "paragraph",
          text: "中控台负责运行控制和摘要，节点线按 Pipeline 节点聚合结果，事件线按 MaaFramework 事件顺序展开细节，图像面板用于查看截图和识别相关产物。",
        },
        {
          type: "code",
          language: "text",
          text: "入口节点 -> 运行 -> 节点线定位问题 -> 事件线查看证据 -> 图像面板核对产物",
        },
      ],
    },
  ],
};

export default module;
