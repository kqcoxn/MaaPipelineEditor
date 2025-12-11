import { memo, useState, useCallback, useEffect, useRef } from "react";
import { Modal, Button, Space, InputNumber, message, Spin } from "antd";
import { ReloadOutlined, CheckOutlined, CloseOutlined } from "@ant-design/icons";
import { useMFWStore } from "../../stores/mfwStore";
import { mfwProtocol } from "../../services/server";

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

export const ROIModal = memo(({ open, onClose, onConfirm, initialROI }: ROIModalProps) => {
  const { connectionStatus, controllerId } = useMFWStore();
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [scale, setScale] = useState(1);
  const [rectangle, setRectangle] = useState<Rectangle | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

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

  // 请求截图
  const requestScreenshot = useCallback(() => {
    if (connectionStatus !== "connected" || !controllerId) {
      message.error("请先连接设备");
      return;
    }

    setIsLoading(true);
    mfwProtocol.requestScreencap({ controller_id: controllerId });
  }, [connectionStatus, controllerId]);

  // 监听截图结果
  useEffect(() => {
    if (!open) return;

    const handleScreencap = (data: { success: boolean; image?: string; error?: string }) => {
      setIsLoading(false);
      if (data.success && data.image) {
        setScreenshot(data.image);
      } else {
        message.error(data.error || "截图失败");
      }
    };

    // 注册临时监听器
    const unregister = mfwProtocol.onScreencapResult(handleScreencap);
    
    // 首次打开时自动截图
    if (open && !screenshot) {
      requestScreenshot();
    }

    return () => {
      unregister();
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
      imageRef.current = img;
      canvas.width = img.width;
      canvas.height = img.height;
      
      // 计算缩放比例以适应容器
      const maxWidth = 800;
      const maxHeight = 600;
      const scaleX = maxWidth / img.width;
      const scaleY = maxHeight / img.height;
      setScale(Math.min(scaleX, scaleY, 1));
      
      redrawCanvas();
    };
    img.src = screenshot;
  }, [screenshot]);

  // 重绘 canvas
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const img = imageRef.current;
    if (!canvas || !ctx || !img) return;

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制截图
    ctx.drawImage(img, 0, 0);

    // 绘制矩形框
    if (rectangle) {
      ctx.strokeStyle = "#ff4a4a";
      ctx.lineWidth = 2;
      ctx.fillStyle = "rgba(255, 74, 74, 0.1)";

      ctx.fillRect(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
      ctx.strokeRect(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
    }
  }, [rectangle]);

  // 重绘触发
  useEffect(() => {
    redrawCanvas();
  }, [rectangle, redrawCanvas]);

  // 鼠标按下 - 开始框选
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !screenshot) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    setIsDrawing(true);
    setStartPoint({ x, y });
    setRectangle({ x, y, width: 0, height: 0 });
  }, [scale, screenshot]);

  // 鼠标移动 - 更新矩形
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
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
  }, [isDrawing, startPoint, scale]);

  // 鼠标抬起 - 结束框选
  const handleMouseUp = useCallback(() => {
    setIsDrawing(false);
    setStartPoint(null);
  }, []);

  // 手动输入坐标
  const handleCoordinateChange = useCallback((key: keyof Rectangle, value: number | null) => {
    if (value === null) return;
    setRectangle((prev) => (prev ? { ...prev, [key]: Math.round(value) } : null));
  }, []);

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

  // 关闭时重置状态
  const handleClose = useCallback(() => {
    setScreenshot(null);
    setRectangle(null);
    setIsDrawing(false);
    setStartPoint(null);
    onClose();
  }, [onClose]);

  return (
    <Modal
      title="ROI 区域配置"
      open={open}
      onCancel={handleClose}
      width={900}
      footer={null}
    >
      <Spin spinning={isLoading} tip="截图中...">
        {/* 截图显示区 */}
        <div style={{ marginBottom: 16, textAlign: "center", backgroundColor: "#f5f5f5", padding: 16 }}>
          {screenshot ? (
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{
                cursor: "crosshair",
                border: "1px solid #d9d9d9",
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              }}
            />
          ) : (
            <div style={{ height: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#999" }}>等待截图...</span>
            </div>
          )}
        </div>

        {/* ROI 参数显示与输入 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>ROI 坐标 [x, y, w, h]:</div>
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

        {/* 操作按钮 */}
        <Space style={{ width: "100%", justifyContent: "flex-end" }}>
          <Button icon={<ReloadOutlined />} onClick={requestScreenshot} disabled={isLoading}>
            重新截图
          </Button>
          <Button icon={<CloseOutlined />} onClick={handleClose}>
            取消
          </Button>
          <Button type="primary" icon={<CheckOutlined />} onClick={handleConfirm} disabled={!rectangle}>
            确定
          </Button>
        </Space>
      </Spin>
    </Modal>
  );
});
