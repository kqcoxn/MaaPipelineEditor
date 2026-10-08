import { parseIntegerList } from "../../../../core/parser/numericList";
import { normalizeFieldList } from "../../../../core/fields/listValues";
export { normalizeFieldList } from "../../../../core/fields/listValues";
import { FieldTypeEnum } from "../../../../core/fields";

/** 将固定坐标（含文本输入）转换为工具使用的矩形，不解析节点引用。 */
export function parseROIValue(
  value: unknown,
): [number, number, number, number] | undefined {
  const numbers = parseIntegerList(value);
  if (!numbers) return undefined;
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
