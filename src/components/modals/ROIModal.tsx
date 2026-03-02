import { memo, useState, useCallback, useEffect, useRef } from "react";
import { Space, InputNumber, message, Tooltip } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import {
  ScreenshotModalBase,
  type CanvasRenderProps,
} from "./ScreenshotModalBase";
import {
  resolveNegativeROI,
  type Rectangle,
} from "../../utils/roiNegativeCoord";

interface ROIModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (roi: [number, number, number, number]) => void;
  initialROI?: [number, number, number, number];
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

        // 检查是否有负数坐标
        const hasNegativeCoord =
          rectangle &&
          (rectangle.x < 0 ||
            rectangle.y < 0 ||
            rectangle.width < 0 ||
            rectangle.height < 0);

        // 解析负数坐标
        let resolved = null;

        if (rectangle && hasNegativeCoord) {
          resolved = resolveNegativeROI(
            [rectangle.x, rectangle.y, rectangle.width, rectangle.height],
            img.width,
            img.height
          );
        }

        // 清除画布
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 绘制图片
        ctx.drawImage(img, 0, 0);

        // 绘制 ROI 矩形
        if (rectangle) {
          // 绘制原始矩形（用户输入的坐标）
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

          // 如果有负数坐标且被分割，绘制分割后的两个区域
          if (resolved && resolved.split.isSplit) {
            // 绘制左上角区域
            if (resolved.split.topLeft) {
              const tl = resolved.split.topLeft;
              ctx.strokeStyle = "#ff4a4a";
              ctx.lineWidth = 2;
              ctx.fillStyle = "rgba(255, 74, 74, 0.1)";
              ctx.fillRect(tl.x, tl.y, tl.width, tl.height);
              ctx.strokeRect(tl.x, tl.y, tl.width, tl.height);
            }
            // 绘制右下角区域
            if (resolved.split.bottomRight) {
              const br = resolved.split.bottomRight;
              ctx.strokeStyle = "#ff4a4a";
              ctx.lineWidth = 2;
              ctx.fillStyle = "rgba(255, 74, 74, 0.1)";
              ctx.fillRect(br.x, br.y, br.width, br.height);
              ctx.strokeRect(br.x, br.y, br.width, br.height);
            }
          }
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
            <Tooltip
              title={
                <div>
                  <div style={{ fontWeight: 500, marginBottom: 4 }}>
                    负数坐标说明 (v5.6+)
                  </div>
                  <div>• x 负数：从右边缘计算</div>
                  <div>• y 负数：从下边缘计算</div>
                  <div>• w/h 为 0：延伸至边缘</div>
                  <div>• w/h 负数：取绝对值， 作为右下角</div>
                </div>
              }
            >
              <InfoCircleOutlined
                style={{ fontSize: 12, color: "#8c8c8c", cursor: "help" }}
              />
            </Tooltip>
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
              <Tooltip title="负数从右边缘计算">
                <span
                  style={{
                    fontSize: 10,
                    color: rectangle && rectangle.x < 0 ? "#faad14" : "#bfbfbf",
                  }}
                >
                  {rectangle && rectangle.x < 0 ? "←右" : ""}
                </span>
              </Tooltip>
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
              <Tooltip title="负数从下边缘计算">
                <span
                  style={{
                    fontSize: 10,
                    color: rectangle && rectangle.y < 0 ? "#faad14" : "#bfbfbf",
                  }}
                >
                  {rectangle && rectangle.y < 0 ? "↑下" : ""}
                </span>
              </Tooltip>
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
              <Tooltip title="0 表示延伸至右边缘，负数取绝对值并将 作为右下角">
                <span
                  style={{
                    fontSize: 10,
                    color:
                      rectangle && rectangle.width < 0 ? "#faad14" : "#bfbfbf",
                  }}
                >
                  {rectangle && rectangle.width === 0
                    ? "→边"
                    : rectangle && rectangle.width < 0
                    ? "←→"
                    : ""}
                </span>
              </Tooltip>
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
              <Tooltip title="0 表示延伸至下边缘，负数取绝对值并将 作为右下角">
                <span
                  style={{
                    fontSize: 10,
                    color:
                      rectangle && rectangle.height < 0 ? "#faad14" : "#bfbfbf",
                  }}
                >
                  {rectangle && rectangle.height === 0
                    ? "↓边"
                    : rectangle && rectangle.height < 0
                    ? "↑↓"
                    : ""}
                </span>
              </Tooltip>
            </Space>

            {/* 显示坐标信息 */}
            {rectangle &&
              (rectangle.x < 0 ||
                rectangle.y < 0 ||
                rectangle.width < 0 ||
                rectangle.height < 0) &&
              imageRef.current && (
                <div
                  style={{
                    marginTop: 8,
                    padding: "8px 10px",
                    backgroundColor: "#e6f7ff",
                    borderRadius: 6,
                    border: "1px solid #91d5ff",
                  }}
                >
                  {(() => {
                    const resolved = resolveNegativeROI(
                      [
                        rectangle.x,
                        rectangle.y,
                        rectangle.width,
                        rectangle.height,
                      ],
                      imageRef.current!.width,
                      imageRef.current!.height
                    );
                    return (
                      <>
                        {resolved.split.topLeft && (
                          <div
                            style={{
                              fontSize: 12,
                              color: "#262626",
                              marginBottom: 4,
                            }}
                          >
                            <span style={{ color: "#1890ff" }}>左上: </span>[
                            {resolved.split.topLeft.x},{" "}
                            {resolved.split.topLeft.y},{" "}
                            {resolved.split.topLeft.width},{" "}
                            {resolved.split.topLeft.height}]
                          </div>
                        )}
                        {resolved.split.bottomRight && (
                          <div style={{ fontSize: 12, color: "#262626" }}>
                            <span style={{ color: "#1890ff" }}>右下: </span>[
                            {resolved.split.bottomRight.x},{" "}
                            {resolved.split.bottomRight.y},{" "}
                            {resolved.split.bottomRight.width},{" "}
                            {resolved.split.bottomRight.height}]
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
          </Space>
        </div>
      </ScreenshotModalBase>
    );
  }
);
