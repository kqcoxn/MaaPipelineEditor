import { memo, useState, useCallback, useRef } from "react";
import { Space, InputNumber, message, Radio } from "antd";
import {
  ScreenshotModalBase,
  type CanvasRenderProps,
} from "./ScreenshotModalBase";

type DeltaMode = "dx" | "dy";

interface DeltaModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (delta: number, mode: DeltaMode) => void;
  initialMode?: DeltaMode;
}

interface Point {
  x: number;
  y: number;
}

export const DeltaModal = memo(
  ({ open, onClose, onConfirm, initialMode = "dx" }: DeltaModalProps) => {
    const [screenshot, setScreenshot] = useState<string | null>(null);
    const [startPoint, setStartPoint] = useState<Point | null>(null);
    const [endPoint, setEndPoint] = useState<Point | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [mode, setMode] = useState<DeltaMode>(initialMode);

    const imageRef = useRef<HTMLImageElement | null>(null);

    // 计算差值
    const getDelta = useCallback(() => {
      if (!startPoint || !endPoint) return 0;
      if (mode === "dx") {
        return Math.round(endPoint.x - startPoint.x);
      } else {
        return Math.round(endPoint.y - startPoint.y);
      }
    }, [startPoint, endPoint, mode]);

    // 重绘 canvas
    const redrawCanvas = useCallback(
      (canvas: HTMLCanvasElement | null) => {
        const ctx = canvas?.getContext("2d");
        const img = imageRef.current;
        if (!canvas || !ctx || !img) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        // 绘制起点
        if (startPoint) {
          ctx.fillStyle = "#52c41a";
          ctx.beginPath();
          ctx.arc(startPoint.x, startPoint.y, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // 绘制终点
        if (endPoint) {
          ctx.fillStyle = "#ff4a4a";
          ctx.beginPath();
          ctx.arc(endPoint.x, endPoint.y, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // 绘制连线
        if (startPoint && endPoint) {
          ctx.strokeStyle = mode === "dx" ? "#1890ff" : "#722ed1";
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(startPoint.x, startPoint.y);
          ctx.lineTo(endPoint.x, endPoint.y);
          ctx.stroke();
          ctx.setLineDash([]);

          // 绘制差值方向指示
          if (mode === "dx") {
            // 绘制水平辅助线
            ctx.strokeStyle = "rgba(24, 144, 255, 0.5)";
            ctx.beginPath();
            ctx.moveTo(startPoint.x, startPoint.y);
            ctx.lineTo(endPoint.x, startPoint.y);
            ctx.stroke();
          } else {
            // 绘制垂直辅助线
            ctx.strokeStyle = "rgba(114, 46, 209, 0.5)";
            ctx.beginPath();
            ctx.moveTo(startPoint.x, startPoint.y);
            ctx.lineTo(startPoint.x, endPoint.y);
            ctx.stroke();
          }
        }
      },
      [startPoint, endPoint, mode]
    );

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
          canvasRef,
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
          const x = Math.round((e.clientX - rect.left) / scale);
          const y = Math.round((e.clientY - rect.top) / scale);

          setIsDrawing(true);
          setStartPoint({ x, y });
          setEndPoint({ x, y });
        };

        const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
          if (isPanning) {
            updatePan(e.clientX, e.clientY);
            return;
          }

          if (!isDrawing) return;

          const canvas = canvasRef.current;
          if (!canvas) return;

          const rect = canvas.getBoundingClientRect();
          const x = Math.round((e.clientX - rect.left) / scale);
          const y = Math.round((e.clientY - rect.top) / scale);

          setEndPoint({ x, y });
        };

        const handleMouseUp = () => {
          if (isPanning) {
            endPan();
            return;
          }
          setIsDrawing(false);
        };

        return { handleMouseDown, handleMouseMove, handleMouseUp };
      },
      [isDrawing]
    );

    // 手动输入坐标
    const handleStartChange = useCallback(
      (key: "x" | "y", value: number | null) => {
        if (value === null) return;
        setStartPoint((prev) =>
          prev
            ? { ...prev, [key]: Math.round(value) }
            : { x: 0, y: 0, [key]: Math.round(value) }
        );
      },
      []
    );

    const handleEndChange = useCallback(
      (key: "x" | "y", value: number | null) => {
        if (value === null) return;
        setEndPoint((prev) =>
          prev
            ? { ...prev, [key]: Math.round(value) }
            : { x: 0, y: 0, [key]: Math.round(value) }
        );
      },
      []
    );

    // 确定回填
    const handleConfirm = useCallback(() => {
      if (!startPoint || !endPoint) {
        message.warning("请先在截图上拖动选择起点和终点");
        return;
      }

      const delta = getDelta();
      onConfirm(delta, mode);
      onClose();
    }, [startPoint, endPoint, getDelta, onConfirm, onClose, mode]);

    // 重置状态
    const handleReset = useCallback(() => {
      setScreenshot(null);
      setStartPoint(null);
      setEndPoint(null);
      setIsDrawing(false);
      setMode(initialMode);
      imageRef.current = null;
    }, [initialMode]);

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
        } = props;
        const { handleMouseDown, handleMouseMove, handleMouseUp } =
          createMouseHandlers(props);

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
              redrawCanvas(canvas);
            };
            img.src = screenshot;
          } else {
            redrawCanvas(canvas);
          }
        }

        const cursorStyle = getBaseCursorStyle() || "crosshair";

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
      [createMouseHandlers, redrawCanvas]
    );

    const deltaValue = getDelta();
    const modeLabel = mode === "dx" ? "水平差 (dx)" : "垂直差 (dy)";
    const modeColor = mode === "dx" ? "#1890ff" : "#722ed1";

    return (
      <ScreenshotModalBase
        open={open}
        onClose={onClose}
        title="位移差值配置"
        width={900}
        confirmDisabled={!startPoint || !endPoint}
        onConfirm={handleConfirm}
        renderCanvas={renderCanvas}
        onScreenshotChange={setScreenshot}
        onReset={handleReset}
      >
        {/* 模式切换 */}
        <div style={{ marginBottom: 12 }}>
          <Radio.Group
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            buttonStyle="solid"
          >
            <Radio.Button value="dx">水平差 (dx)</Radio.Button>
            <Radio.Button value="dy">垂直差 (dy)</Radio.Button>
          </Radio.Group>
        </div>

        {/* 提示信息 */}
        <div style={{ marginBottom: 12, color: "#666", fontSize: 13 }}>
          在截图上拖动鼠标，从起点拖到终点，将计算
          {mode === "dx" ? "水平" : "垂直"}方向的位移差值。
        </div>

        {/* 起点与终点坐标 */}
        <div style={{ marginBottom: 12 }}>
          <Space size="large" wrap>
            <Space>
              <span style={{ fontWeight: 500, color: "#52c41a" }}>起点:</span>
              <span>X:</span>
              <InputNumber
                value={startPoint?.x ?? 0}
                onChange={(v) => handleStartChange("x", v)}
                precision={0}
                style={{ width: 80 }}
                disabled={!screenshot}
              />
              <span>Y:</span>
              <InputNumber
                value={startPoint?.y ?? 0}
                onChange={(v) => handleStartChange("y", v)}
                precision={0}
                style={{ width: 80 }}
                disabled={!screenshot}
              />
            </Space>
            <Space>
              <span style={{ fontWeight: 500, color: "#ff4a4a" }}>终点:</span>
              <span>X:</span>
              <InputNumber
                value={endPoint?.x ?? 0}
                onChange={(v) => handleEndChange("x", v)}
                precision={0}
                style={{ width: 80 }}
                disabled={!screenshot}
              />
              <span>Y:</span>
              <InputNumber
                value={endPoint?.y ?? 0}
                onChange={(v) => handleEndChange("y", v)}
                precision={0}
                style={{ width: 80 }}
                disabled={!screenshot}
              />
            </Space>
          </Space>
        </div>

        {/* 差值结果 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 500, color: modeColor }}>
            {modeLabel}:
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 600,
              color: modeColor,
              padding: "8px 16px",
              background: `${modeColor}10`,
              borderRadius: 6,
              display: "inline-block",
            }}
          >
            {deltaValue}
          </div>
          <span style={{ marginLeft: 12, color: "#999", fontSize: 13 }}>
            = {mode === "dx" ? "终点X - 起点X" : "终点Y - 起点Y"}
            {startPoint && endPoint && (
              <span>
                {" "}
                = {mode === "dx" ? endPoint.x : endPoint.y} -{" "}
                {mode === "dx" ? startPoint.x : startPoint.y}
              </span>
            )}
          </span>
        </div>
      </ScreenshotModalBase>
    );
  }
);
