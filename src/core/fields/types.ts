import type { FieldTypeEnum } from "./fieldTypes.js";

/**
 * 字段类型定义
 */
export type FieldType = {
  key: string;
  type: FieldTypeEnum | FieldTypeEnum[];
  required?: boolean;
  options?: any[];
  default: any;
  step?: number;
  desc: string;
  params?: FieldType[];  // 子字段参数列表,用于支持结构化字段(如 focus)
  displayName?: string;  // UI 显示名称,用于显示缩写
};

/**
 * 字段集合类型定义
 */
export type FieldsType = {
  params: FieldType[];
  desc: string;
};

/**
 * 参数键类型定义
 */
export type ParamKeysType = {
  all: string[];
  requires: string[];
  required_default: any[];
};
