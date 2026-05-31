import type { QuizQuestion } from "./newcomerQuiz";

/**
 * 随机题库（常用技巧/小知识）
 * 随机抽取 10 题，60% 正确率（6题）即可通过
 */
export const questionPool: QuizQuestion[] = [
  {
    type: "choice",
    question: "Node 的 recognition 字段默认值是什么？",
    options: ["TemplateMatch", "OCR", "DirectHit", "Custom"],
    answer: 2,
  },
  {
    type: "choice",
    question: "Node 的 action 字段默认值是什么？",
    options: ["Click", "DoNothing", "Swipe", "StopTask"],
    answer: 1,
  },
  {
    type: "judge",
    question: "Pipeline 中的 JSON 文件名必须与节点名称保持一致。",
    options: ["正确", "错误"],
    answer: 1,
  },
  {
    type: "choice",
    question: "节点的 next 列表识别超时后，会进入哪个列表？",
    options: ["next", "interrupt", "on_error", "retry"],
    answer: 2,
  },
  {
    type: "judge",
    question: "ROI（Region of Interest）是指定义图像识别边界的区域。",
    options: ["正确", "错误"],
    answer: 0,
  },
  {
    type: "choice",
    question: "MaaFW 中，一个标准的 Bundle 通常包含哪些文件夹？",
    options: [
      "src、dist、config",
      "pipeline、model、image 等",
      "assets、scripts、styles",
      "input、output、temp",
    ],
    answer: 1,
  },
  {
    type: "judge",
    question: "一个 pipeline 文件夹中只能存放一个 JSON 文件。",
    options: ["正确", "错误"],
    answer: 1,
  },
  {
    type: "choice",
    question: "TemplateMatch（模板匹配）的默认阈值（threshold）是多少？",
    options: ["0.5", "0.7", "0.8", "0.9"],
    answer: 1,
  },
  {
    type: "judge",
    question: "节点的 next 列表中，所有子节点都会被依次执行。",
    options: ["正确", "错误"],
    answer: 1,
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
    question:
      "TemplateMatch 使用的模板图片默认应缩放到什么分辨率？",
    options: ["480p", "720p", "1080p", "原始分辨率"],
    answer: 1,
  },
  {
    type: "judge",
    question:
      "MaaFW 的 pipeline 文件夹会递归读取其中所有 JSON 文件，不限制文件数量和嵌套层级。",
    options: ["正确", "错误"],
    answer: 0,
  },
  {
    type: "choice",
    question: "OCR 模型文件夹中需要包含哪些文件？",
    options: [
      "model.bin、config.json",
      "det.onnx、rec.onnx、keys.txt",
      "ocr.pth、vocab.txt",
      "detect.tflite、recognize.tflite",
    ],
    answer: 1,
  },
  {
    type: "multi",
    question: "以下哪些属于 MaaFW 支持的识别算法（recognition）类型？",
    options: [
      "TemplateMatch",
      "OCR",
      "RegexMatch",
      "ColorMatch",
    ],
    answer: [0, 1, 3],
  },
  {
    type: "multi",
    question: "以下哪些属于 MaaFW 支持的动作（action）类型？",
    options: [
      "Click",
      "Swipe",
      "Drag",
      "StartApp",
    ],
    answer: [0, 1, 3],
  },
  {
    type: "multi",
    question: "一个 MaaFW Node 的核心属性包括哪些？",
    options: [
      "recognition（识别算法）",
      "action（执行动作）",
      "next（后续节点列表）",
      "priority（优先级）",
    ],
    answer: [0, 1, 2],
  },
];
