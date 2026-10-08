/** 数值输入仅接受十进制数字、英文逗号和可选的一层方括号。 */
export function parseNumericList(value: unknown): number[] | null {
  let items: unknown[];
  if (Array.isArray(value)) {
    items = value;
  } else if (typeof value === "string") {
    let text = value.trim();
    if (text.startsWith("[") && text.endsWith("]")) text = text.slice(1, -1).trim();
    if (!text) return null;
    items = text.split(",");
  } else {
    return null;
  }
  const numbers: number[] = [];
  for (const item of items) {
    if (typeof item !== "number" && (typeof item !== "string" ||
      !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(item.trim()))) return null;
    const number = Number(item);
    if (!Number.isFinite(number)) return null;
    numbers.push(number);
  }
  return numbers;
}

export function parseIntegerList(value: unknown): number[] | null {
  const numbers = parseNumericList(value);
  return numbers?.every(Number.isInteger) ? numbers : null;
}
