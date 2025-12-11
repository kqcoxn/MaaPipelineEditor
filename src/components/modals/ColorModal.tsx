import { memo, useState, useCallback, useEffect, useRef } from "react";
import { Modal, Button, Space, message, Spin, Slider, InputNumber } from "antd";
import { ReloadOutlined, CheckOutlined, CloseOutlined } from "@ant-design/icons";
import { useMFWStore } from "../../stores/mfwStore";
import { mfwProtocol } from "../../services/server";

interface ColorModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (lower: [number, number, number], upper: [number, number, number]) => void;
}

export const ColorModal = memo(({ open, onClose, onConfirm }: ColorModalProps) => {
  const { connectionStatus, controllerId } = useMFWStore();
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [scale, setScale] = useState(1);
  const [pickedColor, setPickedColor] = useState<[number, number, number] | null>(null);
  const [tolerance, setTolerance] = useState(10);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

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

    const unregister = mfwProtocol.onScreencapResult(handleScreencap);
    
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
      
      const maxWidth = 800;
      const maxHeight = 600;
      const scaleX = maxWidth / img.width;
      const scaleY = maxHeight / img.height;
      setScale(Math.min(scaleX, scaleY, 1));
      
      ctx.drawImage(img, 0, 0);
    };
    img.src = screenshot;
  }, [screenshot]);

  // 点击取色
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
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
  }, [scale]);

  // 计算颜色范围
  const calculateRange = useCallback((color: [number, number, number], tol: number): {
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
  }, []);

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

  // 关闭时重置状态
  const handleClose = useCallback(() => {
    setScreenshot(null);
    setPickedColor(null);
    setTolerance(10);
    onClose();
  }, [onClose]);

  // 计算当前的 lower 和 upper
  const currentRange = pickedColor ? calculateRange(pickedColor, tolerance) : null;

  return (
    <Modal
      title="颜色取点工具"
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
              onClick={handleCanvasClick}
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

        {/* 颜色预览 */}
        {pickedColor && (
          <div style={{ marginBottom: 16, padding: 12, backgroundColor: "#fafafa", borderRadius: 4 }}>
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
              <span>RGB({pickedColor[0]}, {pickedColor[1]}, {pickedColor[2]})</span>
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
                    [{currentRange.lower[0]}, {currentRange.lower[1]}, {currentRange.lower[2]}]
                  </span>
                </div>
                <div>
                  <span style={{ fontWeight: 500 }}>Upper:</span>
                  <span style={{ marginLeft: 8, fontFamily: "monospace" }}>
                    [{currentRange.upper[0]}, {currentRange.upper[1]}, {currentRange.upper[2]}]
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 操作按钮 */}
        <Space style={{ width: "100%", justifyContent: "flex-end" }}>
          <Button icon={<ReloadOutlined />} onClick={requestScreenshot} disabled={isLoading}>
            重新截图
          </Button>
          <Button icon={<CloseOutlined />} onClick={handleClose}>
            取消
          </Button>
          <Button type="primary" icon={<CheckOutlined />} onClick={handleConfirm} disabled={!pickedColor}>
            确定
          </Button>
        </Space>
      </Spin>
    </Modal>
  );
});
