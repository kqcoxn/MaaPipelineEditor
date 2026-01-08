import { memo, useState, useEffect, useCallback } from "react";
import { Popover, Spin, Image } from "antd";
import { useLocalFileStore } from "../../../../stores/localFileStore";
import { resourceProtocol } from "../../../../services/server";
import { useWSStore } from "../../../../stores/wsStore";

interface TemplatePreviewProps {
  templatePaths: string[]; // 模板图片相对路径列表
  title: string; // 字段标题（key）
  description?: string; // 字段描述
  children: React.ReactNode;
}

/**
 * 模板图片预览组件
 * 在 hover 时显示图片预览，支持多资源目录区分
 */
export const TemplatePreview = memo(
  ({ templatePaths, title, description, children }: TemplatePreviewProps) => {
    const connected = useWSStore((state) => state.connected);
    const [open, setOpen] = useState(false);

    // 过滤有效路径
    const validPaths = templatePaths.filter(p => p && p.trim() !== "");

    // 订阅整个 imageCache 对象以触发重新渲染
    const imageCache = useLocalFileStore((state) => state.imageCache);
    const pendingImageRequests = useLocalFileStore((state) => state.pendingImageRequests);

    // 获取缓存和 pending 状态
    const getCache = (path: string) => imageCache.get(path);
    const isPending = (path: string) => pendingImageRequests.has(path);

    // 请求所有图片数据
    const requestImages = useCallback(() => {
      if (!connected) return;
      
      validPaths.forEach(path => {
        if (!imageCache.has(path) && !pendingImageRequests.has(path)) {
          resourceProtocol.requestImage(path);
        }
      });
    }, [connected, validPaths, imageCache, pendingImageRequests]);

    // hover 打开时请求图片
    useEffect(() => {
      if (open) {
        requestImages();
      }
    }, [open, requestImages]);

    // 无有效路径
    if (validPaths.length === 0) {
      return <>{children}</>;
    }

    // 未连接
    if (!connected) {
      return <>{children}</>;
    }

    // 渲染单个图片
    const renderImage = (path: string, index: number) => {
      const cache = getCache(path);
      const pending = isPending(path);

      if (pending) {
        return (
          <div key={index} style={{ 
            padding: "12px", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center",
            minWidth: 80,
            minHeight: 60,
            background: "#f5f5f5",
            borderRadius: 4,
          }}>
            <Spin size="small" />
          </div>
        );
      }

      if (!cache) {
        return (
          <div key={index} style={{ 
            padding: "8px 12px", 
            color: "#999",
            fontSize: 11,
            background: "#f5f5f5",
            borderRadius: 4,
          }}>
            {path} - 未找到
          </div>
        );
      }

      const { base64, mimeType, width, height } = cache;

      // 计算显示尺寸
      const maxSize = validPaths.length > 1 ? 150 : 300;
      let displayWidth = width;
      let displayHeight = height;
      
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          displayWidth = maxSize;
          displayHeight = Math.round((height / width) * maxSize);
        } else {
          displayHeight = maxSize;
          displayWidth = Math.round((width / height) * maxSize);
        }
      }

      displayWidth = Math.max(displayWidth, 40);
      displayHeight = Math.max(displayHeight, 40);

      return (
        <div key={index} style={{ textAlign: "center" }}>
          <Image
            src={`data:${mimeType};base64,${base64}`}
            alt={path}
            width={displayWidth}
            height={displayHeight}
            style={{
              objectFit: "contain",
              borderRadius: 4,
              background: "#f5f5f5",
            }}
            preview={false}
          />
          <div style={{ fontSize: 10, color: "#999", marginTop: 2 }}>
            {path.split('/').pop()} ({width}×{height})
          </div>
        </div>
      );
    };

    // 预览内容
    const previewContent = () => {
      return (
        <div style={{ maxWidth: 350 }}>
          {/* 字段描述 */}
          {description && (
            <div style={{ maxWidth: 260 }}>{description}</div>
          )}
          {/* 图片列表 */}
          <div style={{ 
            display: "flex", 
            flexWrap: "wrap", 
            gap: 8,
            marginTop: description ? 8 : 0,
            justifyContent: validPaths.length === 1 ? "center" : "flex-start"
          }}>
            {validPaths.map((path, index) => renderImage(path, index))}
          </div>
        </div>
      );
    };

    return (
      <Popover
        title={title}
        content={previewContent}
        trigger="hover"
        placement="left"
        mouseEnterDelay={0.3}
        mouseLeaveDelay={0.1}
        open={open}
        onOpenChange={setOpen}
        overlayStyle={{
          maxWidth: 380,
        }}
        overlayInnerStyle={{
          padding: 10,
        }}
      >
        {children}
      </Popover>
    );
  }
);

TemplatePreview.displayName = "TemplatePreview";
