import { memo, useState, useCallback, useEffect, useRef } from "react";
import {
  Space,
  InputNumber,
  message,
  Modal,
  Input,
  Button,
  Radio,
  Tooltip,
} from "antd";
import {
  ClearOutlined,
  CheckCircleOutlined,
  QuestionCircleOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { createWorker, PSM, OEM, type Worker } from "tesseract.js";
import { mfwProtocol } from "../../services/server";
import {
  ScreenshotModalBase,
  type CanvasRenderProps,
} from "./ScreenshotModalBase";
import { getRoiModalStrings } from "./shared/roiModalStrings";
import {
  resolveNegativeROI,
  type Rectangle,
} from "../../utils/data/roiNegativeCoord";

const { TextArea } = Input;

interface OCRModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (
    text: string,
    roi?: [number, number, number, number],
    withROI?: boolean,
  ) => void;
  initialROI?: [number, number, number, number];
}

interface OCRResult {
  success: boolean;
  text?: string;
  boxes?: Array<{ x: number; y: number; w: number; h: number; text: string }>;
  error?: string;
  code?: string;
  no_content?: boolean;
  detail?: {
    reason?: string;
    resource_dir?: string;
    suggestions?: string[];
    [key: string]: any;
  };
}

type OCRMode = "native" | "frontend";

