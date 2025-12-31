import { memo, useState, useCallback, useEffect, useRef } from "react";
import {
  Space,
  InputNumber,
  message,
  Tag,
  Button,
  Tooltip,
  Divider,
} from "antd";
import {
  SwapOutlined,
  CopyOutlined,
  DeleteOutlined,
  AimOutlined,
} from "@ant-design/icons";
import {
  ScreenshotModalBase,
  type CanvasRenderProps,
  type ViewportProps,
} from "./ScreenshotModalBase";

interface ROIOffsetModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (offset: [number, number, number, number]) => void;
  initialROI?: [number, number, number, number];
}

interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

type DrawingTarget = "source" | "target";

export const ROIOffsetModal = memo(
  ({ open, onClose, onConfirm, initialROI }: ROIOffsetModalProps) => {
    const [screenshot, setScreenshot] = useState<string | null>(null);
    // 原 ROI（来源区域）
    const [sourceRect, setSourceRect] = useState<Rectangle | null>(null);
    // 期望 ROI（目标区域）
    const [targetRect, setTargetRect] = useState<Rectangle | null>(null);
    // 当前绘制目标
    const [drawingTarget, setDrawingTarget] = useState<DrawingTarget>("source");
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPoint, setStartPoint] = useState<{
      x: number;
      y: number;
    } | null>(null);

    const imageRef = useRef<HTMLImageElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const viewportPropsRef = useRef<CanvasRenderProps | null>(null);

    // 计算偏移量
    const calculateOffset = useCallback((): [
      number,
      number,
      number,
      number
    ] => {
      if (!sourceRect || !targetRect) return [0, 0, 0, 0];
      return [
        Math.round(targetRect.x - sourceRect.x),
        Math.round(targetRect.y - sourceRect.y),
        Math.round(targetRect.width - sourceRect.width),
        Math.round(targetRect.height - sourceRect.height),
      ];
    }, [sourceRect, targetRect]);

    const offset = calculateOffset();

    // 初始化原 ROI
    useEffect(() => {
      if (initialROI && screenshot) {
        setSourceRect({
          x: initialROI[0],
          y: initialROI[1],
          width: initialROI[2],
          height: initialROI[3],
        });
        // 自动切换到绘制目标区域
        setDrawingTarget("target");
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

        // 绘制原 ROI
        if (sourceRect) {
          ctx.strokeStyle = "#1890ff";
          ctx.lineWidth = 2;
          ctx.fillStyle = "rgba(24, 144, 255, 0.15)";
          ctx.fillRect(
            sourceRect.x,
            sourceRect.y,
            sourceRect.width,
            sourceRect.height
          );
          ctx.strokeRect(
            sourceRect.x,
            sourceRect.y,
            sourceRect.width,
            sourceRect.height
          );

          // 绘制标签
          ctx.font = "bold 14px sans-serif";
          ctx.fillStyle = "#1890ff";
          ctx.fillText(
            "原 ROI",
            sourceRect.x + 4,
            sourceRect.y > 20 ? sourceRect.y - 6 : sourceRect.y + 18
          );
        }

        // 绘制目标 ROI
        if (targetRect) {
          ctx.strokeStyle = "#fa8c16";
          ctx.lineWidth = 2;
          ctx.fillStyle = "rgba(250, 140, 22, 0.15)";
          ctx.fillRect(
            targetRect.x,
            targetRect.y,
            targetRect.width,
            targetRect.height
          );
          ctx.strokeRect(
            targetRect.x,
            targetRect.y,
            targetRect.width,
            targetRect.height
          );

          // 绘制标签
          ctx.font = "bold 14px sans-serif";
          ctx.fillStyle = "#fa8c16";
          ctx.fillText(
            "期望 ROI",
            targetRect.x + 4,
            targetRect.y > 20 ? targetRect.y - 6 : targetRect.y + 18
          );
        }

        // 绘制偏移箭头
        if (sourceRect && targetRect) {
          // 使用左上角作为起止点
          const sourcePoint = {
            x: sourceRect.x,
            y: sourceRect.y,
          };
          const targetPoint = {
            x: targetRect.x,
            y: targetRect.y,
          };

          // 绘制连接线
          ctx.beginPath();
          ctx.strokeStyle = "#52c41a";
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
          ctx.moveTo(sourcePoint.x, sourcePoint.y);
          ctx.lineTo(targetPoint.x, targetPoint.y);
          ctx.stroke();
          ctx.setLineDash([]);

          // 绘制箭头
          const angle = Math.atan2(
            targetPoint.y - sourcePoint.y,
            targetPoint.x - sourcePoint.x
          );
          const arrowLength = 12;
          ctx.beginPath();
          ctx.fillStyle = "#52c41a";
          ctx.moveTo(targetPoint.x, targetPoint.y);
          ctx.lineTo(
            targetPoint.x - arrowLength * Math.cos(angle - Math.PI / 6),
            targetPoint.y - arrowLength * Math.sin(angle - Math.PI / 6)
          );
          ctx.lineTo(
            targetPoint.x - arrowLength * Math.cos(angle + Math.PI / 6),
            targetPoint.y - arrowLength * Math.sin(angle + Math.PI / 6)
          );
          ctx.closePath();
          ctx.fill();
        }
      },
      [sourceRect, targetRect]
    );

    // sourceRect/targetRect 变化或图片加载后重绘
    useEffect(() => {
      if (canvasRef.current && imageRef.current) {
        redrawCanvas(canvasRef.current);
      }
    }, [sourceRect, targetRect, redrawCanvas]);

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

          const newRect = { x, y, width: 0, height: 0 };
          if (drawingTarget === "source") {
            setSourceRect(newRect);
          } else {
            setTargetRect(newRect);
          }
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

          const newRect = {
            x: width < 0 ? currentX : startPoint.x,
            y: height < 0 ? currentY : startPoint.y,
            width: Math.abs(width),
            height: Math.abs(height),
          };

          if (drawingTarget === "source") {
            setSourceRect(newRect);
          } else {
            setTargetRect(newRect);
          }
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
      [isDrawing, startPoint, drawingTarget]
    );

    // 手动输入坐标
    const handleSourceChange = useCallback(
      (key: keyof Rectangle, value: number | null) => {
        if (value === null) return;
        setSourceRect((prev) =>
          prev
            ? { ...prev, [key]: Math.round(value) }
            : { x: 0, y: 0, width: 0, height: 0, [key]: Math.round(value) }
        );
      },
      []
    );

    const handleTargetChange = useCallback(
      (key: keyof Rectangle, value: number | null) => {
        if (value === null) return;
        setTargetRect((prev) =>
          prev
            ? { ...prev, [key]: Math.round(value) }
            : { x: 0, y: 0, width: 0, height: 0, [key]: Math.round(value) }
        );
      },
      []
    );

    // 直接修改偏移量
    const handleOffsetChange = useCallback(
      (index: number, value: number | null) => {
        if (value === null || !sourceRect) return;
        const newOffset = [...offset] as [number, number, number, number];
        newOffset[index] = Math.round(value);

        // 根据偏移量反推目标 ROI
        setTargetRect({
          x: sourceRect.x + newOffset[0],
          y: sourceRect.y + newOffset[1],
          width: sourceRect.width + newOffset[2],
          height: sourceRect.height + newOffset[3],
        });
      },
      [sourceRect, offset]
    );

    // 交换原 ROI 和目标 ROI
    const handleSwap = useCallback(() => {
      const temp = sourceRect;
      setSourceRect(targetRect);
      setTargetRect(temp);
    }, [sourceRect, targetRect]);

    // 复制目标 ROI 到原 ROI
    const handleCopyTargetToSource = useCallback(() => {
      if (targetRect) {
        setSourceRect({ ...targetRect });
      }
    }, [targetRect]);

    // 清除指定 ROI
    const handleClearSource = useCallback(() => {
      setSourceRect(null);
    }, []);

    const handleClearTarget = useCallback(() => {
      setTargetRect(null);
    }, []);

    // 使用初始 ROI 重置原 ROI
    const handleResetToInitial = useCallback(() => {
      if (initialROI) {
        setSourceRect({
          x: initialROI[0],
          y: initialROI[1],
          width: initialROI[2],
          height: initialROI[3],
        });
      }
    }, [initialROI]);

    // 确定回填
    const handleConfirm = useCallback(() => {
      if (!sourceRect) {
        message.warning("请先框选或输入原 ROI");
        return;
      }
      if (!targetRect) {
        message.warning("请先框选或输入期望 ROI");
        return;
      }

      onConfirm(offset);
      onClose();
    }, [offset, sourceRect, targetRect, onConfirm, onClose]);

    // 重置状态
    const handleReset = useCallback(() => {
      setScreenshot(null);
      setSourceRect(null);
      setTargetRect(null);
      setIsDrawing(false);
      setStartPoint(null);
      setDrawingTarget("source");
    }, []);

    // 渲染工具栏
    const renderToolbar = useCallback(
      (_props: ViewportProps) => (
        <Space size="small">
          <span style={{ fontSize: 12, color: "#666" }}>当前绘制:</span>
          <Button.Group>
            <Button
              size="small"
              type={drawingTarget === "source" ? "primary" : "default"}
              onClick={() => setDrawingTarget("source")}
              style={
                drawingTarget === "source"
                  ? { backgroundColor: "#1890ff", borderColor: "#1890ff" }
                  : {}
              }
            >
              原 ROI
            </Button>
            <Button
              size="small"
              type={drawingTarget === "target" ? "primary" : "default"}
              onClick={() => setDrawingTarget("target")}
              style={
                drawingTarget === "target"
                  ? { backgroundColor: "#fa8c16", borderColor: "#fa8c16" }
                  : {}
              }
            >
              期望 ROI
            </Button>
          </Button.Group>
          {sourceRect && targetRect && (
            <Tooltip title="交换原 ROI 与期望 ROI">
              <Button size="small" icon={<SwapOutlined />} onClick={handleSwap}>
                交换
              </Button>
            </Tooltip>
          )}
          {targetRect && !sourceRect && (
            <Tooltip title="将期望 ROI 复制为原 ROI">
              <Button
                size="small"
                icon={<CopyOutlined />}
                onClick={handleCopyTargetToSource}
              >
                复制到原 ROI
              </Button>
            </Tooltip>
          )}
          {initialROI && (
            <Tooltip title="使用节点的 roi 属性重置原 ROI">
              <Button
                size="small"
                icon={<AimOutlined />}
                onClick={handleResetToInitial}
              >
                使用节点 ROI
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
      [
        drawingTarget,
        sourceRect,
        targetRect,
        initialROI,
        handleSwap,
        handleCopyTargetToSource,
        handleResetToInitial,
      ]
    );

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

    const hasValidOffset = sourceRect && targetRect;

    return (
      <ScreenshotModalBase
        open={open}
        onClose={onClose}
        title="ROI 偏移计算工具"
        width={1000}
        confirmText="应用偏移"
        confirmDisabled={!hasValidOffset}
        onConfirm={handleConfirm}
        renderToolbar={renderToolbar}
        renderCanvas={renderCanvas}
        onScreenshotChange={setScreenshot}
        onImageLoaded={handleImageLoaded}
        onReset={handleReset}
      >
        {/* 原 ROI 参数 */}
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              marginBottom: 8,
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Tag color="blue">原 ROI</Tag>
            [x, y, w, h]:
            {sourceRect && (
              <Tooltip title="清除原 ROI">
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={handleClearSource}
                />
              </Tooltip>
            )}
          </div>
          <Space>
            <span>X:</span>
            <InputNumber
              value={sourceRect?.x ?? 0}
              onChange={(v) => handleSourceChange("x", v)}
              precision={0}
              style={{ width: 80 }}
              disabled={!screenshot}
            />
            <span>Y:</span>
            <InputNumber
              value={sourceRect?.y ?? 0}
              onChange={(v) => handleSourceChange("y", v)}
              precision={0}
              style={{ width: 80 }}
              disabled={!screenshot}
            />
            <span>W:</span>
            <InputNumber
              value={sourceRect?.width ?? 0}
              onChange={(v) => handleSourceChange("width", v)}
              precision={0}
              style={{ width: 80 }}
              disabled={!screenshot}
            />
            <span>H:</span>
            <InputNumber
              value={sourceRect?.height ?? 0}
              onChange={(v) => handleSourceChange("height", v)}
              precision={0}
              style={{ width: 80 }}
              disabled={!screenshot}
            />
          </Space>
        </div>

        {/* 目标 ROI 参数 */}
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              marginBottom: 8,
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Tag color="orange">期望 ROI</Tag>
            [x, y, w, h]:
            {targetRect && (
              <Tooltip title="清除期望 ROI">
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={handleClearTarget}
                />
              </Tooltip>
            )}
          </div>
          <Space>
            <span>X:</span>
            <InputNumber
              value={targetRect?.x ?? 0}
              onChange={(v) => handleTargetChange("x", v)}
              precision={0}
              style={{ width: 80 }}
              disabled={!screenshot}
            />
            <span>Y:</span>
            <InputNumber
              value={targetRect?.y ?? 0}
              onChange={(v) => handleTargetChange("y", v)}
              precision={0}
              style={{ width: 80 }}
              disabled={!screenshot}
            />
            <span>W:</span>
            <InputNumber
              value={targetRect?.width ?? 0}
              onChange={(v) => handleTargetChange("width", v)}
              precision={0}
              style={{ width: 80 }}
              disabled={!screenshot}
            />
            <span>H:</span>
            <InputNumber
              value={targetRect?.height ?? 0}
              onChange={(v) => handleTargetChange("height", v)}
              precision={0}
              style={{ width: 80 }}
              disabled={!screenshot}
            />
          </Space>
        </div>

        <Divider style={{ margin: "12px 0" }} />

        {/* 偏移量结果 */}
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              marginBottom: 8,
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Tag color="green">计算结果</Tag>
            roi_offset [Δx, Δy, Δw, Δh]:
            {hasValidOffset && (
              <span style={{ fontSize: 12, color: "#52c41a" }}>
                = 期望 ROI - 原 ROI
              </span>
            )}
          </div>
          <Space>
            <span>Δx:</span>
            <InputNumber
              value={offset[0]}
              onChange={(v) => handleOffsetChange(0, v)}
              precision={0}
              style={{ width: 80 }}
              disabled={!screenshot || !sourceRect}
            />
            <span>Δy:</span>
            <InputNumber
              value={offset[1]}
              onChange={(v) => handleOffsetChange(1, v)}
              precision={0}
              style={{ width: 80 }}
              disabled={!screenshot || !sourceRect}
            />
            <span>Δw:</span>
            <InputNumber
              value={offset[2]}
              onChange={(v) => handleOffsetChange(2, v)}
              precision={0}
              style={{ width: 80 }}
              disabled={!screenshot || !sourceRect}
            />
            <span>Δh:</span>
            <InputNumber
              value={offset[3]}
              onChange={(v) => handleOffsetChange(3, v)}
              precision={0}
              style={{ width: 80 }}
              disabled={!screenshot || !sourceRect}
            />
          </Space>
          {!sourceRect && (
            <div style={{ marginTop: 8, color: "#999", fontSize: 12 }}>
              提示：先设置原 ROI，然后可通过直接输入偏移量自动计算期望 ROI
            </div>
          )}
        </div>
      </ScreenshotModalBase>
    );
  }
);
