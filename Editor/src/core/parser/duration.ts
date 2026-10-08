import type { FieldType } from "../fields/types";

/** 时间输入必须能精确表示为整数毫秒，不四舍五入、不执行表达式。 */
export function parseMilliseconds(value: unknown, allowNegativeOne = false): number | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && (value >= 0 || (allowNegativeOne && value === -1)) ? value : null;
  }
  if (typeof value !== "string" || value.length > 100) return null;
  const text = value.trim();
  if (allowNegativeOne && /^-1\s*(?:ms)?$/.test(text)) return -1;
  const match = /^\+?(\d+)(?:\.(\d+))?\s*(ms|s)?$/.exec(text);
  if (!match) return null;
  const fraction = match[2] ?? "";
  const scale = match[3] === "s" ? 3 : 0;
  if (/[1-9]/.test(fraction.slice(scale))) return null;
  const integer = BigInt(match[1]) * (scale === 3 ? 1000n : 1n);
  const milliseconds = integer + BigInt(fraction.slice(0, scale).padEnd(scale, "0") || "0");
  return milliseconds <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(milliseconds) : null;
}

export function parseDurationValue(value: unknown, allowNegativeOne = false): number | number[] | null {
  if (!Array.isArray(value)) return parseMilliseconds(value, allowNegativeOne);
  const result = value.map((item) => parseMilliseconds(item, allowNegativeOne));
  return result.every((item) => item !== null) ? result : null;
}

/** 等待画面静止的对象形式只转换明确定义的时间子字段。 */
export function normalizeDurationField(value: unknown, field: FieldType): unknown {
  if (field.params && value !== null && typeof value === "object" && !Array.isArray(value)) {
    const result: Record<string, unknown> = { ...value };
    for (const child of field.params) {
      if (child.unit !== "ms" || !(child.key in result)) continue;
      const converted = normalizeDurationField(result[child.key], child);
      if (converted === null) return null;
      result[child.key] = converted;
    }
    return result;
  }
  return parseDurationValue(value, field.allowNegativeOne);
}
