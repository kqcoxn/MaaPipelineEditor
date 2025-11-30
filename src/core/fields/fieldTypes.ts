/**
 * 字段类型枚举
 */
export enum FieldTypeEnum {
  Int = "int",
  Double = "double",
  True = "true",
  Bool = "bool",
  String = "string",
  IntList = "list<int, >",
  IntListList = "list<list<int, >>",
  DoubleList = "list<double, >",
  StringList = "list<string, >",
  XYWH = "array<int, 4>",
  XYWHList = "list<array<int, 4>>",
  PositionList = "list<true | string | array<int, 4>>",
  IntPair = "array<int, 2>",
  StringPair = "array<string, 2>",
  StringPairList = "list<array<string, 2>>",
  Any = "any",
  ObjectList = "list<object,>",
}
