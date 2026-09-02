import { memo, useState } from "react";
import { Popover, Spin, Image } from "antd";
import { useWSStore } from "@/stores/connection/wsStore";
import {
  useResourceImages,
  useStableImagePaths,
} from "@/hooks/useResourceImages";

interface TemplatePreviewProps {
  templatePaths: string[]; // 模板图片相对路径列表
  title: string; // 字段标题（key）
  description?: string; // 字段描述
  children: React.ReactNode;
}

interface TemplatePreviewContentProps {
  templatePaths: string[];
  description?: string;
}

const TemplatePreviewContent = memo(
  ({ templatePaths, description }: TemplatePreviewContentProps) => {
    const { images } = useResourceImages(templatePaths);

    return (
      <div style={{ maxWidth: 350 }}>
        {description && <div style={{ maxWidth: 260 }}>{description}</div>}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginTop: description ? 8 : 0,
            justifyContent: images.length === 1 ? "center" : "flex-start",
          }}
        >
          {images.map(({ path, image, pending }, index) => {
            if (pending && !image) {
              return (
                <div
                  key={`${path}-${index}`}
                  style={{
                    padding: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 80,
                    height: 60,
                    background: "#f5f5f5",
                    borderRadius: 4,
                  }}
                >
                  <Spin size="small" />
                </div>
              );
            }

            if (!image) {
              return (
                <div
                  key={`${path}-${index}`}
                  style={{
                    padding: "8px 12px",
                    color: "#999",
                    fontSize: 11,
                    background: "#f5f5f5",
                    borderRadius: 4,
                  }}
                >
                  {path} - 未找到
                </div>
              );
            }

            const maxSize = images.length > 1 ? 150 : 300;
            const scale = Math.min(
              maxSize / Math.max(image.width, 1),
              maxSize / Math.max(image.height, 1),
              1,
            );
            const displayWidth = Math.max(
              Math.round(image.width * scale),
              40,
            );
            const displayHeight = Math.max(
              Math.round(image.height * scale),
              40,
            );

            return (
              <div key={`${path}-${index}`} style={{ textAlign: "center" }}>
                <Image
                  src={image.url}
                  fallback={image.dataUrl}
                  alt={path}
                  width={displayWidth}
                  height={displayHeight}
                  decoding="async"
                  style={{
                    objectFit: "contain",
                    borderRadius: 4,
                    background: "#f5f5f5",
                  }}
                  preview={false}
                />
                <div style={{ fontSize: 10, color: "#999", marginTop: 2 }}>
                  {path.split("/").pop()} ({image.width}×{image.height})
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  },
);

TemplatePreviewContent.displayName = "TemplatePreviewContent";

/**
 * 模板图片预览组件
 * 在 hover 时显示图片预览，支持多资源目录区分
 */
export const TemplatePreview = memo(
  ({ templatePaths, title, description, children }: TemplatePreviewProps) => {
    const connected = useWSStore((state) => state.connected);
    const [open, setOpen] = useState(false);
    const validPaths = useStableImagePaths(templatePaths);

    // 无有效路径
    if (validPaths.length === 0) {
      return <>{children}</>;
    }

    // 未连接
    if (!connected) {
      return <>{children}</>;
    }

    return (
      <Popover
        title={title}
        content={
          open ? (
            <TemplatePreviewContent
              templatePaths={validPaths}
              description={description}
            />
          ) : null
        }
        trigger="hover"
        placement="left"
        mouseEnterDelay={0.3}
        mouseLeaveDelay={0.1}
        open={open}
        onOpenChange={setOpen}
        styles={{
          root: {
            maxWidth: 380,
          },
          container: {
            padding: 10,
          },
        }}
      >
        {children}
      </Popover>
    );
  }
);

TemplatePreview.displayName = "TemplatePreview";
