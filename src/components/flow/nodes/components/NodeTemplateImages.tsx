import { memo, useEffect, useMemo, useRef, useCallback } from "react";
import { Image as AntImage } from "antd";
import { useLocalFileStore } from "../../../../stores/localFileStore";
import { resourceProtocol } from "../../../../services/server";
import { useWSStore } from "../../../../stores/wsStore";
import style from "../../../../styles/nodes.module.less";

interface NodeTemplateImagesProps {
  templatePaths: string[];
}

// 单张图片的最大高度
const MAX_IMAGE_HEIGHT = 36;
// 请求防抖延迟
const REQUEST_DEBOUNCE_MS = 300;

/**
 * 节点模板图片显示组件
 * 在节点底部显示 template 字段的图片缩略图
 */
export const NodeTemplateImages = memo(({ templatePaths }: NodeTemplateImagesProps) => {
  const connected = useWSStore((state) => state.connected);
  
  // 订阅图片缓存
  const imageCache = useLocalFileStore((state) => state.imageCache);
  const pendingImageRequests = useLocalFileStore((state) => state.pendingImageRequests);
  
  // 过滤有效路径
  const validPaths = useMemo(
    () => templatePaths.filter(p => p && p.trim() !== ""),
    [templatePaths]
  );

  // 请求图片
  const requestTimerRef = useRef<number | null>(null);

  const requestImages = useCallback(() => {
    if (!connected || validPaths.length === 0) return;
    
    validPaths.forEach(path => {
      if (!imageCache.has(path) && !pendingImageRequests.has(path)) {
        resourceProtocol.requestImage(path);
      }
    });
  }, [connected, validPaths, imageCache, pendingImageRequests]);

  useEffect(() => {
    if (requestTimerRef.current) {
      clearTimeout(requestTimerRef.current);
    }
    
    requestTimerRef.current = window.setTimeout(() => {
      requestImages();
    }, REQUEST_DEBOUNCE_MS);
    
    return () => {
      if (requestTimerRef.current) {
        clearTimeout(requestTimerRef.current);
      }
    };
  }, [requestImages]);

  // 无有效路径或未连接
  if (validPaths.length === 0 || !connected) {
    return null;
  }

  // 筛选已加载成功的图片
  const loadedImages = validPaths
    .map(path => {
      const cache = imageCache.get(path);
      if (!cache) return null;
      return { path, ...cache };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  // 无加载成功的图片
  if (loadedImages.length === 0) {
    return null;
  }

  return (
    <div className={style.nodeTemplateImages}>
      {loadedImages.map((item, index) => {
        const { path, base64, mimeType, width, height } = item;
        
        // 计算显示尺寸，保持比例，限制高度
        let displayHeight = Math.min(height, MAX_IMAGE_HEIGHT);
        let displayWidth = Math.round((width / height) * displayHeight);
        
        // 限制最大宽度
        const maxWidth = 60;
        if (displayWidth > maxWidth) {
          displayWidth = maxWidth;
          displayHeight = Math.round((height / width) * displayWidth);
        }

        return (
          <AntImage
            key={`${path}-${index}`}
            src={`data:${mimeType};base64,${base64}`}
            alt={path}
            width={displayWidth}
            height={displayHeight}
            style={{
              objectFit: "contain",
              borderRadius: 2,
            }}
            preview={{
              mask: null,
            }}
          />
        );
      })}
    </div>
  );
});

NodeTemplateImages.displayName = "NodeTemplateImages";
