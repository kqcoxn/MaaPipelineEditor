import { memo, useState, useCallback, useEffect, useRef } from "react";
import {
  Modal,
  Button,
  Space,
  InputNumber,
  message,
  Spin,
  Input,
  Tooltip,
} from "antd";
import {
  ReloadOutlined,
  CheckOutlined,
  CloseOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  FullscreenOutlined,
  ClearOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import { useMFWStore } from "../../stores/mfwStore";
import { mfwProtocol } from "../../services/server";
import { useCanvasViewport } from "../../hooks/useCanvasViewport";

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
    const [isLoading, setIsLoading] = useState(false);
    const [isOCRing, setIsOCRing] = useState(false);
    const [rectangle, setRectangle] = useState<Rectangle | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPoint, setStartPoint] = useState<{
      x: number;
      y: number;
    } | null>(null);
    const [ocrText, setOcrText] = useState<string>("");
    const [ocrSuccess, setOcrSuccess] = useState<boolean | null>(null);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const ocrDebounceRef = useRef<NodeJS.Timeout | null>(null);

    // 使用视口控制 Hook
    const {
      scale,
      panOffset,
      isPanning,
      isSpacePressed,
      isMiddleMouseDown,
      containerRef,
      imageRef,
      handleZoomIn,
      handleZoomOut,
      handleZoomReset,
      startPan,
      updatePan,
      endPan,
      initializeImage,
      resetViewport,
      getBaseCursorStyle,
    } = useCanvasViewport({ open, screenshot });

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

    // 请求截图
    const requestScreenshot = useCallback(() => {
      if (connectionStatus !== "connected" || !controllerId) {
        message.error("请先连接设备");
        return;
      }

      setIsLoading(true);
      mfwProtocol.requestScreencap({ controller_id: controllerId });
    }, [connectionStatus, controllerId]);

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

    // 监听截图结果
    useEffect(() => {
      if (!open) return;

      const handleScreencap = (data: {
        success: boolean;
        image?: string;
        error?: string;
      }) => {
        setIsLoading(false);
        if (data.success && data.image) {
          setScreenshot(data.image);
        } else {
          message.error(data.error || "截图失败");
        }
      };

      const unregisterScreencap =
        mfwProtocol.onScreencapResult(handleScreencap);

      // 监听 OCR 结果
      const handleOCRResult = (data: OCRResult) => {
        setIsOCRing(false);
        if (data.success) {
          setOcrText(data.text ?? "");

          // 检查是否未检测到内容
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

      if (open && !screenshot) {
        requestScreenshot();
      }

      return () => {
        unregisterScreencap();
        unregisterOCR();
      };
    }, [open, requestScreenshot, screenshot]);

    // 加载截图到 canvas
    useEffect(() => {
      if (!screenshot || !canvasRef.current) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        initializeImage(img);
        redrawCanvas();
      };
      img.src = screenshot;
    }, [screenshot, initializeImage]);

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

    useEffect(() => {
      redrawCanvas();
    }, [rectangle, redrawCanvas]);

    // 鼠标按下
    const handleMouseDown = useCallback(
      (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas || !screenshot) return;

        // 中键拖动模式
        if (e.button === 1) {
          e.preventDefault();
          startPan(e.clientX, e.clientY, true);
          return;
        }

        // 空格拖动模式
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
      },
      [scale, screenshot, isSpacePressed, startPan]
    );

    // 鼠标移动
    const handleMouseMove = useCallback(
      (e: React.MouseEvent<HTMLCanvasElement>) => {
        // 拖动模式
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

        setRectangle(newRect);
      },
      [isDrawing, startPoint, scale, isPanning, updatePan]
    );

    // 鼠标抬起
    const handleMouseUp = useCallback(() => {
      // 结束拖动
      if (isPanning) {
        endPan();
        return;
      }
      if (!isDrawing) {
        return;
      }

      setIsDrawing(false);
      setStartPoint(null);

      // 防抖触发 OCR
      if (rectangle && rectangle.width > 10 && rectangle.height > 10) {
        if (ocrDebounceRef.current) {
          clearTimeout(ocrDebounceRef.current);
        }
        // 标记为识别中状态
        setIsOCRing(true);
        setOcrSuccess(null);
        ocrDebounceRef.current = setTimeout(() => {
          requestOCR(rectangle);
        }, 500);
      }
    }, [rectangle, requestOCR, isPanning, endPan, isDrawing]);

    // 结束状态
    const handleMouseLeave = useCallback(() => {
      if (isPanning) {
        endPan();
      }
      setIsDrawing(false);
      setStartPoint(null);
    }, [isPanning, endPan]);

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
          // 标记为识别中状态
          setIsOCRing(true);
          setOcrSuccess(null);
          ocrDebounceRef.current = setTimeout(() => {
            requestOCR(newRect);
          }, 500);
        }
      },
      [rectangle, requestOCR]
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

    // 关闭时重置状态
    const handleClose = useCallback(() => {
      setScreenshot(null);
      setRectangle(null);
      setIsDrawing(false);
      setStartPoint(null);
      setOcrText("");
      setOcrSuccess(null);
      resetViewport();
      if (ocrDebounceRef.current) {
        clearTimeout(ocrDebounceRef.current);
      }
      onClose();
    }, [onClose, resetViewport]);

    // 获取光标样式
    const getCursorStyle = useCallback(() => {
      return getBaseCursorStyle() || "crosshair";
    }, [getBaseCursorStyle]);

    return (
      <Modal
        title="OCR 文字识别预览"
        open={open}
        onCancel={handleClose}
        width={900}
        footer={null}
        styles={{
          body: { maxHeight: "calc(100vh - 200px)", overflowY: "auto" },
        }}
      >
        <Spin spinning={isLoading} tip="截图中...">
          {/* 缩放控制栏 */}
          {screenshot && (
            <div
              style={{
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Space>
                <Tooltip title="缩小 (滚轮向下)">
                  <Button
                    size="small"
                    icon={<ZoomOutOutlined />}
                    onClick={handleZoomOut}
                  />
                </Tooltip>
                <span style={{ minWidth: 50, textAlign: "center" }}>
                  {Math.round(scale * 100)}%
                </span>
                <Tooltip title="放大 (滚轮向上)">
                  <Button
                    size="small"
                    icon={<ZoomInOutlined />}
                    onClick={handleZoomIn}
                  />
                </Tooltip>
                <Tooltip title="适应窗口">
                  <Button
                    size="small"
                    icon={<FullscreenOutlined />}
                    onClick={handleZoomReset}
                  />
                </Tooltip>
              </Space>
              <span style={{ color: "#999", fontSize: 12 }}>
                提示：滚轮缩放 | 按住空格或中键拖动
              </span>
            </div>
          )}

          {/* 截图显示区 */}
          <div
            ref={containerRef}
            style={{
              marginBottom: 16,
              backgroundColor: "#f0f0f0",
              borderRadius: 4,
              height: 450,
              overflow: "hidden",
              position: "relative",
            }}
          >
            {screenshot ? (
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                style={{
                  cursor: getCursorStyle(),
                  transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${scale})`,
                  transformOrigin: "top left",
                  position: "absolute",
                }}
              />
            ) : (
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ color: "#666" }}>等待截图...</span>
              </div>
            )}
          </div>

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

          {/* 操作按钮 */}
          <Space style={{ width: "100%", justifyContent: "flex-end" }}>
            <Button
              icon={<ReloadOutlined />}
              onClick={requestScreenshot}
              disabled={isLoading}
            >
              重新截图
            </Button>
            <Button icon={<CloseOutlined />} onClick={handleClose}>
              取消
            </Button>
            <Button
              type="primary"
              icon={<CheckOutlined />}
              onClick={handleConfirm}
              disabled={!ocrText}
            >
              确定（添加到字段）
            </Button>
          </Space>
        </Spin>
      </Modal>
    );
  }
);
