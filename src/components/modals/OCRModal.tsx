import { memo, useState, useCallback, useEffect, useRef } from "react";
import {
  Space,
  InputNumber,
  message,
  Input,
  Button,
  Radio,
  Tooltip,
} from "antd";
import {
  ClearOutlined,
  CheckCircleOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import { createWorker, PSM, OEM, type Worker } from "tesseract.js";
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
  code?: string;
  no_content?: boolean;
}

type OCRMode = "native" | "frontend";

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
    const [ocrMode, setOcrMode] = useState<OCRMode>("frontend");
    // Tesseract worker 状态管理
    const [tesseractWorker, setTesseractWorker] = useState<Worker | null>(null);
    const [isLoadingModel, setIsLoadingModel] = useState(false);

    const imageRef = useRef<HTMLImageElement | null>(null);
    const ocrDebounceRef = useRef<NodeJS.Timeout | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const viewportPropsRef = useRef<CanvasRenderProps | null>(null);

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

    // 前端 OCR 识别
    const requestFrontendOCR = useCallback(
      async (roi: Rectangle) => {
        if (!screenshot || !canvasRef.current) return;

        setIsOCRing(true);
        setOcrSuccess(null);

        try {
          // 从当前截图中裁剪 ROI 区域
          const tempCanvas = document.createElement("canvas");
          const tempCtx = tempCanvas.getContext("2d");
          if (!tempCtx || !imageRef.current) {
            throw new Error("无法创建画布");
          }

          tempCanvas.width = Math.round(roi.width);
          tempCanvas.height = Math.round(roi.height);
          tempCtx.drawImage(
            imageRef.current,
            Math.round(roi.x),
            Math.round(roi.y),
            Math.round(roi.width),
            Math.round(roi.height),
            0,
            0,
            Math.round(roi.width),
            Math.round(roi.height)
          );

          // 图像预处理
          const imageData = tempCtx.getImageData(
            0,
            0,
            tempCanvas.width,
            tempCanvas.height
          );
          const data = imageData.data;

          // 灰度化
          for (let i = 0; i < data.length; i += 4) {
            const gray =
              data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            data[i] = gray;
            data[i + 1] = gray;
            data[i + 2] = gray;
          }

          // 二值化
          // 计算灰度直方图
          const histogram = new Array(256).fill(0);
          for (let i = 0; i < data.length; i += 4) {
            histogram[data[i]]++;
          }

          // 计算总像素数
          const total = tempCanvas.width * tempCanvas.height;

          // Otsu 算法计算最佳阈值
          let sum = 0;
          for (let i = 0; i < 256; i++) {
            sum += i * histogram[i];
          }

          let sumB = 0;
          let wB = 0;
          let wF = 0;
          let maxVariance = 0;
          let threshold = 0;

          for (let t = 0; t < 256; t++) {
            wB += histogram[t];
            if (wB === 0) continue;

            wF = total - wB;
            if (wF === 0) break;

            sumB += t * histogram[t];

            const mB = sumB / wB;
            const mF = (sum - sumB) / wF;

            const variance = wB * wF * (mB - mF) * (mB - mF);

            if (variance > maxVariance) {
              maxVariance = variance;
              threshold = t;
            }
          }

          // 应用二值化
          for (let i = 0; i < data.length; i += 4) {
            const value = data[i] > threshold ? 255 : 0;
            data[i] = value;
            data[i + 1] = value;
            data[i + 2] = value;
          }

          tempCtx.putImageData(imageData, 0, 0);

          // 初始化或复用 Tesseract worker
          let worker = tesseractWorker;
          if (!worker) {
            setIsLoadingModel(true);
            worker = await createWorker(["chi_sim", "eng"], undefined, {
              logger: () => {},
            });

            // Tesseract 参数
            await worker.setParameters({
              // PSM (Page Segmentation Mode) - 页面分割模式
              // PSM.SINGLE_LINE: 单行文本（推荐用于识别单行内容）
              // PSM.SINGLE_BLOCK: 单个文本块
              // PSM.SINGLE_WORD: 单个单词
              // PSM.SPARSE_TEXT: 稀疏文本
              tessedit_pageseg_mode: PSM.SPARSE_TEXT,

              // OCR Engine Mode
              // OEM.LSTM_ONLY: Neural nets LSTM engine (最佳精度)
              tessedit_ocr_engine_mode: OEM.LSTM_ONLY,
            });

            setTesseractWorker(worker);
            setIsLoadingModel(false);
          }

          const {
            data: { text, confidence },
          } = await worker.recognize(tempCanvas);

          // 文本后处理
          let processedText = text.trim();

          // 移除中文字符之间的空格
          while (/([一-龥])\s+([一-龥])/.test(processedText)) {
            processedText = processedText.replace(
              /([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g,
              "$1$2"
            );
          }

          // 移除常见的OCR误识别字符
          processedText = processedText
            .replace(/[\r\n]+/g, " ")
            .replace(/\s{2,}/g, " ")
            .trim();

          setOcrText(processedText);
          setOcrSuccess(processedText.length > 0 && confidence > 50);
        } catch (error) {
          message.error(
            `前端OCR识别失败: ${
              error instanceof Error ? error.message : "未知错误"
            }`
          );
          setOcrSuccess(false);
        } finally {
          setIsOCRing(false);
        }
      },
      [screenshot, tesseractWorker]
    );

    // 请求后端 OCR 识别
    const requestNativeOCR = useCallback(
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

    // 根据模式选择 OCR 方法
    const requestOCR = useCallback(
      (roi: Rectangle) => {
        if (ocrMode === "frontend") {
          requestFrontendOCR(roi);
        } else {
          requestNativeOCR(roi);
        }
      },
      [ocrMode, requestFrontendOCR, requestNativeOCR]
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
          // 检测 OCR 资源未配置的特定错误码
          if (data.code === "MFW_OCR_RESOURCE_NOT_CONFIGURED") {
            message.error(
              "OCR 资源路径未配置，请请运行 'mpelb config set-resource' 并按提示输入后重启服务"
            );
          } else {
            message.error(data.error);
          }
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

    // rectangle 变化时重绘
    useEffect(() => {
      if (canvasRef.current && imageRef.current) {
        redrawCanvas();
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
        const { scale, panOffset, getBaseCursorStyle, imageElement } = props;

        // 存储最新的 props
        viewportPropsRef.current = props;

        // 存储图片到 ref
        if (imageElement) {
          imageRef.current = imageElement;
        }

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
        redrawCanvas();
      },
      [redrawCanvas]
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
        onImageLoaded={handleImageLoaded}
        onReset={handleReset}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* OCR 模式切换 */}
          <div
            style={{
              padding: 12,
              backgroundColor: "#fff",
              borderRadius: 8,
              border: "1px solid #e8e8e8",
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
                识别模式
              </span>
            </div>
            <Radio.Group
              value={ocrMode}
              onChange={(e) => setOcrMode(e.target.value)}
              optionType="button"
              buttonStyle="solid"
              size="small"
            >
              <Tooltip
                title={
                  <div>
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>
                      前端OCR（Tesseract.js）
                    </div>
                    <div>• 基于当前已截取的图片识别</div>
                    <div>• 支持100+多语言混合识别</div>
                    <div>• 速度较快（初次需要加载模型）</div>
                    <div style={{ color: "#52c41a", marginTop: 4 }}>
                      ✓ 无需额外配置资源位置
                    </div>
                    <div style={{ color: "#52c41a", marginTop: 4 }}>
                      ✓ 不会因窗口更新导致内容不一致
                    </div>
                    <div style={{ color: "#faad14", marginTop: 4 }}>
                      ⚠️ 识别信息可能与原生 OCR 不一致
                    </div>
                  </div>
                }
              >
                <Radio.Button value="frontend">
                  前端 <QuestionCircleOutlined style={{ marginLeft: 4 }} />
                </Radio.Button>
              </Tooltip>
              <Tooltip
                title={
                  <div>
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>
                      原生OCR（MaaFramework）
                    </div>
                    <div>• 使用本地 OCR 模型识别</div>
                    <div>• 速度较慢，无后处理</div>
                    <div style={{ color: "#faad14", marginTop: 4 }}>
                      ⚠️
                      后端会重新截取当前窗口画面，可能因窗口更新导致内容不一致
                    </div>
                  </div>
                }
              >
                <Radio.Button value="native">
                  原生 <QuestionCircleOutlined style={{ marginLeft: 4 }} />
                </Radio.Button>
              </Tooltip>
            </Radio.Group>
          </div>

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
              <span style={{ fontSize: 12, color: "#8c8c8c" }}>
                [x, y, w, h]
              </span>
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
              </Space>
            </Space>
          </div>

          {/* OCR 识别结果 */}
          <div
            style={{
              padding: 12,
              backgroundColor: "#fff",
              borderRadius: 8,
              border: `1px solid ${
                ocrSuccess === true ? "#b7eb8f" : "#e8e8e8"
              }`,
              transition: "border-color 0.3s ease",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 3,
                    height: 16,
                    backgroundColor: "#52c41a",
                    borderRadius: 2,
                  }}
                />
                <span
                  style={{ fontSize: 13, fontWeight: 500, color: "#262626" }}
                >
                  识别结果
                </span>
                {isOCRing && (
                  <span style={{ fontSize: 11, color: "#1890ff" }}>
                    识别中...
                    {isLoadingModel &&
                      ocrMode === "frontend" &&
                      "（首次加载模型中）"}
                  </span>
                )}
                {!isOCRing && ocrSuccess === true && (
                  <span style={{ fontSize: 11, color: "#52c41a" }}>
                    <CheckCircleOutlined /> 识别成功
                  </span>
                )}
                {!isOCRing && ocrSuccess === false && ocrText === "" && (
                  <span style={{ fontSize: 11, color: "#faad14" }}>
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
        </div>
      </ScreenshotModalBase>
    );
  }
);
