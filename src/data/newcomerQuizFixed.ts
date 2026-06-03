import type { QuizQuestion } from "./newcomerQuiz";

/**
 * 固定题目（基本常识）
 * 全部作答，必须 100% 正确才能通过
 * 该部分对MaaFw的基础知识和模板教学内容进行考察
 */
export const fixedQuestions: QuizQuestion[] = [
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
    question: "新手开发 MaaFW 项目时，可以自行创建文件夹结构。",
    options: ["正确", "错误"],
    answer: 1,
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
    question: "MaaFW 中一个 Task（任务）指的是什么？",
    options: [
      "一个 JSON 文件",
      "若干 Node 连接起来的结构",
      "一个 pipeline 文件夹里的所有 JSON 文件的总称",
      "JSON 文件中的一个对象",
    ],
    answer: 1,
  },
  {
    type: "judge",
    question:
      "有关 interface.json 文件的填写方法可以在 MaaFw 手册的 3.2 章节看到。",
    options: ["正确", "错误"],
    answer: 1,
  },

  {
    type: "choice",
    question: "以下哪个工具中是官方推荐的 interface.json 的编辑工具？",
    options: [
      "Maa Pipeline Editor",
      "MaaDebugger",
      "Visual Studio",
      "Visual Studio Code",
    ],
    answer: 3,
  },
  {
    type: "choice",
    question: "以下项目中哪个是在 MaaFw 手册中指定的最佳实践参考？",
    options: ["Maa", "M9A", "MPE", "MFAAvalonia"],
    answer: 2,
  },
];
