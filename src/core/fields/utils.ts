import type { FieldsType, ParamKeysType } from "./types";

/**
 * 从字段配置生成参数键映射
 */
export function generateParamKeys(
  fields: Record<string, FieldsType>
): Record<string, ParamKeysType> {
  const result: Record<string, ParamKeysType> = {};

  Object.keys(fields).forEach((fieldKey) => {
    const field = fields[fieldKey];
    result[fieldKey] = {
      all: field.params.map((param) => param.key),
      requires: field.params.flatMap((param) =>
        param.required ? param.key : []
      ),
      required_default: field.params.flatMap((param) =>
        param.required ? param.default : []
      ),
    };
  });

  return result;
}

/**
 * 生成大写值映射
 */
export function generateUpperValues(
  fields: Record<string, FieldsType>
): Record<string, string> {
  const result: Record<string, string> = {};

  Object.keys(fields).forEach((fieldKey) => {
    result[fieldKey.toUpperCase()] = fieldKey;
  });

  return result;
}
