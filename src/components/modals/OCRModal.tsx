import { memo, useState, useCallback, useEffect, useRef } from "react";
import { Space, InputNumber, message, Input, Button } from "antd";
import { ClearOutlined, CheckCircleOutlined } from "@ant-design/icons";
import { useMFWStore } from "../../stores/mfwStore";
import { mfwProtocol } from "../../services/server";
import {
  ScreenshotModalBase,
  type CanvasRenderProps,
  type ViewportProps,
} from "./ScreenshotModalBase";

const { TextArea } = Input;

interface OCRModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (text: string, roi?: [number, number, number, number]) => void;
  initialROI?: [number, number, number, number];
}

interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface OCRResult {
  success: boolean;
  text?: string;
  boxes?: Array<{ x: number; y: number; w: number; h: number; text: string }>;
  error?: string;
  no_content?: boolean;
}

export const OCRModal = memo(
  ({ open, onClose, onConfirm, initialROI }: OCRModalProps) => {
    const { connectionStatus, controllerId } = useMFWStore();
    const [screenshot, setScreenshot] = useState<string | null>(null);
    const [isOCRing, setIsOCRing] = useState(false);
    const [rectangle, setRectangle] = useState<Rectangle | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPoint, setStartPoint] = useState<{
      x: number;
      y: number;
    } | null>(null);
    const [ocrText, setOcrText] = useState<string>("");
    const [ocrSuccess, setOcrSuccess] = useState<boolean | null>(null);

    const imageRef = useRef<HTMLImageElement | null>(null);
    const ocrDebounceRef = useRef<NodeJS.Timeout | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const viewportPropsRef = useRef<ViewportProps | null>(null);

    // 初始化 ROI
    const initializedRef = useRef(false);
    useEffect(() => {
      if (initialROI && screenshot && !initializedRef.current) {
        setRectangle({
          x: initialROI[0],
          y: initialROI[1],
          width: initialROI[2],
          height: initialROI[3],
        });
        initializedRef.current = true;
      }

      if (!open) {
        initializedRef.current = false;
      }
    }, [initialROI, screenshot, open]);

    // 请求 OCR 识别
    const requestOCR = useCallback(
      (roi: Rectangle) => {
        if (connectionStatus !== "connected" || !controllerId) {
          return;
        }
        if (isOCRing) {
          return;
        }

        setIsOCRing(true);
        mfwProtocol.requestOCR({
          controller_id: controllerId,
          roi: [
            Math.round(roi.x),
            Math.round(roi.y),
            Math.round(roi.width),
            Math.round(roi.height),
          ],
        });
      },
      [connectionStatus, controllerId, isOCRing]
    );

    // 监听 OCR 结果
    useEffect(() => {
      if (!open) return;

      const handleOCRResult = (data: OCRResult) => {
        setIsOCRing(false);
        if (data.success) {
          setOcrText(data.text ?? "");
          if (data.no_content) {
            setOcrSuccess(false);
          } else {
            setOcrSuccess(true);
          }
        } else if (data.error) {
          message.error(data.error);
          setOcrSuccess(false);
        }
      };

      const unregisterOCR = mfwProtocol.onOCRResult(handleOCRResult);

      return () => {
        unregisterOCR();
      };
    }, [open]);

    // 重绘 canvas
    const redrawCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      const img = imageRef.current;
      if (!canvas || !ctx || !img) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      if (rectangle) {
        ctx.strokeStyle = "#1890ff";
        ctx.lineWidth = 2;
        ctx.fillStyle = "rgba(24, 144, 255, 0.1)";
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
    }, [rectangle]);

    // 加载截图图片
    useEffect(() => {
      if (!screenshot || !canvasRef.current) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // 如果已有图片且是同一张直接重绘
      if (imageRef.current && imageRef.current.src === screenshot) {
        redrawCanvas();
        return;
      }

      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        imageRef.current = img;
        viewportPropsRef.current?.initializeImage(img);
        redrawCanvas();
      };
      img.src = screenshot;
    }, [screenshot, redrawCanvas]);

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
          setRectangle({ x, y, width: 0, height: 0 });
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
          if (!isDrawing) return;

          setIsDrawing(false);
          setStartPoint(null);

          // 防抖触发 OCR
          if (rectangle && rectangle.width > 10 && rectangle.height > 10) {
            if (ocrDebounceRef.current) {
              clearTimeout(ocrDebounceRef.current);
            }
            setIsOCRing(true);
            setOcrSuccess(null);
            ocrDebounceRef.current = setTimeout(() => {
              requestOCR(rectangle);
            }, 500);
          }
        };

        const handleMouseLeave = () => {
          if (isPanning) {
            endPan();
          }
          setIsDrawing(false);
          setStartPoint(null);
        };

        return {
          handleMouseDown,
          handleMouseMove,
          handleMouseUp,
          handleMouseLeave,
        };
      },
      [isDrawing, startPoint, rectangle, requestOCR]
    );

    // 确定回填
    const handleConfirm = useCallback(() => {
      if (!ocrText) {
        message.warning("请先框选区域进行识别");
        return;
      }

      const roi: [number, number, number, number] | undefined = rectangle
        ? [
            Math.round(rectangle.x),
            Math.round(rectangle.y),
            Math.round(rectangle.width),
            Math.round(rectangle.height),
          ]
        : undefined;

      onConfirm(ocrText, roi);
      onClose();
    }, [ocrText, rectangle, onConfirm, onClose]);

    // 重置状态
    const handleReset = useCallback(() => {
      setScreenshot(null);
      setRectangle(null);
      setIsDrawing(false);
      setStartPoint(null);
      setOcrText("");
      setOcrSuccess(null);
      imageRef.current = null;
      canvasRef.current = null;
      viewportPropsRef.current = null;
      if (ocrDebounceRef.current) {
        clearTimeout(ocrDebounceRef.current);
      }
    }, []);

    // 渲染 Canvas
    const renderCanvas = useCallback(
      (props: CanvasRenderProps) => {
        const { scale, panOffset, getBaseCursorStyle } = props;

        viewportPropsRef.current = props;
        const {
          handleMouseDown,
          handleMouseMove,
          handleMouseUp,
          handleMouseLeave,
        } = createMouseHandlers(props);

        const cursorStyle = getBaseCursorStyle() || "crosshair";

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
      [createMouseHandlers]
    );

    // 手动输入坐标
    const handleCoordinateChange = useCallback(
      (key: keyof Rectangle, value: number | null) => {
        if (value === null) return;
        const newRect = rectangle
          ? { ...rectangle, [key]: Math.round(value) }
          : null;
        setRectangle(newRect);

        // 坐标变化后重新 OCR
        if (newRect && newRect.width > 10 && newRect.height > 10) {
          if (ocrDebounceRef.current) {
            clearTimeout(ocrDebounceRef.current);
          }
          setIsOCRing(true);
          setOcrSuccess(null);
          ocrDebounceRef.current = setTimeout(() => {
            requestOCR(newRect);
          }, 500);
        }
      },
      [rectangle, requestOCR]
    );

    return (
      <ScreenshotModalBase
        open={open}
        onClose={onClose}
        title="OCR 文字识别预览"
        width={900}
        confirmText="确定（添加到字段）"
        confirmDisabled={!ocrText}
        onConfirm={handleConfirm}
        renderCanvas={renderCanvas}
        onScreenshotChange={setScreenshot}
        onReset={handleReset}
      >
        {/* ROI 参数显示与输入 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>
            ROI 坐标 [x, y, w, h]:
          </div>
          <Space>
            <span>X:</span>
            <InputNumber
              value={rectangle?.x ?? 0}
              onChange={(v) => handleCoordinateChange("x", v)}
              precision={0}
              style={{ width: 80 }}
              disabled={!screenshot}
            />
            <span>Y:</span>
            <InputNumber
              value={rectangle?.y ?? 0}
              onChange={(v) => handleCoordinateChange("y", v)}
              precision={0}
              style={{ width: 80 }}
              disabled={!screenshot}
            />
            <span>W:</span>
            <InputNumber
              value={rectangle?.width ?? 0}
              onChange={(v) => handleCoordinateChange("width", v)}
              precision={0}
              style={{ width: 80 }}
              disabled={!screenshot}
            />
            <span>H:</span>
            <InputNumber
              value={rectangle?.height ?? 0}
              onChange={(v) => handleCoordinateChange("height", v)}
              precision={0}
              style={{ width: 80 }}
              disabled={!screenshot}
            />
          </Space>
        </div>

        {/* OCR 识别结果 */}
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              marginBottom: 8,
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              识别结果:
              {isOCRing && (
                <span style={{ marginLeft: 8, color: "#1890ff" }}>
                  识别中...
                </span>
              )}
              {!isOCRing && ocrSuccess === true && (
                <span style={{ marginLeft: 8, color: "#52c41a" }}>
                  <CheckCircleOutlined /> 识别成功
                </span>
              )}
              {!isOCRing && ocrSuccess === false && ocrText === "" && (
                <span style={{ marginLeft: 8, color: "#faad14" }}>
                  未检测到文字内容
                </span>
              )}
            </div>
            <Button
              size="small"
              icon={<ClearOutlined />}
              onClick={() => {
                setOcrText("");
                setOcrSuccess(null);
              }}
              disabled={!ocrText}
            >
              清空
            </Button>
          </div>
          <TextArea
            value={ocrText}
            onChange={(e) => {
              setOcrText(e.target.value);
              if (ocrSuccess !== null) setOcrSuccess(null);
            }}
            placeholder="在截图上框选区域后，系统将自动识别文字"
            rows={4}
            style={{ resize: "none" }}
            disabled={isOCRing}
          />
        </div>
      </ScreenshotModalBase>
    );
  }
);
