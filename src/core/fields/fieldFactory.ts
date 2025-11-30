import type { FieldType } from "./types";

/**
 * 创建字段的辅助函数，简化字段定义
 */
export function createField(config: FieldType): FieldType {
  return config;
}

/**
 * 批量创建字段
 */
export function createFields(configs: FieldType[]): FieldType[] {
  return configs;
}
