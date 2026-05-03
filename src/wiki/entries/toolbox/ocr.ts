import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "ocr",
  title: "OCR",
  summary: "OCR 工具用于从截图中读取文本，并快速回填 expected 等字段。",
  searchText:
    "OCR 文字识别 expected 截图 识别文本 字段快捷工具 LocalBridge 设备连接",
  steps: [
    {
      id: "capture-text",
      title: "先拿到截图，再选中文本区域",
      summary: "OCR 的准确度首先取决于截图来源和框选范围。",
      keywords: ["截图", "文字区域", "expected"],
      searchText:
        "OCR 截图 文字区域 expected 识别范围 设备连接 模板截图",
      blocks: [
        {
          type: "paragraph",
          text: "OCR 工具适合为 expected 等文本字段取值。先确保你拿到的是正确截图，再框选真正需要识别的文字区域；如果范围过大或画面不稳定，结果通常会先变差。",
        },
      ],
    },
    {
      id: "reuse-result",
      title: "把结果作为字段初值，而不是最终真理",
      summary: "OCR 更适合作为起点，之后仍应结合画面验证。",
      keywords: ["字段回填", "验证结果"],
      searchText:
        "OCR 字段回填 expected 验证结果 识别文本 人工复核",
      blocks: [
        {
          type: "paragraph",
          text: "OCR 的价值在于减少手输，而不是替代复核。把识别结果先填回字段后，再结合实际截图确认文本、大小写、空格和范围是否符合预期。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
