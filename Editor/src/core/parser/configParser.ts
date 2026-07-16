import type { PipelineConfigType } from "./types";
import { configMark } from "./types";

/**
 * 判断是否是配置键
 * @param key 键名
 * @returns 是否为配置键
 */
export function isConfigKey(key: string): boolean {
  return (
    key.startsWith("$__mpe_config_") ||
    key.startsWith("__mpe_config_") ||
    key.startsWith("__yamaape_config_")
  );
}

/**
 * 判断是否是标记字段
 * @param key 键名
 * @returns 是否为标记字段
 */
export function isMark(key: string): boolean {
  return key === configMark || key === "__mpe_code" || key === "__yamaape";
}

/**
 * 获取配置标记对象 - 兼容新旧版本
 * @param configObj 配置对象
 * @returns 配置标记内容
 */
export function getConfigMark(configObj: any): any {
  if (configObj[configMark]) {
    return configObj[configMark];
  } else if (configObj["__mpe_code"]) {
    return configObj["__mpe_code"];
  } else if (configObj["__yamaape"]) {
    return configObj["__yamaape"];
  }
  return null;
}

/**
 * 解析Pipeline配置
 * @param pipelineObj Pipeline对象
 * @returns 解析后的配置
 */
export function parsePipelineConfig(pipelineObj: any): PipelineConfigType {
  const configs: PipelineConfigType = {};
  const objKeys = Object.keys(pipelineObj);

  // 查找配置键
  const configKey = objKeys.find((objKey) => isConfigKey(objKey));
  if (!configKey) {
    return configs;
  }

  let configObj = pipelineObj[configKey];

  // 兼容新旧版本的配置标记
  const markedConfig = getConfigMark(configObj);
  if (markedConfig) {
    configObj = markedConfig;
  }

  Object.assign(configs, configObj);

  return configs;
}
