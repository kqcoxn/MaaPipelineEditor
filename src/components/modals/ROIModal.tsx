import { memo, useState, useCallback, useEffect, useRef } from "react";
import { Space, InputNumber, message } from "antd";
import {
  ScreenshotModalBase,
  type CanvasRenderProps,
} from "./ScreenshotModalBase";

interface ROIModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (roi: [number, number, number, number]) => void;
  initialROI?: [number, number, number, number];
}

interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const ROIModal = memo(
  ({ open, onClose, onConfirm, initialROI }: ROIModalProps) => {
    const [screenshot, setScreenshot] = useState<string | null>(null);
    const [rectangle, setRectangle] = useState<Rectangle | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPoint, setStartPoint] = useState<{
      x: number;
      y: number;
    } | null>(null);

    const imageRef = useRef<HTMLImageElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const viewportPropsRef = useRef<CanvasRenderProps | null>(null);

    // 初始化 ROI
    useEffect(() => {
      if (initialROI && screenshot) {
        setRectangle({
          x: initialROI[0],
          y: initialROI[1],
          width: initialROI[2],
          height: initialROI[3],
        });
      }
    }, [initialROI, screenshot]);

    // 重绘 canvas
    const redrawCanvas = useCallback(
      (canvas: HTMLCanvasElement | null) => {
        const ctx = canvas?.getContext("2d");
        const img = imageRef.current;
        if (!canvas || !ctx || !img) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        if (rectangle) {
          ctx.strokeStyle = "#ff4a4a";
          ctx.lineWidth = 2;
          ctx.fillStyle = "rgba(255, 74, 74, 0.1)";
          ctx.fillRect(
            rectangle.x,
            rectangle.y,
            rectangle.width,
            rectangle.height
          );
          ctx.strokeRect(
            rectangle.x,
            rectangle.y,
            rectangle.width,
            rectangle.height
          );
        }
      },
      [rectangle]
    );

    // rectangle 变化或图片加载后重绘
    useEffect(() => {
      if (canvasRef.current && imageRef.current) {
        redrawCanvas(canvasRef.current);
      }
    }, [rectangle, redrawCanvas]);

    // 创建鼠标事件处理器
    const createMouseHandlers = useCallback(
      (props: CanvasRenderProps) => {
        const {
          scale,
          isPanning,
          isSpacePressed,
          startPan,
          updatePan,
          endPan,
        } = props;

        const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
          const canvas = canvasRef.current;
          if (!canvas) return;

          if (e.button === 1) {
            e.preventDefault();
            startPan(e.clientX, e.clientY, true);
            return;
          }

          if (isSpacePressed) {
            startPan(e.clientX, e.clientY);
            return;
          }

          const rect = canvas.getBoundingClientRect();
          const x = (e.clientX - rect.left) / scale;
          const y = (e.clientY - rect.top) / scale;

          setIsDrawing(true);
          setStartPoint({ x, y });
          setRectangle({ x, y, width: 1, height: 1 });
        };

        const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
          if (isPanning) {
            updatePan(e.clientX, e.clientY);
            return;
          }

          if (!isDrawing || !startPoint) return;

          const canvas = canvasRef.current;
          if (!canvas) return;

          const rect = canvas.getBoundingClientRect();
          const currentX = (e.clientX - rect.left) / scale;
          const currentY = (e.clientY - rect.top) / scale;

          const width = currentX - startPoint.x;
          const height = currentY - startPoint.y;

          setRectangle({
            x: width < 0 ? currentX : startPoint.x,
            y: height < 0 ? currentY : startPoint.y,
            width: Math.abs(width),
            height: Math.abs(height),
          });
        };

        const handleMouseUp = () => {
          if (isPanning) {
            endPan();
            return;
          }
          setIsDrawing(false);
          setStartPoint(null);
        };

        return { handleMouseDown, handleMouseMove, handleMouseUp };
      },
      [isDrawing, startPoint]
    );

    // 手动输入坐标
    const handleCoordinateChange = useCallback(
      (key: keyof Rectangle, value: number | null) => {
        if (value === null) return;
        setRectangle((prev) =>
          prev ? { ...prev, [key]: Math.round(value) } : null
        );
      },
      []
    );

    // 确定回填
    const handleConfirm = useCallback(() => {
      if (!rectangle) {
        message.warning("请先框选区域");
        return;
      }

      const roi: [number, number, number, number] = [
        Math.round(rectangle.x),
        Math.round(rectangle.y),
        Math.round(rectangle.width),
        Math.round(rectangle.height),
      ];
      onConfirm(roi);
      onClose();
    }, [rectangle, onConfirm, onClose]);

    // 重置状态
    const handleReset = useCallback(() => {
      setScreenshot(null);
      setRectangle(null);
      setIsDrawing(false);
      setStartPoint(null);
      imageRef.current = null;
    }, []);

    // 渲染 Canvas
    const renderCanvas = useCallback(
      (props: CanvasRenderProps) => {
        const { scale, panOffset, getBaseCursorStyle, imageElement } = props;

        // 存储最新的 props
        viewportPropsRef.current = props;

        // 存储图片到 ref
        if (imageElement) {
          imageRef.current = imageElement;
        }

        const { handleMouseDown, handleMouseMove, handleMouseUp } =
          createMouseHandlers(props);

        const cursorStyle = getBaseCursorStyle() || "crosshair";

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
            onMouseLeave={handleMouseUp}
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
      [createMouseHandlers]
    );

    // 初始化 canvas
    const handleImageLoaded = useCallback(
      (img: HTMLImageElement) => {
        imageRef.current = img;
        const canvas = canvasRef.current;
        const props = viewportPropsRef.current;
        if (!canvas) return;

        canvas.width = img.width;
        canvas.height = img.height;
        props?.initializeImage?.(img);
        redrawCanvas(canvas);
      },
      [redrawCanvas]
    );

    return (
      <ScreenshotModalBase
        open={open}
        onClose={onClose}
        title="ROI 区域配置"
        width={900}
        confirmDisabled={!rectangle}
        onConfirm={handleConfirm}
        renderCanvas={renderCanvas}
        onScreenshotChange={setScreenshot}
        onImageLoaded={handleImageLoaded}
        onReset={handleReset}
      >
        {/* ROI 参数显示与输入 */}
        <div
          style={{
            padding: 12,
            backgroundColor: "#fff",
            borderRadius: 8,
            border: `1px solid ${rectangle ? "#91d5ff" : "#e8e8e8"}`,
            transition: "border-color 0.3s ease",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 10,
            }}
          >
            <div
              style={{
                width: 3,
                height: 16,
                backgroundColor: "#1890ff",
                borderRadius: 2,
              }}
            />
            <span style={{ fontSize: 14, fontWeight: 500, color: "#262626" }}>
              ROI 坐标
            </span>
            <span style={{ fontSize: 12, color: "#8c8c8c" }}>[x, y, w, h]</span>
          </div>
          <Space orientation="vertical" size={8} style={{ width: "100%" }}>
            <Space wrap size={8} align="center">
              <span
                style={{
                  fontSize: 12,
                  color: "#8c8c8c",
                  width: 16,
                  textAlign: "right",
                  display: "inline-block",
                  lineHeight: "24px",
                }}
              >
                X
              </span>
              <InputNumber
                value={rectangle?.x ?? 0}
                onChange={(v) => handleCoordinateChange("x", v)}
                precision={0}
                size="small"
                style={{ width: 80 }}
                disabled={!screenshot}
              />
              <span
                style={{
                  fontSize: 12,
                  color: "#8c8c8c",
                  width: 16,
                  textAlign: "right",
                  display: "inline-block",
                  lineHeight: "24px",
                }}
              >
                Y
              </span>
              <InputNumber
                value={rectangle?.y ?? 0}
                onChange={(v) => handleCoordinateChange("y", v)}
                precision={0}
                size="small"
                style={{ width: 80 }}
                disabled={!screenshot}
              />
            </Space>
            <Space wrap size={8} align="center">
              <span
                style={{
                  fontSize: 12,
                  color: "#8c8c8c",
                  width: 16,
                  textAlign: "right",
                  display: "inline-block",
                  lineHeight: "24px",
                }}
              >
                W
              </span>
              <InputNumber
                value={rectangle?.width ?? 0}
                onChange={(v) => handleCoordinateChange("width", v)}
                precision={0}
                size="small"
                style={{ width: 80 }}
                disabled={!screenshot}
              />
              <span
                style={{
                  fontSize: 12,
                  color: "#8c8c8c",
                  width: 16,
                  textAlign: "right",
                  display: "inline-block",
                  lineHeight: "24px",
                }}
              >
                H
              </span>
              <InputNumber
                value={rectangle?.height ?? 0}
                onChange={(v) => handleCoordinateChange("height", v)}
                precision={0}
                size="small"
                style={{ width: 80 }}
                disabled={!screenshot}
              />
            </Space>
          </Space>
        </div>
      </ScreenshotModalBase>
    );
  }
);
