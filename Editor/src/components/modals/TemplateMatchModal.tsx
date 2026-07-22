import { memo, useState, useCallback, useEffect, useRef } from "react";
import { Button, Space, InputNumber, message, Select, Switch, Tag } from "antd";
import { ThunderboltOutlined } from "@ant-design/icons";
import {
  ScreenshotModalBase,
  type CanvasRenderProps,
} from "./ScreenshotModalBase";
import { mfwProtocol, resourceProtocol } from "../../services/server";
import { useResourceStore } from "../../stores/resourceStore";
import type { Rectangle } from "../../utils/data/roiNegativeCoord";

interface MatchBox {
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
}

interface TemplateMatchResult {
  success: boolean;
  hit?: boolean;
  best?: MatchBox | null;
  all?: MatchBox[];
  image?: string;
  detail_json?: string;
  error?: string;
}

interface TemplateMatchModalProps {
  open: boolean;
  onClose: () => void;
  // 节点 template 字段当前值（字符串或字符串数组），取首个非空项作为待验证模板
  templateValue: string | string[];
  initialROI?: [number, number, number, number];
  initialThreshold?: number;
  initialMethod?: number;
  initialGreenMask?: boolean;
}

// 取 template 字段首个非空路径
function firstTemplatePath(value: string | string[]): string {
  if (Array.isArray(value)) {
    return value.find((v) => typeof v === "string" && v.trim() !== "") ?? "";
  }
  return typeof value === "string" ? value.trim() : "";
}

// 格式化识别详情 JSON，便于查看；解析失败则原样返回
function prettyJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

// PLACEHOLDER_BODY

