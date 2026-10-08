import { FieldTypeEnum as T } from "./fieldTypes";
import type { FieldType } from "./types";
import { normalizeFieldList } from "./listValues";
import { parseDurationValue } from "../parser/duration";

type ListPasteResult = { value: unknown[]; error?: never } | { value?: never; error: string };
const object = (value: unknown) => value !== null && typeof value === "object" && !Array.isArray(value);
const ints = (value: unknown): value is number[] => Array.isArray(value) && value.every((n) => typeof n === "number" && Number.isSafeInteger(n));
const pair = (value: unknown) => Array.isArray(value) && value.length === 2 && value.every((item) => typeof item === "string");

/** 显式批量替换：整体校验后一次提交，不转换文本内容或丢弃非法项。 */
export function parseListPaste(text: string, field: FieldType): ListPasteResult {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return { error: "请输入完整的标准 JSON 数组，字符串需要使用英文双引号。" }; }
  if (!Array.isArray(parsed)) return { error: "请输入数组，例如 [1, 2]。" };
  const type = Array.isArray(field.type) ? field.type[0] : field.type;
  let value = normalizeFieldList(parsed, type);
  if (field.unit === "ms") {
    const durations = parseDurationValue(value, field.allowNegativeOne);
    if (!Array.isArray(durations)) return { error: "时间项需为整数毫秒或带 ms / s 单位的字符串，转换后必须是整数毫秒。" };
    value = durations;
  }
  let valid = false;
  switch (type) {
    case T.IntList: valid = ints(value); break;
    case T.DoubleList: valid = value.every((item) => typeof item === "number" && Number.isFinite(item)); break;
    case T.IntListList:
      valid = value.every((row) => ints(row) && row.length > 0 && row.length === (value[0] as unknown[])?.length);
      break;
    case T.XYWHList: valid = value.every((row) => ints(row) && row.length === 4); break;
    case T.PositionList:
      valid = value.every((item) => item === true || typeof item === "string" || (ints(item) && (item.length === 2 || item.length === 4)));
      break;
    case T.StringPairList: valid = value.every(pair); break;
    case T.StringList:
    case T.ImagePathList: valid = value.every((item) => typeof item === "string"); break;
    case T.IntOrStringList: valid = value.every((item) => typeof item === "string" || (typeof item === "number" && Number.isSafeInteger(item))); break;
    case T.ObjectList: valid = value.every(object); break;
    case T.StringOrObjectList: valid = value.every((item) => typeof item === "string" || object(item)); break;
  }
  return valid ? { value } : { error: `数组结构不符合 ${type}；请检查每项的类型、坐标长度或各行长度。` };
}
