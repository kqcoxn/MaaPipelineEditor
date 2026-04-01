/**
 * URL 参数处理工具模块
 *
 * 统一管理应用的 URL 参数，在启动时统一解析
 * 各模块根据需要自行获取参数值
 *
 * 参数分为两类：
 * 1. 一次性参数：处理后立即清除（如分享链接）
 * 2. 持久性参数：保留在 URL 中（如便捷操作开关）
 */

// ============ 类型定义 ============

/**
 * 所有 URL 参数的类型定义
 */
export interface UrlParams {
  linkLb: boolean; // 自动连接 LocalBridge
  port: number | null; // 指定连接端口
}

// ============ 参数名常量 ============

/** 持久性参数:保留在 URL 中 */
const LINK_LB_PARAM = "link_lb";
const PORT_PARAM = "port";

/** 一次性参数：需要立即清除 */

// ============ 核心解析函数 ============

/**
 * 统一解析所有 URL 参数
 * 应在应用启动时调用一次，得到所有参数的对象
 */
export function parseUrlParams(): UrlParams {
  const urlParams = new URLSearchParams(window.location.search);
  return {
    linkLb: getBooleanParam(urlParams, LINK_LB_PARAM),
    port: getNumberParam(urlParams, PORT_PARAM),
  };
}

/**
 * 清除指定的 URL 参数
 * @param paramNames 要清除的参数名列表
 */
export function clearUrlParams(...paramNames: string[]): void {
  const url = new URL(window.location.href);
  paramNames.forEach((name) => url.searchParams.delete(name));
  window.history.replaceState({}, "", url.toString());
}

/**
 * 清除一次性参数
 * 持久性参数不会被清除
 */
export function clearOneTimeParams(): void {
  // 一次性参数列表
}

// ============ 内部工具函数 ============

/**
 * 获取布尔型参数
 * @param urlParams URLSearchParams 实例
 * @param paramName 参数名
 */
function getBooleanParam(
  urlParams: URLSearchParams,
  paramName: string
): boolean {
  const value = urlParams.get(paramName);
  return value === "true" || value === "1";
}

/**
 * 获取字符串型参数
 * @param urlParams URLSearchParams 实例
 * @param paramName 参数名
 */
function getStringParam(
  urlParams: URLSearchParams,
  paramName: string
): string | null {
  return urlParams.get(paramName);
}

/**
 * 获取数字型参数
 * @param urlParams URLSearchParams 实例
 * @param paramName 参数名
 */
function getNumberParam(
  urlParams: URLSearchParams,
  paramName: string
): number | null {
  const value = urlParams.get(paramName);
  if (value === null) return null;
  const num = parseInt(value, 10);
  return isNaN(num) ? null : num;
}
