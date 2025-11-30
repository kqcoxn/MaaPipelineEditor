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
