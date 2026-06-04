import type { QuizQuestion } from "./newcomerQuiz";

/**
 * 固定题目（基本常识）
 * 全部作答，必须 100% 正确才能通过
 * 该部分对 MaaFW 的基础知识、模板教学内容和核心流程机制进行考察
 */
export const fixedQuestions: QuizQuestion[] = [
  {
    type: "judge",
    question:
      "MaaPipelineEditor (MPE) 可以完全替代学习 MaaFramework，不需要先了解 MaaFW 就能直接使用。",
    options: ["正确", "错误"],
    answer: 1,
  },
  {
    type: "judge",
    question: "现在可以直接在 MaaPipelineEditor (MPE) 创建全新的空白项目。",
    options: ["正确", "错误"],
    answer: 1,
  },
  {
    type: "input",
    question: "MaaFw (MaaFramework) 的项目模板仓库地址是？",
    // 包含即可，免得出现http或者.git之类的写法
    include: "MaaXYZ/MaaPracticeBoilerplate",
  },
  {
    type: "choice",
    question: "从模板仓库创建项目必须要按哪个按钮？",
    options: ["Download ZIP", "Use this template", "新建文件夹", "Release"],
    answer: 1,
  },
  {
    type: "judge",
    question:
      "新手开发 MaaFW 项目时，推荐使用官方模板项目（MaaPracticeBoilerplate）作为起点，而不是自行创建文件夹结构。",
    options: ["正确", "错误"],
    answer: 0,
  },
  {
    type: "multi",
    question:
      "一个标准的 MaaFW 资源（Resource）文件夹结构中，应该包含哪些子文件夹？",
    options: [
      "pipeline（任务流程）",
      "image（图片素材）",
      "model（模型文件）",
      "config（项目配置）",
    ],
    answer: [0, 1, 2],
  },
  {
    type: "judge",
    question:
      "开发自己的 MaaFW 项目时不需要再单独下载 OCR 模型，项目模板或 MPE 会自行处理。",
    options: ["正确", "错误"],
    answer: 1,
  },
  {
    type: "choice",
    question:
      "项目目录下的 assets/resource/model/ocr 文件夹中需要包含哪些文件？",
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
    question: "MaaFW 中，Pipeline 的基本格式是什么？",
    options: [
      "XML 格式描述的任务流程",
      "JSON 格式描述的若干节点（Node）",
      "YAML 格式的配置文件",
      "纯文本脚本",
    ],
    answer: 1,
  },
  {
    type: "choice",
    question: "MaaFW 中 Task（任务）指的是什么？",
    options: [
      "单个 JSON 文件",
      "若干 Node 按一定顺序连接的逻辑序列结构",
      "一个 pipeline 文件夹",
      "一次完整的应用启动过程",
    ],
    answer: 1,
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
    question: "对于非入口节点，哪些情况下会进入当前节点的 on_error 列表？",
    options: [
      "当前节点自身 recognition 未命中并超时",
      "当前节点所有 next 指向的节点识别超时",
      "当前节点的 action 失败",
      "当前节点进入的 next 节点 action 失败",
    ],
    answer: [1, 2],
  },
  {
    type: "multi",
    question: "对于入口节点（Entry），哪些情况下会进入其 on_error 列表？",
    options: [
      "入口节点自身 recognition 未命中并超时",
      "入口节点所有 next 指向的节点识别超时",
      "入口节点的 action 执行失败",
      "入口节点进入的 next 节点 action 失败",
    ],
    answer: [0, 1, 2],
  },
  {
    type: "multi",
    question: "以下哪些情况会导致 MaaFW 任务流程终止？",
    options: [
      "执行 action 后，当前节点的 next 列表为空，且非由 jumpback 进入此子链",
      "执行 action 后，当前节点的 next 列表识别超时，且未配置 on_error",
      "当前节点的 action 执行失败，且未配置 on_error",
      "当前节点执行 StopTask action 或直接调用 post_stop() 函数",
    ],
    answer: [0, 1, 2, 3],
  },
  {
    type: "choice",
    question:
      "MaaFW 项目中，interface.json（PI 协议）的作用是什么？（MPE 只负责处理 Pipeline，不负责处理 interface）",
    options: [
      "定义 Pipeline 节点的识别算法",
      "声明项目结构，使通用 UI 能正确加载和运行项目",
      "配置 OCR 模型的参数",
      "存储用户的运行日志",
    ],
    answer: 1,
  },
  {
    type: "judge",
    question:
      "有关 interface.json 文件的填写方法可以在 MaaFW 手册的 3.2 章节看到。",
    options: ["正确", "错误"],
    answer: 1,
  },
  {
    type: "choice",
    question: "以下哪个工具为 MaaFW 类项目提供了 JSON 文件的内容检查功能？",
    options: [
      "Maa Pipeline Editor 的 maa-support-extension 插件",
      "PyCharm 的 maa-support-extension 插件",
      "Visual Studio 的 maa-support-extension 插件",
      "Visual Studio Code 的 maa-support-extension 插件",
    ],
    answer: 3,
  },
  {
    type: "choice",
    question: "以下项目中哪个是在 MaaFW 手册中指定的最佳实践参考？",
    options: ["Maa", "M9A", "MPE", "MFAAvalonia"],
    answer: 2,
  },
];
