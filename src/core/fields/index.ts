// 类型定义
export type { FieldType, FieldsType, ParamKeysType } from "./types.js";

// 枚举
export { FieldTypeEnum } from "./fieldTypes.js";

// 识别字段
export {
  recoFieldSchema,
  recoFieldSchemaKeyList,
  recoFields,
} from "./recognition/index.js";

// 动作字段
export {
  actionFieldSchema,
  actionFieldSchemaKeyList,
  actionFields,
} from "./action/index.js";

// 其他字段
export {
  otherFieldParams,
  otherFieldParamsWithoutFocus,
  otherFieldSchemaKeyList,
  otherFieldSchema,
  waitFreezesFields,
} from "./other/index.js";

// 工具函数
export { generateParamKeys, generateUpperValues } from "./utils.js";

// 辅助函数
export { createField, createFields } from "./fieldFactory.js";

// 生成参数键和大写值映射
import { recoFields } from "./recognition/index.js";
import { actionFields } from "./action/index.js";
import { generateParamKeys, generateUpperValues } from "./utils.js";

export const recoParamKeys = generateParamKeys(recoFields);
export const actionParamKeys = generateParamKeys(actionFields);
export const upperRecoValues = generateUpperValues(recoFields);
export const upperActionValues = generateUpperValues(actionFields);
