import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "ocr",
  title: "OCR",
  summary: "OCR 工具用于从截图中读取文本，并快速回填 expected 等字段。",
  searchText:
    "OCR 文字识别 expected 截图 识别文本 字段快捷工具 LocalBridge 设备连接 前端OCR 原生OCR Tesseract MaaFramework",
  steps: [
    {
      id: "capture-text",
      title: "先拿到截图，再选中文本区域",
      summary: "OCR 的准确度首先取决于截图来源和框选范围。",
      keywords: ["截图", "文字区域", "expected", "框选"],
      searchText:
        "OCR 截图 文字区域 expected 识别范围 设备连接 模板截图 框选 缩放 拖动",
      blocks: [
        {
          type: "paragraph",
          text: "OCR 工具适合为 expected 等文本字段取值。先确保你拿到的是正确截图，再框选真正需要识别的文字区域；如果范围过大或画面不稳定，结果通常会先变差。",
        },
        {
          type: "paragraph",
          text: "框选时可以缩放和拖动截图来精确定位文字区域，尽量只框住目标文字，避免包含多余背景。",
        },
      ],
    },
    {
      id: "ocr-modes",
      title: "两种识别模式",
      summary: "前端 OCR 基于当前截图，原生 OCR 会重新截取设备画面。",
      keywords: ["前端OCR", "原生OCR", "Tesseract", "MaaFramework"],
      searchText:
        "前端OCR 原生OCR Tesseract MaaFramework 模式选择 多语言 重新截取",
      blocks: [
        {
          type: "markdown",
          text: "- **前端 OCR（Tesseract.js）**：基于当前已有截图识别，支持多语言，无需额外配置\n- **原生 OCR（MaaFramework）**：通过 LocalBridge 调用 MaaFramework 重新截取设备画面并识别，结果更贴近实际运行效果",
        },
        {
          type: "callout",
          calloutType: "info",
          title: "如何选择",
          text: "快速验证文字内容用前端 OCR 即可；需要确认运行时实际识别效果时，用原生 OCR 更准确。",
        },
      ],
    },
    {
      id: "reuse-result",
      title: "把结果作为字段初值，而不是最终真理",
      summary: "OCR 更适合作为起点，之后仍应结合画面验证。",
      keywords: ["字段回填", "验证结果", "编辑"],
      searchText:
        "OCR 字段回填 expected 验证结果 识别文本 人工复核 编辑结果 确认",
      blocks: [
        {
          type: "paragraph",
          text: "OCR 的价值在于减少手输，而不是替代复核。识别结果支持手动编辑修正，确认无误后再回填到字段中。注意检查大小写、空格和特殊字符是否正确。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
