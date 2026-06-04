import type { QuizQuestion } from "./newcomerQuiz";

/**
 * 随机题库（常用技巧/小知识）
 * 随机抽取 10 题，60% 正确率（6题）即可通过
 * 该部分对 MaaFW 的进阶知识进行考察
 */
export const questionPool: QuizQuestion[] = [
  {
    type: "choice",
    question: "节点的 next 列表识别超时后，会进入哪个列表？",
    options: ["next", "interrupt", "on_error", "retry"],
    answer: 2,
  },
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
    type: "judge",
    question: "只有在 action 执行失败时才会进入 on_error 列表。",
    options: ["正确", "错误"],
    answer: 1,
  },
  {
    type: "judge",
    question: "ROI（Region of Interest）是指定义图像识别边界的区域。",
    options: ["正确", "错误"],
    answer: 0,
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
      "MaaFW 的 pipeline 文件夹会递归读取其中所有 JSON 文件，不限制文件数量和嵌套层级。",
    options: ["正确", "错误"],
    answer: 0,
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
