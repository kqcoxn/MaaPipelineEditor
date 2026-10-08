export type RegexInputMode = "raw" | "json";

/** 转义仅用于表单展示，不用于文件导入或内部状态。 */
export function formatRegexInput(value: string, mode: RegexInputMode): string {
  return mode === "json" ? JSON.stringify(value).slice(1, -1) : value;
}

export function parseRegexInput(text: string, mode: RegexInputMode): string {
  if (mode !== "json") return text;
  const value: unknown = JSON.parse(`"${text}"`);
  if (typeof value !== "string") throw new Error("请输入 JSON 转义文本");
  return value;
}

export const regexInputError = String.raw`JSON 转义无效，本次输入未应用。反斜杠请写成 \\，双引号写成 \"，不加外围双引号。`;
