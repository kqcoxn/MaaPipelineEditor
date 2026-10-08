import { FieldTypeEnum } from "./fieldTypes";

/** 仅对形状明确的复合单项补一层；字符串数组绝不按内容拆分。 */
export function normalizeFieldList(value: unknown, type: string): unknown[] {
  if (!Array.isArray(value)) return [value];
  if (type === FieldTypeEnum.StringPairList && value.length === 2 && value.every((item) => typeof item === "string")) return [value];
  const integers = value.length > 0 && value.every((item) => typeof item === "number" && Number.isInteger(item));
  if (integers && (
    type === FieldTypeEnum.IntListList ||
    (type === FieldTypeEnum.XYWHList && value.length === 4) ||
    (type === FieldTypeEnum.PositionList && (value.length === 2 || value.length === 4))
  )) return [value];
  return value;
}
