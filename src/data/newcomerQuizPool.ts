import type { QuizQuestion } from "./newcomerQuiz";

/**
 * 随机题库（常用技巧/小知识）
 * 随机抽取 10 题，60% 正确率（6题）即可通过
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
    question: "ROI（Region of Interest）是指定义图像识别边界的区域。",
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
];
