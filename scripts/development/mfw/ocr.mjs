import * as fs from "node:fs/promises";
import path from "node:path";
import { downloadFile } from "./download.mjs";

// 与 LocalBridge/internal/install/package.go 的发布环境使用相同模型。
export const OCR_URL = "https://download.maafw.xyz/MaaCommonAssets/OCR/ppocr_v6/ppocr_v6-small.zip";
export const OCR_COMPONENT = path.join("resource", "model", "ocr");
const FILES = ["det.onnx", "rec.onnx", "keys.txt"];

export async function downloadOCR(destination, options) {
  console.log("Downloading OCR (ppocr_v6-small)");
  await downloadFile(OCR_URL, destination, {}, options);
}

export async function findOCR(directory) {
  const candidates = [];
  async function visit(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    if (entries.some(entry => entry.name === "det.onnx" && entry.isFile())) candidates.push(current);
    for (const entry of entries) if (entry.isDirectory()) await visit(path.join(current, entry.name));
  }
  await visit(directory);
  if (candidates.length !== 1) throw new Error("OCR 包中未找到唯一的模型目录");
  const root = candidates[0];
  for (const name of FILES) {
    const stat = await fs.lstat(path.join(root, name)).catch(error => {
      if (error.code === "ENOENT") throw new Error(`OCR 包缺少 ${name}`);
      throw error;
    });
    if (!stat.isFile() || !stat.size) throw new Error(`OCR 包的 ${name} 必须是非空文件`);
  }
  return root;
}
