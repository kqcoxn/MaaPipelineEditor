import { expect, it, vi } from "vitest";
import { matchParamType } from "./typeMatchers";
import { FieldTypeEnum as T, type FieldType } from "../fields";
import { recoFieldSchema } from "../fields/recognition/schema";
import { actionFieldSchema } from "../fields/action/schema";
import { parseROIValue } from "../../components/panels/field/items/fieldValueUtils";

vi.mock("@/utils/ui/antdAppApi", () => ({ notification: { error: vi.fn() } }));

const parseField = (field: FieldType, value: unknown, skipValidation = false) =>
  matchParamType({ [field.key]: value }, [field], skipValidation);

const parse = (type: T, value: unknown) => matchParamType({ value }, [{ key: "value", type, default: null, desc: "" }]);

it("坐标导出和快捷工具使用同一套英文逗号简写", () => {
  for (const value of ["200, 300,1,1", "[200,300,1,1]", [200, 300, 1, 1]]) {
    expect(parseField(actionFieldSchema.clickTarget, value).target).toEqual([200, 300, 1, 1]);
    expect(parseROIValue(value)).toEqual([200, 300, 1, 1]);
  }
  expect(parse(T.IntPair, "-10,20")).toEqual({ value: [-10, 20] });
  expect(parse(T.IntList, "1,2,3")).toEqual({ value: [1, 2, 3] });
  expect(parse(T.DoubleList, "0.7, 0.8")).toEqual({ value: [0.7, 0.8] });
  expect(parse(T.XYWHList, ["1,2,3,4", "5,6,7,8"])).toEqual({ value: [[1, 2, 3, 4], [5, 6, 7, 8]] });
});

it.each(["1，2，3，4", "1,,3,4", "1 0,2,3,4", "[[1,2],[3,4]]", "[1,2,3,4", [null, 2, 3, 4], [true, 2, 3, 4], [Infinity, 2, 3, 4]])(
  "无效坐标不被清洗成有效数字：%j", (value) => {
    expect(parse(T.XYWH, value)).toEqual({});
    expect(parseROIValue(value)).toBeUndefined();
  },
);

it("颜色列表保留内层结构，包括单通道", () => {
  for (const [value, expected] of [
    [["0,128,255", "1,2,3"], [[0, 128, 255], [1, 2, 3]]],
    [[[1], [2]], [[1], [2]]],
    [[1, 2, 3], [1, 2, 3]],
  ]) expect(parseField(recoFieldSchema.lower, value).lower).toEqual(expected);
});

it("文本标点和数字形式节点名原样保留", () => {
  const text = 'hello world，[a,b] “文本” "引号"';
  expect(parse(T.StringList, [text])).toEqual({ value: [text] });
  expect(parse(T.PositionList, ["1", "2", "1，2", text])).toEqual({ value: ["1", "2", "1，2", text] });
  expect(parse(T.Any, "{“x”:10}")).toEqual({ value: "{“x”:10}" });
});

it("替换规则保留原始内容，拒绝简写和不完整规则而非丢掉其中一项", () => {
  for (const replace of [["a,b", "c,d"], [['[a b]，"', ' “替换” '], ["x", ""]]]) {
    expect(parseField(recoFieldSchema.replace, replace)).toEqual({ replace });
  }
  for (const replace of ["key,value", "key，value", [["a", "b"], "c,d"], [["a"]]]) {
    expect(parseField(recoFieldSchema.replace, replace)).toEqual({});
    expect(parseField(recoFieldSchema.replace, replace, true)).toEqual({ replace });
  }
});