export const OCRModal = memo(
  ({ open, onClose, onConfirm, initialROI }: OCRModalProps) => {
    const { t } = useTranslation();
    const roi = getRoiModalStrings(t, "ocrModal");
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
    const [ocrMode, setOcrMode] = useState<OCRMode>("native");
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
      async (roiRect: Rectangle) => {
        if (!screenshot || !canvasRef.current) return;

        setIsOCRing(true);
        setOcrSuccess(null);

        try {
          // 从当前截图中裁剪 ROI 区域
          const tempCanvas = document.createElement("canvas");
          const tempCtx = tempCanvas.getContext("2d");
          if (!tempCtx || !imageRef.current) {
            throw new Error(
              t("ui.modals.ocrModal.canvasCreateFailed", "无法创建画布"),
            );
          }

          tempCanvas.width = Math.round(roiRect.width);
          tempCanvas.height = Math.round(roiRect.height);
          tempCtx.drawImage(
            imageRef.current,
            Math.round(roiRect.x),
            Math.round(roiRect.y),
            Math.round(roiRect.width),
            Math.round(roiRect.height),
            0,
            0,
            Math.round(roiRect.width),
            Math.round(roiRect.height),
          );

          // 图像预处理
          const imageData = tempCtx.getImageData(
            0,
            0,
            tempCanvas.width,
            tempCanvas.height,
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

          for (let tVal = 0; tVal < 256; tVal++) {
            wB += histogram[tVal];
            if (wB === 0) continue;

            wF = total - wB;
            if (wF === 0) break;

            sumB += tVal * histogram[tVal];

            const mB = sumB / wB;
            const mF = (sum - sumB) / wF;

            const variance = wB * wF * (mB - mF) * (mB - mF);

            if (variance > maxVariance) {
              maxVariance = variance;
              threshold = tVal;
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
              "$1$2",
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
            t("ui.modals.ocrModal.frontendOcrFailed", "前端OCR识别失败: {{message}}", {
              message:
                error instanceof Error
                  ? error.message
                  : t("ui.modals.ocrModal.unknownError", "未知错误"),
            }),
          );
          setOcrSuccess(false);
        } finally {
          setIsOCRing(false);
        }
      },
      [screenshot, tesseractWorker, t],
    );

    // 请求后端 OCR 识别（基于当前固定底图，不再二次截取设备）
    const requestNativeOCR = useCallback(
      (roiRect: Rectangle) => {
        if (!screenshot) {
          message.warning(
            t("ui.modals.ocrModal.needScreenshot", "请先截图或上传底图"),
          );
          return;
        }
        if (isOCRing) {
          return;
        }

        setIsOCRing(true);
        mfwProtocol.requestOCR({
          base_image: screenshot,
          roi: [
            Math.round(roiRect.x),
            Math.round(roiRect.y),
            Math.round(roiRect.width),
            Math.round(roiRect.height),
          ],
        });
      },
      [screenshot, isOCRing, t],
    );

    // 根据模式选择 OCR 方法
    const requestOCR = useCallback(
      (roiRect: Rectangle) => {
        if (ocrMode === "frontend") {
          requestFrontendOCR(roiRect);
        } else {
          requestNativeOCR(roiRect);
        }
      },
      [ocrMode, requestFrontendOCR, requestNativeOCR],
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
          // 构建详细的错误提示
          let errorTitle = t("ui.modals.ocrModal.ocrFailed", "OCR 识别失败");
          let errorContent: React.ReactNode = data.error;

          // 处理特定的错误码
          if (data.code === "MFW_OCR_RESOURCE_NOT_CONFIGURED") {
            errorContent = t(
              "ui.modals.ocrModal.resourceNotConfigured",
              "OCR 资源路径未配置，请运行 'mpelb config set-resource' 并按提示输入后重启服务",
            );
          } else if (
            (data.code === "MFW_RESOURCE_LOAD_FAILED" ||
              data.code === "MFW_TASK_SUBMIT_FAILED") &&
            data.detail
          ) {
            // 资源加载失败或任务提交失败，展示详细信息
            const reason =
              data.detail.reason ||
              t("ui.modals.ocrModal.unknownReason", "未知原因");
            const resourceDir = data.detail.resource_dir || "";
            const suggestions: string[] = data.detail.suggestions || [];

            errorTitle = t(
              "ui.modals.ocrModal.resourceLoadFailed",
              "OCR 资源加载失败",
            );
            let content = t(
              "ui.modals.ocrModal.errorReason",
              "原因: {{reason}}",
              { reason },
            );
            if (resourceDir) {
              content += t(
                "ui.modals.ocrModal.errorResourceDir",
                "\n\n资源目录:\n{{dir}}",
                { dir: resourceDir },
              );
            }
            if (suggestions.length > 0) {
              content += t(
                "ui.modals.ocrModal.errorSuggestionsHeader",
                "\n\n排查建议:",
              );
              suggestions.forEach((s) => {
                content += `\n• ${s}`;
              });
            }
            errorContent = (
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  fontFamily: "inherit",
                  margin: 0,
                }}
              >
                {content}
              </pre>
            );
          }

          Modal.error({
            title: errorTitle,
            content: errorContent,
            width: 520,
          });
          setOcrSuccess(false);
        }
      };

      const unregisterOCR = mfwProtocol.onOCRResult(handleOCRResult);

      return () => {
        unregisterOCR();
      };
    }, [open, t]);

    // 重绘 canvas
    const redrawCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      const img = imageRef.current;
      if (!canvas || !ctx || !img) return;

      // 检查是否有负数坐标
      const hasNegativeCoord =
        rectangle &&
        (rectangle.x < 0 ||
          rectangle.y < 0 ||
          rectangle.width < 0 ||
          rectangle.height < 0);

      // 解析负数坐标
      let resolved = null;

      if (rectangle && hasNegativeCoord) {
        resolved = resolveNegativeROI(
          [rectangle.x, rectangle.y, rectangle.width, rectangle.height],
          img.width,
          img.height,
        );
      }

      // 清除画布
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 绘制图片
      ctx.drawImage(img, 0, 0);

      if (rectangle) {
        // 绘制原始矩形（用户输入的坐标）
        ctx.strokeStyle = "#1890ff";
        ctx.lineWidth = 2;
        ctx.fillStyle = "rgba(24, 144, 255, 0.1)";
        ctx.fillRect(
          rectangle.x,
          rectangle.y,
          rectangle.width,
          rectangle.height,
        );
        ctx.strokeRect(
          rectangle.x,
          rectangle.y,
          rectangle.width,
          rectangle.height,
        );

        // 如果有负数坐标且被分割，绘制分割后的两个区域
        if (resolved && resolved.split.isSplit) {
          // 绘制左上角区域
          if (resolved.split.topLeft) {
            const tl = resolved.split.topLeft;
            ctx.strokeStyle = "#1890ff";
            ctx.lineWidth = 2;
            ctx.fillStyle = "rgba(24, 144, 255, 0.1)";
            ctx.fillRect(tl.x, tl.y, tl.width, tl.height);
            ctx.strokeRect(tl.x, tl.y, tl.width, tl.height);
          }
          // 绘制右下角区域
          if (resolved.split.bottomRight) {
            const br = resolved.split.bottomRight;
            ctx.strokeStyle = "#1890ff";
            ctx.lineWidth = 2;
            ctx.fillStyle = "rgba(24, 144, 255, 0.1)";
            ctx.fillRect(br.x, br.y, br.width, br.height);
            ctx.strokeRect(br.x, br.y, br.width, br.height);
          }
        }
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
      [isDrawing, startPoint, rectangle, requestOCR],
    );

    // 确定回填
    const handleConfirm = useCallback(() => {
      if (!ocrText) {
        message.warning(
          t("ui.modals.ocrModal.selectRegionFirst", "请先框选区域进行识别"),
        );
        return;
      }

      const roiValue: [number, number, number, number] | undefined = rectangle
        ? [
            Math.round(rectangle.x),
            Math.round(rectangle.y),
            Math.round(rectangle.width),
            Math.round(rectangle.height),
          ]
        : undefined;

      onConfirm(ocrText, roiValue);
      onClose();
    }, [ocrText, rectangle, onConfirm, onClose, t]);

    // 确定回填并同时填充 ROI
    const handleConfirmWithROI = useCallback(() => {
      if (!ocrText) {
        message.warning(
          t("ui.modals.ocrModal.selectRegionFirst", "请先框选区域进行识别"),
        );
        return;
      }

      const roiValue: [number, number, number, number] | undefined = rectangle
        ? [
            Math.round(rectangle.x),
            Math.round(rectangle.y),
            Math.round(rectangle.width),
            Math.round(rectangle.height),
          ]
        : undefined;

      onConfirm(ocrText, roiValue, true);
      onClose();
    }, [ocrText, rectangle, onConfirm, onClose, t]);

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
      [createMouseHandlers],
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
      [redrawCanvas],
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
      [rectangle, requestOCR],
    );

    return (
      <ScreenshotModalBase
        open={open}
        onClose={onClose}
        title={t("ui.modals.ocrModal.title", "OCR 文字识别预览")}
        width={900}
        confirmText={t("ui.modals.ocrModal.confirmText", "填充文本")}
        confirmDisabled={!ocrText}
        onConfirm={handleConfirm}
        extraButtons={
          <Button
            icon={<CheckCircleOutlined />}
            onClick={handleConfirmWithROI}
            disabled={!ocrText || !rectangle}
            size="small"
          >
            {t("ui.modals.ocrModal.confirmWithRoi", "填充 ROI 与文本")}
          </Button>
        }
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
                {t("ui.modals.ocrModal.modeSectionTitle", "识别模式")}
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
                      {t(
                        "ui.modals.ocrModal.frontendModeTitle",
                        "前端OCR（Tesseract.js）",
                      )}
                    </div>
                    <div>
                      {t(
                        "ui.modals.ocrModal.frontendModeLine1",
                        "• 基于当前已截取的图片识别",
                      )}
                    </div>
                    <div>
                      {t(
                        "ui.modals.ocrModal.frontendModeLine2",
                        "• 支持100+多语言混合识别",
                      )}
                    </div>
                    <div>
                      {t(
                        "ui.modals.ocrModal.frontendModeLine3",
                        "• 速度较快（初次需要加载模型）",
                      )}
                    </div>
                    <div style={{ color: "#52c41a", marginTop: 4 }}>
                      {t(
                        "ui.modals.ocrModal.frontendModeBenefit1",
                        "✓ 无需额外配置资源位置",
                      )}
                    </div>
                    <div style={{ color: "#52c41a", marginTop: 4 }}>
                      {t(
                        "ui.modals.ocrModal.frontendModeBenefit2",
                        "✓ 不会因窗口更新导致内容不一致",
                      )}
                    </div>
                    <div style={{ color: "#faad14", marginTop: 4 }}>
                      {t(
                        "ui.modals.ocrModal.frontendModeWarning",
                        "⚠️ 识别信息可能与原生 OCR 不一致",
                      )}
                    </div>
                  </div>
                }
              >
                <Radio.Button value="frontend">
                  {t("ui.modals.ocrModal.frontendLabel", "前端")}{" "}
                  <QuestionCircleOutlined style={{ marginLeft: 4 }} />
                </Radio.Button>
              </Tooltip>
              <Tooltip
                title={
                  <div>
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>
                      {t(
                        "ui.modals.ocrModal.nativeModeTitle",
                        "原生OCR（MaaFramework）",
                      )}
                    </div>
                    <div>
                      {t(
                        "ui.modals.ocrModal.nativeModeLine1",
                        "• 使用本地 OCR 模型识别",
                      )}
                    </div>
                    <div>
                      {t(
                        "ui.modals.ocrModal.nativeModeLine2",
                        "• 基于当前固定底图识别，所见即所得",
                      )}
                    </div>
                    <div>
                      {t(
                        "ui.modals.ocrModal.nativeModeLine3",
                        "• 速度较慢，无后处理",
                      )}
                    </div>
                  </div>
                }
              >
                <Radio.Button value="native">
                  {t("ui.modals.ocrModal.nativeLabel", "原生")}{" "}
                  <QuestionCircleOutlined style={{ marginLeft: 4 }} />
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
                {roi.roiCoords}
              </span>
              <span style={{ fontSize: 12, color: "#8c8c8c" }}>
                [x, y, w, h]
              </span>
              <Tooltip
                title={
                  <div>
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>
                      {roi.negativeCoordTitle}
                    </div>
                    <div>{roi.negativeX}</div>
                    <div>{roi.negativeY}</div>
                    <div>{roi.zeroExtend}</div>
                    <div>{roi.negativeAbs}</div>
                  </div>
                }
              >
                <InfoCircleOutlined
                  style={{ fontSize: 12, color: "#8c8c8c", cursor: "help" }}
                />
              </Tooltip>
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
                <Tooltip title={roi.tooltipNegativeX}>
                  <span
                    style={{
                      fontSize: 10,
                      color:
                        rectangle && rectangle.x < 0 ? "#faad14" : "#bfbfbf",
                    }}
                  >
                    {rectangle && rectangle.x < 0 ? roi.indicatorFromRight : ""}
                  </span>
                </Tooltip>
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
                <Tooltip title={roi.tooltipNegativeY}>
                  <span
                    style={{
                      fontSize: 10,
                      color:
                        rectangle && rectangle.y < 0 ? "#faad14" : "#bfbfbf",
                    }}
                  >
                    {rectangle && rectangle.y < 0 ? roi.indicatorFromBottom : ""}
                  </span>
                </Tooltip>
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
                <Tooltip title={roi.tooltipZeroExtendW}>
                  <span
                    style={{
                      fontSize: 10,
                      color:
                        rectangle && rectangle.width < 0
                          ? "#faad14"
                          : "#bfbfbf",
                    }}
                  >
                    {rectangle && rectangle.width === 0
                      ? roi.indicatorToEdge
                      : rectangle && rectangle.width < 0
                        ? roi.indicatorBothH
                        : ""}
                  </span>
                </Tooltip>
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
                <Tooltip title={roi.tooltipZeroExtendH}>
                  <span
                    style={{
                      fontSize: 10,
                      color:
                        rectangle && rectangle.height < 0
                          ? "#faad14"
                          : "#bfbfbf",
                    }}
                  >
                    {rectangle && rectangle.height === 0
                      ? roi.indicatorToBottomEdge
                      : rectangle && rectangle.height < 0
                        ? roi.indicatorBothV
                        : ""}
                  </span>
                </Tooltip>
              </Space>

              {/* 显示坐标信息 */}
              {rectangle &&
                (rectangle.x < 0 ||
                  rectangle.y < 0 ||
                  rectangle.width < 0 ||
                  rectangle.height < 0) &&
                imageRef.current && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: "8px 10px",
                      backgroundColor: "#e6f7ff",
                      borderRadius: 6,
                      border: "1px solid #91d5ff",
                    }}
                  >
                    {(() => {
                      const resolved = resolveNegativeROI(
                        [
                          rectangle.x,
                          rectangle.y,
                          rectangle.width,
                          rectangle.height,
                        ],
                        imageRef.current!.width,
                        imageRef.current!.height,
                      );
                      return (
                        <>
                          {resolved.split.topLeft && (
                            <div
                              style={{
                                fontSize: 12,
                                color: "#262626",
                                marginBottom: 4,
                              }}
                            >
                              <span style={{ color: "#1890ff" }}>
                                {roi.splitTopLeft}
                              </span>
                              [{resolved.split.topLeft.x},{" "}
                              {resolved.split.topLeft.y},{" "}
                              {resolved.split.topLeft.width},{" "}
                              {resolved.split.topLeft.height}]
                            </div>
                          )}
                          {resolved.split.bottomRight && (
                            <div style={{ fontSize: 12, color: "#262626" }}>
                              <span style={{ color: "#1890ff" }}>
                                {roi.splitBottomRight}
                              </span>
                              [{resolved.split.bottomRight.x},{" "}
                              {resolved.split.bottomRight.y},{" "}
                              {resolved.split.bottomRight.width},{" "}
                              {resolved.split.bottomRight.height}]
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
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
                  {t("ui.modals.ocrModal.resultSectionTitle", "识别结果")}
                </span>
                {isOCRing && (
                  <span style={{ fontSize: 11, color: "#1890ff" }}>
                    {t("ui.modals.ocrModal.recognizing", "识别中...")}
                    {isLoadingModel &&
                      ocrMode === "frontend" &&
                      t(
                        "ui.modals.ocrModal.loadingModel",
                        "（首次加载模型中）",
                      )}
                  </span>
                )}
                {!isOCRing && ocrSuccess === true && (
                  <span style={{ fontSize: 11, color: "#52c41a" }}>
                    <CheckCircleOutlined />{" "}
                    {t("ui.modals.ocrModal.recognizeSuccess", "识别成功")}
                  </span>
                )}
                {!isOCRing && ocrSuccess === false && ocrText === "" && (
                  <span style={{ fontSize: 11, color: "#faad14" }}>
                    {t(
                      "ui.modals.ocrModal.noTextDetected",
                      "未检测到文字内容",
                    )}
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
                {t("ui.modals.ocrModal.clear", "清空")}
              </Button>
            </div>
            <TextArea
              value={ocrText}
              onChange={(e) => {
                setOcrText(e.target.value);
                if (ocrSuccess !== null) setOcrSuccess(null);
              }}
              placeholder={t(
                "ui.modals.ocrModal.resultPlaceholder",
                "在截图上框选区域后，系统将自动识别文字",
              )}
              rows={4}
              style={{ resize: "none" }}
              disabled={isOCRing}
            />
          </div>
        </div>
      </ScreenshotModalBase>
    );
  },
);
