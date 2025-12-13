import { memo, useState, useCallback, useEffect, useRef } from "react";
import { Button, Space, InputNumber, message, Slider, Radio } from "antd";
import { BgColorsOutlined, ClearOutlined } from "@ant-design/icons";
import {
  ScreenshotModalBase,
  type CanvasRenderProps,
  type ViewportProps,
} from "./ScreenshotModalBase";
import { mfwProtocol } from "../../services/server";

interface TemplateModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (
    templatePath: string,
    greenMask: boolean,
    roi?: [number, number, number, number]
  ) => void;
  initialROI?: [number, number, number, number];
}

interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

type DrawTool = "none" | "select" | "brush" | "eraser";

export const TemplateModal = memo(
  ({ open, onClose, onConfirm, initialROI }: TemplateModalProps) => {
    const [screenshot, setScreenshot] = useState<string | null>(null);
    const [rectangle, setRectangle] = useState<Rectangle | null>(null);
    const [currentTool, setCurrentTool] = useState<DrawTool>("select");
    const [brushSize, setBrushSize] = useState(15);
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPoint, setStartPoint] = useState<{
      x: number;
      y: number;
    } | null>(null);
    const [hasGreenMask, setHasGreenMask] = useState(false);

    const imageRef = useRef<HTMLImageElement | null>(null);
    const maskCanvasRef = useRef<HTMLCanvasElement>(null);
    const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(
      null
    );

    // 用于存储待确认的 ROI
    const pendingRoiRef = useRef<[number, number, number, number] | null>(null);
    // 用于存储绿色遮罩状态
    const pendingGreenMaskRef = useRef<boolean>(false);
    // 用于存储文件名
    const pendingFileNameRef = useRef<string>("");

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

    // 监听图片路径解析结果
    useEffect(() => {
      const unsubscribe = mfwProtocol.onImagePathResolved((data) => {
        const roi = pendingRoiRef.current;
        const greenMask = pendingGreenMaskRef.current;
        const fileName = pendingFileNameRef.current;

        if (data.success && roi) {
          onConfirm(data.relative_path, greenMask, roi);
        } else if (roi && fileName) {
          message.warning("无法自动确定路径，已填充文件名，请手动调整");
          onConfirm(fileName, greenMask, roi);
        }

        // 清空待确认的数据
        pendingRoiRef.current = null;
        pendingGreenMaskRef.current = false;
        pendingFileNameRef.current = "";
      });

      return () => unsubscribe();
    }, [onConfirm]);

    // 重绘 canvas
    const redrawCanvas = useCallback(
      (canvas: HTMLCanvasElement | null) => {
        const ctx = canvas?.getContext("2d");
        const maskCanvas = maskCanvasRef.current;
        const maskCtx = maskCanvas?.getContext("2d");
        const img = imageRef.current;
        if (!canvas || !ctx || !img) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        // 绘制遮罩层
        if (maskCanvas && maskCtx) {
          ctx.globalAlpha = 0.7;
          ctx.drawImage(maskCanvas, 0, 0);
          ctx.globalAlpha = 1.0;
        }

        // 绘制选择框
        if (rectangle && currentTool !== "brush" && currentTool !== "eraser") {
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

        // 绘制画笔/橡皮擦预览圆
        if (mousePos && (currentTool === "brush" || currentTool === "eraser")) {
          ctx.beginPath();
          ctx.arc(mousePos.x, mousePos.y, brushSize / 2, 0, Math.PI * 2);
          ctx.strokeStyle =
            currentTool === "brush"
              ? "rgba(0, 255, 0, 0.8)"
              : "rgba(255, 0, 0, 0.8)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      },
      [rectangle, currentTool, mousePos, brushSize]
    );

    // 绘制遮罩
    const drawMask = useCallback(
      (
        x: number,
        y: number,
        tool: "brush" | "eraser",
        canvas: HTMLCanvasElement | null
      ) => {
        const maskCanvas = maskCanvasRef.current;
        const maskCtx = maskCanvas?.getContext("2d");
        if (!maskCtx) return;

        maskCtx.beginPath();
        maskCtx.arc(x, y, brushSize / 2, 0, Math.PI * 2);

        if (tool === "brush") {
          maskCtx.fillStyle = "rgb(0, 255, 0)";
          maskCtx.fill();
          setHasGreenMask(true);
        } else {
          maskCtx.globalCompositeOperation = "destination-out";
          maskCtx.fill();
          maskCtx.globalCompositeOperation = "source-over";
        }

        redrawCanvas(canvas);
      },
      [brushSize, redrawCanvas]
    );

    // 清除遮罩
    const clearMask = useCallback(
      (canvas: HTMLCanvasElement | null) => {
        const maskCanvas = maskCanvasRef.current;
        const maskCtx = maskCanvas?.getContext("2d");
        if (!maskCtx || !maskCanvas) return;

        maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
        setHasGreenMask(false);
        redrawCanvas(canvas);
      },
      [redrawCanvas]
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
          const x = (e.clientX - rect.left) / scale;
          const y = (e.clientY - rect.top) / scale;

          setIsDrawing(true);
          setStartPoint({ x, y });

          if (currentTool === "select") {
            setRectangle({ x, y, width: 0, height: 0 });
          } else if (currentTool === "brush" || currentTool === "eraser") {
            drawMask(x, y, currentTool, canvas);
          }
        };

        const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
          const canvas = canvasRef.current;
          if (!canvas) return;

          const rect = canvas.getBoundingClientRect();
          const currentX = (e.clientX - rect.left) / scale;
          const currentY = (e.clientY - rect.top) / scale;

          // 更新鼠标位置用于显示画笔预览
          if (currentTool === "brush" || currentTool === "eraser") {
            setMousePos({ x: currentX, y: currentY });
          }

          if (isPanning) {
            updatePan(e.clientX, e.clientY);
            return;
          }

          if (!isDrawing || !startPoint) return;

          if (currentTool === "select") {
            const width = currentX - startPoint.x;
            const height = currentY - startPoint.y;
            setRectangle({
              x: width < 0 ? currentX : startPoint.x,
              y: height < 0 ? currentY : startPoint.y,
              width: Math.abs(width),
              height: Math.abs(height),
            });
          } else if (currentTool === "brush" || currentTool === "eraser") {
            drawMask(currentX, currentY, currentTool, canvas);
          }
        };

        const handleMouseLeave = () => {
          setMousePos(null);
          if (isPanning) {
            endPan();
            return;
          }
          setIsDrawing(false);
          setStartPoint(null);
        };

        const handleMouseUp = () => {
          if (isPanning) {
            endPan();
            return;
          }
          setIsDrawing(false);
          setStartPoint(null);
        };

        const handleMouseEnter = (e: React.MouseEvent<HTMLCanvasElement>) => {
          const canvas = canvasRef.current;
          if (!canvas) return;
          const rect = canvas.getBoundingClientRect();
          const x = (e.clientX - rect.left) / scale;
          const y = (e.clientY - rect.top) / scale;
          if (currentTool === "brush" || currentTool === "eraser") {
            setMousePos({ x, y });
          }
        };

        return {
          handleMouseDown,
          handleMouseMove,
          handleMouseUp,
          handleMouseLeave,
          handleMouseEnter,
        };
      },
      [isDrawing, startPoint, currentTool, drawMask]
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

    // 保存模板
    const handleSave = useCallback(async () => {
      if (!rectangle || !imageRef.current) {
        message.warning("请先框选模板区域");
        return;
      }

      const tempCanvas = document.createElement("canvas");
      const tempCtx = tempCanvas.getContext("2d");
      if (!tempCtx) return;

      tempCanvas.width = rectangle.width;
      tempCanvas.height = rectangle.height;

      // 绘制裁剪后的截图
      tempCtx.drawImage(
        imageRef.current,
        rectangle.x,
        rectangle.y,
        rectangle.width,
        rectangle.height,
        0,
        0,
        rectangle.width,
        rectangle.height
      );

      // 叠加绘制遮罩层
      const maskCanvas = maskCanvasRef.current;
      if (maskCanvas && hasGreenMask) {
        tempCtx.drawImage(
          maskCanvas,
          rectangle.x,
          rectangle.y,
          rectangle.width,
          rectangle.height,
          0,
          0,
          rectangle.width,
          rectangle.height
        );
      }

      // 导出为 PNG
      const blob = await new Promise<Blob | null>((resolve) =>
        tempCanvas.toBlob(resolve, "image/png")
      );

      if (!blob) {
        message.error("生成模板图片失败");
        return;
      }

      const timestamp = Date.now();
      const defaultFilename = `template_${timestamp}.png`;

      const roi: [number, number, number, number] = [
        Math.round(rectangle.x),
        Math.round(rectangle.y),
        Math.round(rectangle.width),
        Math.round(rectangle.height),
      ];

      // 尝试使用 File System Access API
      if ("showSaveFilePicker" in window) {
        try {
          const fileHandle = await (window as any).showSaveFilePicker({
            suggestedName: defaultFilename,
            types: [
              {
                description: "PNG 图片",
                accept: { "image/png": [".png"] },
              },
            ],
          });

          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();

          const filename = fileHandle.name;
          message.success("模板已保存");

          // 存储待确认的数据
          pendingRoiRef.current = roi;
          pendingGreenMaskRef.current = hasGreenMask;
          pendingFileNameRef.current = filename;

          // 请求后端解析相对路径
          setTimeout(() => {
            mfwProtocol.requestResolveImagePath(filename);
          }, 500);
        } catch (err: any) {
          if (err.name !== "AbortError") {
            message.error("保存失败: " + err.message);
          }
        }
      } else {
        // 降级方案：传统下载
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = defaultFilename;
        a.click();
        URL.revokeObjectURL(url);

        message.success("模板已保存");

        // 存储待确认的数据并尝试解析
        pendingRoiRef.current = roi;
        pendingGreenMaskRef.current = hasGreenMask;
        pendingFileNameRef.current = defaultFilename;

        setTimeout(() => {
          mfwProtocol.requestResolveImagePath(defaultFilename);
        }, 500);
      }
    }, [rectangle, hasGreenMask]);

    // 重置状态
    const handleReset = useCallback(() => {
      setScreenshot(null);
      setRectangle(null);
      setIsDrawing(false);
      setStartPoint(null);
      setCurrentTool("select");
      setHasGreenMask(false);
      // 清除遮罩层
      const maskCanvas = maskCanvasRef.current;
      const maskCtx = maskCanvas?.getContext("2d");
      if (maskCtx && maskCanvas) {
        maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
      }
    }, []);

    // 渲染工具栏
    const renderToolbar = useCallback(
      (_props: ViewportProps) => (
        <>
          <div>
            <span style={{ marginRight: 8, fontWeight: 500 }}>工具:</span>
            <Radio.Group
              value={currentTool}
              onChange={(e) => setCurrentTool(e.target.value)}
            >
              <Radio.Button value="select">框选</Radio.Button>
              <Radio.Button value="brush">画笔</Radio.Button>
              <Radio.Button value="eraser">橡皮擦</Radio.Button>
            </Radio.Group>
            <Button
              icon={<ClearOutlined />}
              onClick={() => clearMask(null)}
              style={{ marginLeft: 8 }}
              size="small"
            >
              清除遮罩
            </Button>
          </div>
        </>
      ),
      [currentTool, clearMask]
    );

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
        const {
          handleMouseDown,
          handleMouseMove,
          handleMouseUp,
          handleMouseLeave,
          handleMouseEnter,
        } = createMouseHandlers(props);

        // 加载图片
        if (screenshot && canvasRef.current) {
          const canvas = canvasRef.current;
          const maskCanvas = maskCanvasRef.current;
          const ctx = canvas.getContext("2d");
          if (ctx && !imageRef.current) {
            const img = new Image();
            img.onload = () => {
              canvas.width = img.width;
              canvas.height = img.height;
              if (maskCanvas) {
                maskCanvas.width = img.width;
                maskCanvas.height = img.height;
              }
              imageRef.current = img;
              initializeImage(img);
              redrawCanvas(canvas);
            };
            img.src = screenshot;
          } else {
            redrawCanvas(canvas);
          }
        }

        const baseCursor = getBaseCursorStyle();
        let cursorStyle: string;
        if (baseCursor) {
          cursorStyle = baseCursor;
        } else if (currentTool === "select") {
          cursorStyle = "crosshair";
        } else if (currentTool === "brush") {
          cursorStyle = "cell";
        } else {
          cursorStyle = "not-allowed";
        }

        return (
          <>
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              onMouseEnter={handleMouseEnter}
              style={{
                cursor: cursorStyle,
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${scale})`,
                transformOrigin: "top left",
                position: "absolute",
              }}
            />
            <canvas ref={maskCanvasRef} style={{ display: "none" }} />
          </>
        );
      },
      [createMouseHandlers, redrawCanvas, currentTool]
    );

    return (
      <ScreenshotModalBase
        open={open}
        onClose={onClose}
        title="模板图片编辑"
        width={950}
        confirmText="保存模板"
        confirmDisabled={!rectangle}
        onConfirm={handleSave}
        renderToolbar={renderToolbar}
        renderCanvas={renderCanvas}
        onScreenshotChange={setScreenshot}
        onReset={handleReset}
      >
        {/* 画笔大小调节 */}
        {(currentTool === "brush" || currentTool === "eraser") && (
          <div
            style={{
              marginBottom: 16,
              padding: "12px",
              backgroundColor: "#fafafa",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <span style={{ marginRight: 8, width: 80 }}>画笔大小:</span>
            <Slider
              value={brushSize}
              onChange={setBrushSize}
              min={5}
              max={50}
              style={{ flex: 1, maxWidth: 200 }}
            />
            <span style={{ marginLeft: 8, width: 40 }}>{brushSize}px</span>
          </div>
        )}

        {/* ROI 参数 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>
            模板区域 [x, y, w, h]:
          </div>
          <Space>
            <span>X:</span>
            <InputNumber
              value={rectangle?.x ?? 0}
              onChange={(v) => handleCoordinateChange("x", v)}
              precision={0}
              style={{ width: 80 }}
              disabled={!screenshot || currentTool !== "select"}
            />
            <span>Y:</span>
            <InputNumber
              value={rectangle?.y ?? 0}
              onChange={(v) => handleCoordinateChange("y", v)}
              precision={0}
              style={{ width: 80 }}
              disabled={!screenshot || currentTool !== "select"}
            />
            <span>W:</span>
            <InputNumber
              value={rectangle?.width ?? 0}
              onChange={(v) => handleCoordinateChange("width", v)}
              precision={0}
              style={{ width: 80 }}
              disabled={!screenshot || currentTool !== "select"}
            />
            <span>H:</span>
            <InputNumber
              value={rectangle?.height ?? 0}
              onChange={(v) => handleCoordinateChange("height", v)}
              precision={0}
              style={{ width: 80 }}
              disabled={!screenshot || currentTool !== "select"}
            />
          </Space>
        </div>

        {/* 绿色遮罩状态 */}
        <div style={{ marginBottom: 16 }}>
          <Space>
            <BgColorsOutlined
              style={{ color: hasGreenMask ? "#52c41a" : "#999" }}
            />
            <span>绿色遮罩: {hasGreenMask ? "已启用" : "未使用"}</span>
          </Space>
        </div>
      </ScreenshotModalBase>
    );
  }
);
