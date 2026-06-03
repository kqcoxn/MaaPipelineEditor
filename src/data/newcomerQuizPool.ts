import type { QuizQuestion } from "./newcomerQuiz";

/**
 * 随机题库（常用技巧/小知识）
 * 随机抽取 10 题，60% 正确率（6题）即可通过
 * 该部分对MaaFw的进阶知识进行考察
 */
export const questionPool: QuizQuestion[] = [
  {
    type: "judge",
    question:
      "修改节点的 timeout 字段不能解决当前节点 recognition 命中时间超时的问题。",
    options: ["正确", "错误"],
    answer: 0,
  },
  {
    type: "choice",
    question: "对于某个节点的 on_error 列表，以下说法错误的是？",
    options: [
      "节点自身的 next 指向的节点识别超时会进入",
      "节点自身的 action 执行失败时会进入",
      "进入 on_error 列表后不会对列表内的节点进行识别",
      "节点自身的 recognition 未命中并超时不会进入",
    ],
    answer: 2,
  },
  {
    type: "choice",
    question: "当一个节点的 next 列表中有多个子节点时，MaaFW 如何处理？",
    options: [
      "同时并行识别所有子节点",
      "随机选择一个子节点执行",
      "循环按顺序逐个识别，命中某一个后立即进入并向后执行子链",
      "等待所有子节点都识别成功后再执行",
    ],
    answer: 2,
  },
  {
    type: "judge",
    question: "只有在 action 执行失败时才会进入 on_error 列表。",
    options: ["正确", "错误"],
    answer: 1,
  },
  {
    type: "choice",
    question: "在 next 列表中使用 [JumpBack] 属性的节点，被命中后会发生什么？",
    options: [
      "任务直接终止",
      "立即返回父节点，不执行该节点的后续链",
      "执行该节点及其后续节点链，全部完成后再返回父节点继续识别",
      "跳转到 on_error 列表",
    ],
    answer: 2,
  },
  {
    type: "multi",
    question: "以下哪些情况会导致 MaaFW 任务流程终止？",
    options: [
      "由 jumpback 进入子链，执行 action 后，当前节点的 next 列表为空。",
      "执行 action 后，当前节点的 next 列表识别超时，且未配置 on_error",
      "当前节点的 action 执行失败，且未配置 on_error",
      "当前节点执行 StopTask action",
    ],
    answer: [1, 2, 3],
  },
  {
    type: "judge",
    question: "目标图形在 ROI（Region of Interest）的范围外不会被识别到。",
    options: ["正确", "错误"],
    answer: 0,
  },
  {
    type: "choice",
    question: "MaaFW 中，Entry 指的是什么？",
    options: [
      "Pipeline 文件夹的入口文件",
      "一个 Task 中的第一个 Node",
      "应用程序的启动配置",
      "资源加载的起始路径",
    ],
    answer: 1,
  },
  {
    type: "choice",
    question: "TemplateMatch 使用的模板图片默认应缩放到什么分辨率？",
    options: ["480p", "720p", "1080p", "原始分辨率"],
    answer: 1,
  },
  {
    type: "judge",
    question:
      "在 recognition 使用 TemplateMatch 时需要了解 YOLO 算法的具体原理。",
    options: ["正确", "错误"],
    answer: 1,
  },
  {
    type: "choice",
    question: "项目开发完成后社区推荐用哪种方法进行多平台打包？",
    options: [
      "自行在本地将资源和通用 UI 组装打包到一个压缩包中",
      "在自己的电脑上使用跨平台工具链编译通用 UI",
      "在自己的电脑上使用跨平台工具链编译 MaaFramework",
      "用 git 标记版本 tag 并推送到 github",
    ],
    answer: 3,
  },
];
