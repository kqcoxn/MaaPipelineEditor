/**
 * 分享工具模块 - 用于生成和解析分享链接
 *
 * 使用 lz-string 压缩 pipeline JSON，通过 URL 参数分享
 */

import LZString from "lz-string";
import { flowToPipeline, pipelineToFlow } from "../core/parser";
import { message } from "antd";

// URL 参数名
const SHARE_PARAM = "shared";

// 版本号
const SHARE_VERSION = 1;

/**
 * 编码分享内容
 * @param pipelineObj pipeline 对象
 * @returns 压缩后的字符串
 */
function encodeShareContent(pipelineObj: any): string {
  // 包装版本号
  const payload = {
    v: SHARE_VERSION,
    d: pipelineObj,
  };
  const jsonString = JSON.stringify(payload);
  // 压缩字符串
  const compressed = LZString.compressToEncodedURIComponent(jsonString);
  return compressed;
}

/**
 * 解码分享内容
 * @param compressed 压缩字符串
 * @returns pipeline 对象，失败返回 null
 */
function decodeShareContent(compressed: string): any | null {
  try {
    const jsonString = LZString.decompressFromEncodedURIComponent(compressed);
    if (!jsonString) {
      console.error("[shareHelper] 解压失败：结果为空");
      return null;
    }
    const payload = JSON.parse(jsonString);

    // 版本检查
    if (payload.v !== SHARE_VERSION) {
      console.warn(
        `[shareHelper] 分享版本不匹配: ${payload.v} !== ${SHARE_VERSION}`
      );
    }

    return payload.d;
  } catch (err) {
    console.error("[shareHelper] 解码失败:", err);
    return null;
  }
}

/**
 * 生成分享链接并复制到剪贴板
 * @returns 是否成功
 */
export async function generateShareLink(): Promise<boolean> {
  try {
    // 编译当前 pipeline
    const pipelineObj = flowToPipeline();

    if (!pipelineObj || Object.keys(pipelineObj).length === 0) {
      message.warning("当前画布为空，无法生成分享链接");
      return false;
    }

    // 压缩编码
    const compressed = encodeShareContent(pipelineObj);

    // 构建 URL
    const baseUrl = window.location.origin + window.location.pathname;
    const shareUrl = `${baseUrl}?${SHARE_PARAM}=${compressed}`;

    // 检查 URL 长度
    if (shareUrl.length > 6 * 1000 * 1000) {
      message.warning(
        `分享链接过长（${Math.round(
          shareUrl.length / 1000
        )}KB），可能在某些浏览器中无法正常使用`
      );
    }

    // 复制到剪贴板
    await navigator.clipboard.writeText(shareUrl);
    message.success("分享链接已复制到剪贴板");

    console.log(
      `[shareHelper] 生成分享链接成功，长度: ${shareUrl.length} 字符`
    );
    return true;
  } catch (err) {
    console.error("[shareHelper] 生成分享链接失败:", err);
    message.error("生成分享链接失败");
    return false;
  }
}

/**
 * 检查 URL 是否包含分享参数
 * @returns 分享参数值，不存在返回 null
 */
export function getShareParam(): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(SHARE_PARAM);
}

/**
 * 从 URL 加载分享内容
 * @returns 是否成功加载
 */
export async function loadFromShareUrl(): Promise<boolean> {
  const shareParam = getShareParam();
  if (!shareParam) {
    return false;
  }

  console.log("[shareHelper] 检测到分享参数，正在解析...");

  try {
    // 解码
    const pipelineObj = decodeShareContent(shareParam);
    if (!pipelineObj) {
      message.error("分享链接解析失败，请检查链接是否完整");
      clearShareParam();
      return false;
    }

    // 新建文件用于加载分享内容
    const { useFileStore } = await import("../stores/fileStore");
    const newFileName = useFileStore.getState().addFile({ isSwitch: true });

    if (!newFileName) {
      message.error("创建新文件失败");
      clearShareParam();
      return false;
    }

    // 设置文件名
    setTimeout(() => {
      useFileStore.getState().setFileName("来自分享");
    }, 100);

    // 导入到新文件
    const pString = JSON.stringify(pipelineObj);
    const success = await pipelineToFlow({ pString });

    if (success) {
      message.success("已从分享链接加载 Pipeline");
      // 清除 URL 参数
      clearShareParam();
      return true;
    } else {
      message.error("分享内容导入失败");
      clearShareParam();
      return false;
    }
  } catch (err) {
    console.error("[shareHelper] 加载分享内容失败:", err);
    message.error("分享链接解析失败");
    clearShareParam();
    return false;
  }
}

/**
 * 清除 URL 中的分享参数
 */
function clearShareParam(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete(SHARE_PARAM);
  window.history.replaceState({}, "", url.toString());
}