export const TemplateMatchModal = memo(
  ({
    open,
    onClose,
    templateValue,
    initialROI,
    initialThreshold = 0.7,
    initialMethod = 5,
    initialGreenMask = false,
  }: TemplateMatchModalProps) => {
    const [screenshot, setScreenshot] = useState<string | null>(null);
    const [rectangle, setRectangle] = useState<Rectangle | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(
      null,
    );
    const [threshold, setThreshold] = useState(initialThreshold);
    const [method, setMethod] = useState(initialMethod);
    const [greenMask, setGreenMask] = useState(initialGreenMask);
    const [isMatching, setIsMatching] = useState(false);
    const [result, setResult] = useState<TemplateMatchResult | null>(null);

    const imageRef = useRef<HTMLImageElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const viewportPropsRef = useRef<CanvasRenderProps | null>(null);

    const imageCache = useResourceStore((state) => state.imageCache);
    const templatePath = firstTemplatePath(templateValue);

    // 打开时按需请求模板图
    useEffect(() => {
      if (open && templatePath && !imageCache.has(templatePath)) {
        resourceProtocol.requestImage(templatePath);
      }
    }, [open, templatePath, imageCache]);

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
      if (!open) initializedRef.current = false;
    }, [initialROI, screenshot, open]);

    // 解析模板图为 dataURL
    const templateDataUrl = useCallback((): string | null => {
      const cache = imageCache.get(templatePath);
      if (!cache) return null;
      return `data:${cache.mimeType};base64,${cache.base64}`;
    }, [imageCache, templatePath]);

    // 发起验证
    const handleVerify = useCallback(() => {
      if (!screenshot) {
        message.warning("请先截图或上传底图");
        return;
      }
      const tpl = templateDataUrl();
      if (!tpl) {
        message.warning(
          templatePath
            ? "模板图尚未加载，请稍候或确认 template 路径正确"
            : "当前节点未设置 template 路径",
        );
        return;
      }

      const roi: [number, number, number, number] = rectangle
        ? [
            Math.round(rectangle.x),
            Math.round(rectangle.y),
            Math.round(rectangle.width),
            Math.round(rectangle.height),
          ]
        : [0, 0, 0, 0];

      setIsMatching(true);
      setResult(null);
      mfwProtocol.requestTemplateMatch({
        base_image: screenshot,
        template_image: tpl,
        roi,
        threshold,
        method,
        green_mask: greenMask,
      });
    }, [screenshot, templateDataUrl, templatePath, rectangle, threshold, method, greenMask]);

    // 监听匹配结果
    useEffect(() => {
      if (!open) return;
      const unregister = mfwProtocol.onTemplateMatchResult(
        (data: TemplateMatchResult) => {
          setIsMatching(false);
          if (data.success) {
            setResult(data);
          } else {
            message.error(data.error || "模板匹配失败");
            setResult(data);
          }
        },
      );
      return () => unregister();
    }, [open]);

    // PLACEHOLDER_CANVAS

    // 重绘 canvas：底图 + ROI 框 + 匹配结果框
    const redrawCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      const img = imageRef.current;
      if (!canvas || !ctx || !img) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      // ROI 框（蓝色虚线）
      if (rectangle) {
        ctx.strokeStyle = "#1890ff";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(
          rectangle.x,
          rectangle.y,
          rectangle.width,
          rectangle.height,
        );
        ctx.setLineDash([]);
      }

      // 匹配结果框
      if (result?.all?.length) {
        const best = result.best;
        result.all.forEach((box) => {
          const isBest =
            best &&
            box.x === best.x &&
            box.y === best.y &&
            box.width === best.width &&
            box.height === best.height;
          ctx.strokeStyle = isBest ? "#52c41a" : "#bfbfbf";
          ctx.lineWidth = isBest ? 3 : 1;
          ctx.strokeRect(box.x, box.y, box.width, box.height);
          // 分数标签
          ctx.font = "bold 16px sans-serif";
          ctx.fillStyle = isBest ? "#52c41a" : "#8c8c8c";
          ctx.fillText(box.score.toFixed(3), box.x, Math.max(box.y - 4, 14));
        });
      }
    }, [rectangle, result]);

    useEffect(() => {
      if (canvasRef.current && imageRef.current) {
        redrawCanvas();
      }
    }, [rectangle, result, redrawCanvas]);

    // 鼠标事件：框选 ROI
    const createMouseHandlers = useCallback(
      (props: CanvasRenderProps) => {
        const { scale, isPanning, isSpacePressed, startPan, updatePan, endPan } =
          props;

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
          const cx = (e.clientX - rect.left) / scale;
          const cy = (e.clientY - rect.top) / scale;
          const width = cx - startPoint.x;
          const height = cy - startPoint.y;
          setRectangle({
            x: width < 0 ? cx : startPoint.x,
            y: height < 0 ? cy : startPoint.y,
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

        const handleMouseLeave = () => {
          if (isPanning) endPan();
          setIsDrawing(false);
          setStartPoint(null);
        };

        return { handleMouseDown, handleMouseMove, handleMouseUp, handleMouseLeave };
      },
      [isDrawing, startPoint],
    );

    const renderCanvas = useCallback(
      (props: CanvasRenderProps) => {
        const { scale, panOffset, getBaseCursorStyle, imageElement } = props;
        viewportPropsRef.current = props;
        if (imageElement) imageRef.current = imageElement;

        const { handleMouseDown, handleMouseMove, handleMouseUp, handleMouseLeave } =
          createMouseHandlers(props);
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
      [createMouseHandlers],
    );

    const handleImageLoaded = useCallback(
      (img: HTMLImageElement) => {
        imageRef.current = img;
        const canvas = canvasRef.current;
        const props = viewportPropsRef.current;
        if (!canvas) return;
        canvas.width = img.width;
        canvas.height = img.height;
        props?.initializeImage?.(img);
        redrawCanvas();
      },
      [redrawCanvas],
    );

    const handleReset = useCallback(() => {
      setScreenshot(null);
      setRectangle(null);
      setResult(null);
      setIsDrawing(false);
      setStartPoint(null);
      imageRef.current = null;
    }, []);

    // PLACEHOLDER_RENDER

    const tplUrl = templateDataUrl();

    return (
      <ScreenshotModalBase
        open={open}
        onClose={onClose}
        title="模板匹配验证"
        width={950}
        confirmText="关闭"
        onConfirm={onClose}
        renderCanvas={renderCanvas}
        onScreenshotChange={setScreenshot}
        onImageLoaded={handleImageLoaded}
        onReset={handleReset}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* 模板图预览 */}
          <div
            style={{
              padding: 12,
              backgroundColor: "#fff",
              borderRadius: 8,
              border: "1px solid #e8e8e8",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
              待验证模板
            </div>
            {tplUrl ? (
              <div
                style={{
                  maxHeight: 110,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  background: "#fafafa",
                  borderRadius: 4,
                  padding: 4,
                }}
              >
                <img
                  src={tplUrl}
                  alt="template"
                  style={{
                    maxWidth: "100%",
                    maxHeight: 100,
                    objectFit: "contain",
                    border: "1px solid #f0f0f0",
                    borderRadius: 4,
                  }}
                />
              </div>
            ) : (
              <span style={{ fontSize: 12, color: "#faad14" }}>
                {templatePath
                  ? `加载中: ${templatePath}`
                  : "当前节点未设置 template 路径"}
              </span>
            )}
          </div>

          {/* 匹配参数 */}
          <div
            style={{
              padding: 12,
              backgroundColor: "#fff",
              borderRadius: 8,
              border: "1px solid #e8e8e8",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>
              匹配参数
            </div>
            <Space orientation="vertical" size={10} style={{ width: "100%" }}>
              <Space size={8} align="center">
                <span style={{ fontSize: 12, color: "#8c8c8c", width: 48 }}>
                  阈值
                </span>
                <InputNumber
                  value={threshold}
                  onChange={(v) => setThreshold(v ?? 0.7)}
                  min={0}
                  max={1}
                  step={0.01}
                  size="small"
                  style={{ width: 100 }}
                />
              </Space>
              <Space size={8} align="center">
                <span style={{ fontSize: 12, color: "#8c8c8c", width: 48 }}>
                  算法
                </span>
                <Select
                  value={method}
                  onChange={setMethod}
                  size="small"
                  style={{ width: 140 }}
                  options={[
                    { value: 10001, label: "10001 SQDIFF" },
                    { value: 3, label: "3 CCORR" },
                    { value: 5, label: "5 CCOEFF" },
                  ]}
                />
              </Space>
              <Space size={8} align="center">
                <span style={{ fontSize: 12, color: "#8c8c8c", width: 48 }}>
                  绿掩码
                </span>
                <Switch
                  checked={greenMask}
                  onChange={setGreenMask}
                  size="small"
                />
              </Space>
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                onClick={handleVerify}
                loading={isMatching}
                block
              >
                验证匹配
              </Button>
            </Space>
          </div>

          {/* 匹配结果 */}
          {result && result.success && (
            <div
              style={{
                padding: 12,
                backgroundColor: "#fff",
                borderRadius: 8,
                border: `1px solid ${result.hit ? "#b7eb8f" : "#ffccc7"}`,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  marginBottom: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                识别结果
                {result.hit ? (
                  <Tag color="success">命中</Tag>
                ) : (
                  <Tag color="error">未命中</Tag>
                )}
              </div>
              {result.best && (
                <div style={{ fontSize: 12, color: "#262626", marginBottom: 6 }}>
                  最佳分数:{" "}
                  <span style={{ color: "#52c41a", fontWeight: 600 }}>
                    {result.best.score.toFixed(4)}
                  </span>
                  {"  "}框: [{result.best.x}, {result.best.y}, {result.best.width},{" "}
                  {result.best.height}]
                </div>
              )}
              <div style={{ fontSize: 12, color: "#8c8c8c" }}>
                候选数: {result.all?.length ?? 0}
              </div>
              {result.detail_json && (
                <details style={{ marginTop: 8 }}>
                  <summary
                    style={{ fontSize: 12, color: "#1890ff", cursor: "pointer" }}
                  >
                    完整识别详情 (JSON)
                  </summary>
                  <pre
                    style={{
                      fontSize: 11,
                      maxHeight: 200,
                      overflow: "auto",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                      background: "#fafafa",
                      padding: 8,
                      borderRadius: 4,
                      marginTop: 6,
                    }}
                  >
                    {prettyJson(result.detail_json)}
                  </pre>
                </details>
              )}
            </div>
          )}
        </div>
      </ScreenshotModalBase>
    );
  },
);

