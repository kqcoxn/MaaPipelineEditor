import { memo } from "react";
import { Image as AntImage, Spin } from "antd";
import { useResourceImages } from "@/hooks/useResourceImages";
import style from "../../../../styles/flow/nodes.module.less";

interface NodeTemplateImagesProps {
  templatePaths: string[];
}

// 单张图片的最大高度
const MAX_IMAGE_HEIGHT = 36;
const MAX_IMAGE_WIDTH = 60;

function getDisplaySize(width: number, height: number): {
  width: number;
  height: number;
} {
  if (width <= 0 || height <= 0) {
    return { width: MAX_IMAGE_HEIGHT, height: MAX_IMAGE_HEIGHT };
  }

  const scale = Math.min(
    MAX_IMAGE_WIDTH / width,
    MAX_IMAGE_HEIGHT / height,
    1,
  );
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * 节点模板图片显示组件
 * 在节点底部显示 template 字段的图片缩略图
 */
export const NodeTemplateImages = memo(
  ({ templatePaths }: NodeTemplateImagesProps) => {
    const { connected, paths, images } = useResourceImages(templatePaths);

    // 无有效路径或未连接
    if (paths.length === 0 || !connected) {
      return null;
    }

    return (
      <div className={style.nodeTemplateImages}>
        {images.map(({ path, image, pending }, index) => {
          const displaySize = image
            ? getDisplaySize(image.width, image.height)
            : null;

          return (
            <div
              key={`${path}-${index}`}
              className={`${style.nodeTemplateImageSlot} nodrag`}
            >
              {pending && !image && <Spin size="small" />}
              {image && displaySize && (
                <AntImage
                  src={image.url}
                  fallback={image.dataUrl}
                  alt={path}
                  width={displaySize.width}
                  height={displaySize.height}
                  decoding="async"
                  style={{
                    objectFit: "contain",
                    borderRadius: 2,
                  }}
                  preview={{ src: image.dataUrl, mask: null }}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  },
);

NodeTemplateImages.displayName = "NodeTemplateImages";
