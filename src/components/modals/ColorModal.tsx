import { memo, useState, useCallback, useRef, useEffect } from "react";
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

    // 加载截图图片
    useEffect(() => {
      if (!screenshot || !canvasRef.current) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // 如果已有图片且是同一张直接重绘
      if (imageRef.current && imageRef.current.src === screenshot) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(imageRef.current, 0, 0);
        return;
      }

      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        imageRef.current = img;
        ctx.drawImage(img, 0, 0);
        // 初始化视口
        initializeImageRef.current?.(img);
      };
      img.src = screenshot;
    }, [screenshot]);

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
          initializeImage,
          getBaseCursorStyle,
          isPanning,
          isSpacePressed,
          startPan,
          updatePan,
          endPan,
        } = props;

        initializeImageRef.current = initializeImage;

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

        return (
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
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
        onReset={handleReset}
      >
        {/* 颜色预览 */}
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            backgroundColor: "#fafafa",
            borderRadius: 4,
          }}
        >
          <div style={{ marginBottom: 12 }}>
            <span style={{ fontWeight: 500, marginRight: 8 }}>已选颜色:</span>
            {pickedColor ? (
              <>
                <div
                  style={{
                    display: "inline-block",
                    width: 20,
                    height: 20,
                    backgroundColor: `rgb(${pickedColor[0]}, ${pickedColor[1]}, ${pickedColor[2]})`,
                    border: "1px solid #d9d9d9",
                    verticalAlign: "middle",
                    marginRight: 8,
                  }}
                />
                <span>
                  RGB({pickedColor[0]}, {pickedColor[1]}, {pickedColor[2]})
                </span>
              </>
            ) : (
              <span style={{ color: "#999" }}>请在截图上点击取色</span>
            )}
          </div>
        </div>
      </ScreenshotModalBase>
    );
  }
);
