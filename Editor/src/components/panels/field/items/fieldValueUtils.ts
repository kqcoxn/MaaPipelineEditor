import { FieldTypeEnum } from "../../../../core/fields";

/** 列表中的颜色、坐标数组应作为一个完整的值。 */
export function normalizeFieldList(value: unknown, type: string): unknown[] {
  if (!Array.isArray(value)) return [value];
  if (
    (type === FieldTypeEnum.IntListList ||
      type === FieldTypeEnum.XYWHList ||
      type === FieldTypeEnum.PositionList) &&
    value.length > 0 &&
    value.every((item) => typeof item === "number")
  ) {
    return [value];
  }
  return value;
}

/** 将固定坐标（含文本输入）转换为工具使用的矩形，不解析节点引用。 */
export function parseROIValue(
  value: unknown,
): [number, number, number, number] | undefined {
  const numbers = typeof value === "string"
    ? value.replace(/[\s[\]]/g, "").split(/[,，]/).map(Number)
    : value;
  if (!Array.isArray(numbers) || !numbers.every(Number.isInteger)) {
    return undefined;
  }
  if (numbers.length === 2) return [numbers[0], numbers[1], 1, 1];
  if (numbers.length === 4) {
    return numbers as [number, number, number, number];
  }
  return undefined;
}

/** 在与界面相同的列表结构中读取所选坐标，避免把 x/y 当作列表项。 */
export function getROIValue(value: unknown, index: number | null) {
  return parseROIValue(
    index === null
      ? value
      : normalizeFieldList(value, FieldTypeEnum.PositionList)[index],
  );
}
