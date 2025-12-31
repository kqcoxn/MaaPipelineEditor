import { memo, useState, useCallback, useRef } from "react";
import { message } from "antd";
import {
  ScreenshotModalBase,
  type CanvasRenderProps,
} from "./ScreenshotModalBase";

interface ColorModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (color: [number, number, number]) => void;
  targetKey?: string; // 添加目标字段名,用于显示标题
}

export const ColorModal = memo(
  ({ open, onClose, onConfirm, targetKey }: ColorModalProps) => {
    const [screenshot, setScreenshot] = useState<string | null>(null);
    const [pickedColor, setPickedColor] = useState<
      [number, number, number] | null
    >(null);

    const imageRef = useRef<HTMLImageElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const viewportPropsRef = useRef<CanvasRenderProps | null>(null);
    const initializeImageRef = useRef<((img: HTMLImageElement) => void) | null>(
      null
    );

    // 点击取色
    const handleCanvasClick = useCallback(
      (
        e: React.MouseEvent<HTMLCanvasElement>,
        scale: number,
        canvasRef: React.RefObject<HTMLCanvasElement | null>
      ) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / scale);
        const y = Math.floor((e.clientY - rect.top) / scale);

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const imageData = ctx.getImageData(x, y, 1, 1);
        const pixel = imageData.data;
        const color: [number, number, number] = [pixel[0], pixel[1], pixel[2]];

        setPickedColor(color);
        message.success(`取色成功: RGB(${color[0]}, ${color[1]}, ${color[2]})`);
      },
      []
    );

    // 确定回填
    const handleConfirm = useCallback(() => {
      if (!pickedColor) {
        message.warning("请先在截图上点击取色");
        return;
      }

      onConfirm(pickedColor);
      onClose();
    }, [pickedColor, onConfirm, onClose]);

    // 重置状态
    const handleReset = useCallback(() => {
      setScreenshot(null);
      setPickedColor(null);
      imageRef.current = null;
      canvasRef.current = null;
      initializeImageRef.current = null;
    }, []);

    // 渲染 Canvas
    const renderCanvas = useCallback(
      (props: CanvasRenderProps) => {
        const {
          scale,
          panOffset,
          getBaseCursorStyle,
          isPanning,
          isSpacePressed,
          startPan,
          updatePan,
          endPan,
          imageElement,
        } = props;

        // 存储最新的 props
        viewportPropsRef.current = props;

        // 存储图片到 ref
        if (imageElement) {
          imageRef.current = imageElement;
        }

        const baseCursor = getBaseCursorStyle();
        const cursorStyle = baseCursor || "crosshair";

        const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
          // 中键拖动
          if (e.button === 1) {
            e.preventDefault();
            startPan(e.clientX, e.clientY, true);
            return;
          }
          // 空格拖动
          if (isSpacePressed) {
            startPan(e.clientX, e.clientY);
            return;
          }
          // 取色
          const tempCanvasRef = { current: canvasRef.current };
          handleCanvasClick(e, scale, tempCanvasRef);
        };

        const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
          if (isPanning) {
            updatePan(e.clientX, e.clientY);
          }
        };

        const handleMouseUp = () => {
          if (isPanning) {
            endPan();
          }
        };

        const handleMouseLeave = () => {
          if (isPanning) {
            endPan();
          }
        };

        // 滚轮缩放事件处理
        const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
          e.preventDefault();
          e.stopPropagation();
        };

        return (
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onWheel={handleWheel}
            style={{
              cursor: cursorStyle,
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${scale})`,
              transformOrigin: "top left",
              position: "absolute",
            }}
          />
        );
      },
      [handleCanvasClick]
    );

    // 图片加载完成后初始化
    const handleCanvasInit = useCallback((img: HTMLImageElement) => {
      imageRef.current = img;
      const canvas = canvasRef.current;
      const props = viewportPropsRef.current;
      if (!canvas) return;

      canvas.width = img.width;
      canvas.height = img.height;
      props?.initializeImage?.(img);

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
      }
    }, []);

    // 根据 targetKey 生成标题
    const title =
      targetKey === "lower"
        ? "颜色取点工具 - 下界颜色"
        : targetKey === "upper"
        ? "颜色取点工具 - 上界颜色"
        : "颜色取点工具";

    return (
      <ScreenshotModalBase
        open={open}
        onClose={onClose}
        title={title}
        width={900}
        confirmDisabled={!pickedColor}
        onConfirm={handleConfirm}
        renderCanvas={renderCanvas}
        onScreenshotChange={setScreenshot}
        onImageLoaded={handleCanvasInit}
        onReset={handleReset}
      >
        {/* 颜色预览 */}
        <div
          style={{
            padding: 12,
            backgroundColor: "#fff",
            borderRadius: 8,
            border: `1px solid ${pickedColor ? "#b7eb8f" : "#e8e8e8"}`,
            transition: "border-color 0.3s ease",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: pickedColor ? 10 : 0,
            }}
          >
            <div
              style={{
                width: 3,
                height: 16,
                backgroundColor: "#52c41a",
                borderRadius: 2,
              }}
            />
            <span style={{ fontSize: 14, fontWeight: 500, color: "#262626" }}>
              已选颜色
            </span>
          </div>
          {pickedColor ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  backgroundColor: `rgb(${pickedColor[0]}, ${pickedColor[1]}, ${pickedColor[2]})`,
                  border: "1px solid #d9d9d9",
                  borderRadius: 4,
                }}
              />
              <span style={{ fontSize: 12, color: "#262626" }}>
                RGB({pickedColor[0]}, {pickedColor[1]}, {pickedColor[2]})
              </span>
            </div>
          ) : (
            <span style={{ fontSize: 12, color: "#8c8c8c" }}>
              请在截图上点击取色
            </span>
          )}
        </div>
      </ScreenshotModalBase>
    );
  }
);
