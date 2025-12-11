import { memo, useState, useCallback, useEffect, useRef } from "react";
import { Modal, Button, Space, InputNumber, message, Spin, Slider, Radio, Switch } from "antd";
import { ReloadOutlined, CheckOutlined, CloseOutlined, BgColorsOutlined, ClearOutlined } from "@ant-design/icons";
import { useMFWStore } from "../../stores/mfwStore";
import { mfwProtocol } from "../../services/server";

interface TemplateModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (templatePath: string, greenMask: boolean, roi?: [number, number, number, number]) => void;
  initialROI?: [number, number, number, number];
}

interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

type DrawTool = "none" | "select" | "brush" | "eraser";

export const TemplateModal = memo(({ open, onClose, onConfirm, initialROI }: TemplateModalProps) => {
  const { connectionStatus, controllerId } = useMFWStore();
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [scale, setScale] = useState(1);
  const [rectangle, setRectangle] = useState<Rectangle | null>(null);
  const [currentTool, setCurrentTool] = useState<DrawTool>("select");
  const [brushSize, setBrushSize] = useState(15);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [hasGreenMask, setHasGreenMask] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
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
    if (!screenshot || !canvasRef.current || !maskCanvasRef.current) return;

    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      canvas.width = img.width;
      canvas.height = img.height;
      maskCanvas.width = img.width;
      maskCanvas.height = img.height;
      
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
    const maskCanvas = maskCanvasRef.current;
    const ctx = canvas?.getContext("2d");
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
      ctx.fillRect(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
      ctx.strokeRect(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
    }
  }, [rectangle, currentTool]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // 鼠标按下
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !screenshot) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    setIsDrawing(true);
    setStartPoint({ x, y });

    if (currentTool === "select") {
      setRectangle({ x, y, width: 0, height: 0 });
    } else if (currentTool === "brush" || currentTool === "eraser") {
      drawMask(x, y, currentTool);
    }
  }, [scale, screenshot, currentTool]);

  // 鼠标移动
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPoint) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const currentX = (e.clientX - rect.left) / scale;
    const currentY = (e.clientY - rect.top) / scale;

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
      drawMask(currentX, currentY, currentTool);
    }
  }, [isDrawing, startPoint, scale, currentTool]);

  // 鼠标抬起
  const handleMouseUp = useCallback(() => {
    setIsDrawing(false);
    setStartPoint(null);
  }, []);

  // 绘制遮罩
  const drawMask = useCallback((x: number, y: number, tool: "brush" | "eraser") => {
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
    
    redrawCanvas();
  }, [brushSize, redrawCanvas]);

  // 清除遮罩
  const clearMask = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;
    const maskCtx = maskCanvas?.getContext("2d");
    if (!maskCtx || !maskCanvas) return;

    maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    setHasGreenMask(false);
    redrawCanvas();
  }, [redrawCanvas]);

  // 手动输入坐标
  const handleCoordinateChange = useCallback((key: keyof Rectangle, value: number | null) => {
    if (value === null) return;
    setRectangle((prev) => (prev ? { ...prev, [key]: Math.round(value) } : null));
  }, []);

  // 保存模板
  const handleSave = useCallback(() => {
    if (!rectangle || !canvasRef.current || !imageRef.current) {
      message.warning("请先框选模板区域");
      return;
    }

    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return;

    // 设置输出画布尺寸为框选区域
    tempCanvas.width = rectangle.width;
    tempCanvas.height = rectangle.height;

    // 绘制裁剪后的截图
    tempCtx.drawImage(
      canvas,
      rectangle.x, rectangle.y, rectangle.width, rectangle.height,
      0, 0, rectangle.width, rectangle.height
    );

    // 如果有遮罩层，叠加绘制
    if (maskCanvas && hasGreenMask) {
      tempCtx.drawImage(
        maskCanvas,
        rectangle.x, rectangle.y, rectangle.width, rectangle.height,
        0, 0, rectangle.width, rectangle.height
      );
    }

    // 导出为 PNG
    tempCanvas.toBlob((blob) => {
      if (!blob) {
        message.error("生成模板图片失败");
        return;
      }

      const timestamp = Date.now();
      const filename = `template_${timestamp}.png`;
      const url = URL.createObjectURL(blob);
      
      // 创建下载链接
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      
      URL.revokeObjectURL(url);

      // 简化路径处理：使用文件名作为相对路径
      const templatePath = `templates/${filename}`;
      message.success("模板已保存");
      onConfirm(templatePath, hasGreenMask, [
        Math.round(rectangle.x),
        Math.round(rectangle.y),
        Math.round(rectangle.width),
        Math.round(rectangle.height),
      ]);
      onClose();
    }, "image/png");
  }, [rectangle, hasGreenMask, onConfirm, onClose]);

  // 关闭时重置状态
  const handleClose = useCallback(() => {
    setScreenshot(null);
    setRectangle(null);
    setIsDrawing(false);
    setStartPoint(null);
    setCurrentTool("select");
    setHasGreenMask(false);
    clearMask();
    onClose();
  }, [clearMask, onClose]);

  return (
    <Modal
      title="模板图片编辑"
      open={open}
      onCancel={handleClose}
      width={950}
      footer={null}
    >
      <Spin spinning={isLoading} tip="截图中...">
        {/* 工具栏 */}
        <div style={{ marginBottom: 16, padding: "12px", backgroundColor: "#fafafa", borderRadius: "4px" }}>
          <Space direction="vertical" style={{ width: "100%" }}>
            <div>
              <span style={{ marginRight: 8, fontWeight: 500 }}>工具:</span>
              <Radio.Group value={currentTool} onChange={(e) => setCurrentTool(e.target.value)}>
                <Radio.Button value="select">框选</Radio.Button>
                <Radio.Button value="brush">画笔</Radio.Button>
                <Radio.Button value="eraser">橡皮擦</Radio.Button>
              </Radio.Group>
              <Button 
                icon={<ClearOutlined />} 
                onClick={clearMask} 
                style={{ marginLeft: 8 }}
                size="small"
              >
                清除遮罩
              </Button>
            </div>
            {(currentTool === "brush" || currentTool === "eraser") && (
              <div style={{ display: "flex", alignItems: "center" }}>
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
          </Space>
        </div>

        {/* 截图显示区 */}
        <div style={{ marginBottom: 16, textAlign: "center", backgroundColor: "#f5f5f5", padding: 16, position: "relative" }}>
          {screenshot ? (
            <div style={{ position: "relative", display: "inline-block" }}>
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                style={{
                  cursor: currentTool === "select" ? "crosshair" : currentTool === "brush" ? "cell" : "not-allowed",
                  border: "1px solid #d9d9d9",
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                }}
              />
              <canvas
                ref={maskCanvasRef}
                style={{ display: "none" }}
              />
            </div>
          ) : (
            <div style={{ height: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#999" }}>等待截图...</span>
            </div>
          )}
        </div>

        {/* ROI 参数 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>模板区域 [x, y, w, h]:</div>
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
            <BgColorsOutlined style={{ color: hasGreenMask ? "#52c41a" : "#999" }} />
            <span>绿色遮罩: {hasGreenMask ? "已启用" : "未使用"}</span>
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
          <Button type="primary" icon={<CheckOutlined />} onClick={handleSave} disabled={!rectangle}>
            保存模板
          </Button>
        </Space>
      </Spin>
    </Modal>
  );
});
