import { memo, useState, useCallback, useRef } from "react";
import { Slider, InputNumber, message } from "antd";
import {
  ScreenshotModalBase,
  type CanvasRenderProps,
} from "./ScreenshotModalBase";

interface ColorModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (
    lower: [number, number, number],
    upper: [number, number, number]
  ) => void;
}

export const ColorModal = memo(
  ({ open, onClose, onConfirm }: ColorModalProps) => {
    const [pickedColor, setPickedColor] = useState<
      [number, number, number] | null
    >(null);
    const [tolerance, setTolerance] = useState(10);

    const imageRef = useRef<HTMLImageElement | null>(null);

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

    // 计算颜色范围
    const calculateRange = useCallback(
      (
        color: [number, number, number],
        tol: number
      ): {
        lower: [number, number, number];
        upper: [number, number, number];
      } => {
        return {
          lower: [
            Math.max(0, color[0] - tol),
            Math.max(0, color[1] - tol),
            Math.max(0, color[2] - tol),
          ],
          upper: [
            Math.min(255, color[0] + tol),
            Math.min(255, color[1] + tol),
            Math.min(255, color[2] + tol),
          ],
        };
      },
      []
    );

    // 确定回填
    const handleConfirm = useCallback(() => {
      if (!pickedColor) {
        message.warning("请先在截图上点击取色");
        return;
      }

      const { lower, upper } = calculateRange(pickedColor, tolerance);
      onConfirm(lower, upper);
      onClose();
    }, [pickedColor, tolerance, calculateRange, onConfirm, onClose]);

    // 重置状态
    const handleReset = useCallback(() => {
      setPickedColor(null);
      setTolerance(10);
    }, []);

    // 渲染 Canvas
    const renderCanvas = useCallback(
      (props: CanvasRenderProps) => {
        const {
          scale,
          panOffset,
          canvasRef,
          screenshot,
          initializeImage,
          getBaseCursorStyle,
          isPanning,
          isSpacePressed,
          startPan,
          updatePan,
          endPan,
        } = props;

        // 加载图片
        if (screenshot && canvasRef.current) {
          const canvas = canvasRef.current;
          const ctx = canvas.getContext("2d");
          if (ctx && !imageRef.current) {
            const img = new Image();
            img.onload = () => {
              canvas.width = img.width;
              canvas.height = img.height;
              imageRef.current = img;
              initializeImage(img);
              ctx.drawImage(img, 0, 0);
            };
            img.src = screenshot;
          }
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
          handleCanvasClick(e, scale, canvasRef);
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

        return (
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
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

    // 计算当前的 lower 和 upper
    const currentRange = pickedColor
      ? calculateRange(pickedColor, tolerance)
      : null;

    return (
      <ScreenshotModalBase
        open={open}
        onClose={onClose}
        title="颜色取点工具"
        width={900}
        confirmDisabled={!pickedColor}
        onConfirm={handleConfirm}
        renderCanvas={renderCanvas}
        onReset={handleReset}
      >
        {/* 颜色预览 */}
        {pickedColor && (
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
              <div
                style={{
                  display: "inline-block",
                  width: 40,
                  height: 40,
                  backgroundColor: `rgb(${pickedColor[0]}, ${pickedColor[1]}, ${pickedColor[2]})`,
                  border: "1px solid #d9d9d9",
                  verticalAlign: "middle",
                  marginRight: 8,
                }}
              />
              <span>
                RGB({pickedColor[0]}, {pickedColor[1]}, {pickedColor[2]})
              </span>
            </div>

            {/* 容差调节 */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 8, fontWeight: 500 }}>容差值:</div>
              <div style={{ display: "flex", alignItems: "center" }}>
                <Slider
                  value={tolerance}
                  onChange={setTolerance}
                  min={0}
                  max={100}
                  style={{ flex: 1, maxWidth: 300 }}
                />
                <InputNumber
                  value={tolerance}
                  onChange={(v) => v !== null && setTolerance(v)}
                  min={0}
                  max={100}
                  style={{ marginLeft: 16, width: 80 }}
                />
              </div>
            </div>

            {/* lower/upper 预览 */}
            {currentRange && (
              <div>
                <div style={{ marginBottom: 4 }}>
                  <span style={{ fontWeight: 500 }}>Lower:</span>
                  <span style={{ marginLeft: 8, fontFamily: "monospace" }}>
                    [{currentRange.lower[0]}, {currentRange.lower[1]},{" "}
                    {currentRange.lower[2]}]
                  </span>
                </div>
                <div>
                  <span style={{ fontWeight: 500 }}>Upper:</span>
                  <span style={{ marginLeft: 8, fontFamily: "monospace" }}>
                    [{currentRange.upper[0]}, {currentRange.upper[1]},{" "}
                    {currentRange.upper[2]}]
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </ScreenshotModalBase>
    );
  }
);
