import { memo, useState, useCallback, useRef, useEffect } from "react";
import { message, Radio, Space, InputNumber, Button } from "antd";
import { EyeOutlined, StopOutlined } from "@ant-design/icons";
import {
  ScreenshotModalBase,
  type CanvasRenderProps,
} from "./ScreenshotModalBase";

// 颜色模式类型
type ColorMode = "RGB" | "HSV" | "GRAY";
type ColorValue = [number, number, number] | [number];

interface ColorModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (color: ColorValue) => void;
  targetKey?: string; // 添加目标字段名,用于显示标题
  initialMethod?: number; // 初始 method 值（4=RGB, 40=HSV, 6=GRAY）
  initialLower?: number[]; // 初始 lower 颜色范围
  initialUpper?: number[]; // 初始 upper 颜色范围
}

export const ColorModal = memo(
  ({ open, onClose, onConfirm, targetKey, initialMethod, initialLower, initialUpper }: ColorModalProps) => {
    const [screenshot, setScreenshot] = useState<string | null>(null);

    // 检测初始颜色模式
    const getInitialColorMode = useCallback((): ColorMode => {
      if (initialMethod === 40) return "HSV";
      if (initialMethod === 6) return "GRAY";
      return "RGB";
    }, [initialMethod]);

    const [colorMode, setColorMode] = useState<ColorMode>(getInitialColorMode);
    const [pickedColor, setPickedColor] = useState<ColorValue | null>(null);

    // 颜色范围预览状态
    const [lowerBound, setLowerBound] = useState<number[]>([0, 0, 0]);
    const [upperBound, setUpperBound] = useState<number[]>([255, 255, 255]);
    const [previewActive, setPreviewActive] = useState(false);
    const [matchedPixelCount, setMatchedPixelCount] = useState<number | null>(
      null
    );
    const [isComputing, setIsComputing] = useState(false);
    const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

    // 重置颜色模式
    useEffect(() => {
      if (open) {
        const mode = getInitialColorMode();
        setColorMode(mode);
        setPickedColor(null);

        // 初始化颜色范围预览边界
        const channelCount = mode === "GRAY" ? 1 : 3;
        const defaultLower = channelCount === 1 ? [0] : [0, 0, 0];
        const defaultUpper = channelCount === 1 ? [255] : [255, 255, 255];

        if (initialLower && initialLower.length === channelCount) {
          setLowerBound([...initialLower]);
        } else {
          setLowerBound(defaultLower);
        }
        if (initialUpper && initialUpper.length === channelCount) {
          setUpperBound([...initialUpper]);
        } else {
          setUpperBound(defaultUpper);
        }

        // 重置预览状态
        setPreviewActive(false);
        setMatchedPixelCount(null);
        setIsComputing(false);
      }
    }, [open, getInitialColorMode, initialLower, initialUpper]);

    // 取色后自动填入对应边界
    useEffect(() => {
      if (pickedColor) {
        if (targetKey === "lower") {
          setLowerBound([...pickedColor]);
        } else if (targetKey === "upper") {
          setUpperBound([...pickedColor]);
        }
        // 取色后清除旧预览
        if (previewActive) {
          setPreviewActive(false);
          setMatchedPixelCount(null);
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pickedColor, targetKey]);

    const imageRef = useRef<HTMLImageElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const viewportPropsRef = useRef<CanvasRenderProps | null>(null);
    const initializeImageRef = useRef<((img: HTMLImageElement) => void) | null>(
      null
    );

    // RGB 转 HSV
    const rgbToHsv = useCallback(
      (r: number, g: number, b: number): [number, number, number] => {
        r /= 255;
        g /= 255;
        b /= 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const diff = max - min;

        let h = 0;
        if (diff !== 0) {
          if (max === r) {
            h = 60 * (((g - b) / diff) % 6);
          } else if (max === g) {
            h = 60 * ((b - r) / diff + 2);
          } else {
            h = 60 * ((r - g) / diff + 4);
          }
        }
        if (h < 0) h += 360;

        const s = max === 0 ? 0 : diff / max;
        const v = max;

        return [
          Math.round(h / 2), // OpenCV HSV: H 范围 0-180
          Math.round(s * 255), // S 范围 0-255
          Math.round(v * 255), // V 范围 0-255
        ];
      },
      []
    );

    // RGB转灰度
    const rgbToGray = useCallback((r: number, g: number, b: number): number => {
      // 标准灰度转换公式
      return Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    }, []);

    // HSV 转 RGB
    const hsvToRgb = useCallback(
      (h: number, s: number, v: number): [number, number, number] => {
        // OpenCV HSV: H 范围 0-180, S 和 V 范围 0-255
        h = h * 2; // 转换回 0-360
        s = s / 255; // 转换到 0-1
        v = v / 255; // 转换到 0-1

        const c = v * s;
        const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        const m = v - c;

        let r = 0,
          g = 0,
          b = 0;

        if (h >= 0 && h < 60) {
          r = c;
          g = x;
          b = 0;
        } else if (h >= 60 && h < 120) {
          r = x;
          g = c;
          b = 0;
        } else if (h >= 120 && h < 180) {
          r = 0;
          g = c;
          b = x;
        } else if (h >= 180 && h < 240) {
          r = 0;
          g = x;
          b = c;
        } else if (h >= 240 && h < 300) {
          r = x;
          g = 0;
          b = c;
        } else if (h >= 300 && h < 360) {
          r = c;
          g = 0;
          b = x;
        }

        return [
          Math.round((r + m) * 255),
          Math.round((g + m) * 255),
          Math.round((b + m) * 255),
        ];
      },
      []
    );

    // 获取通道信息
    const getChannelInfo = useCallback((): {
      count: number;
      labels: string[];
      max: number[];
    } => {
      switch (colorMode) {
        case "RGB":
          return { count: 3, labels: ["R", "G", "B"], max: [255, 255, 255] };
        case "HSV":
          return { count: 3, labels: ["H", "S", "V"], max: [180, 255, 255] };
        case "GRAY":
          return { count: 1, labels: ["灰度"], max: [255] };
      }
    }, [colorMode]);

    // 更新边界值的某个通道
    const handleBoundChange = useCallback(
      (
        bound: "lower" | "upper",
        channelIndex: number,
        value: number | null
      ) => {
        if (value === null) return;
        const setter = bound === "lower" ? setLowerBound : setUpperBound;
        setter((prev) => {
          const next = [...prev];
          next[channelIndex] = Math.round(value);
          return next;
        });
        // 修改边界后清除旧预览
        if (previewActive) {
          setPreviewActive(false);
          setMatchedPixelCount(null);
        }
      },
      [previewActive]
    );

    // 计算颜色范围预览
    const computePreview = useCallback(() => {
      const canvas = canvasRef.current;
      const img = imageRef.current;
      if (!canvas || !img) {
        message.warning("请先等待截图加载");
        return;
      }

      const channelInfo = getChannelInfo();
      if (lowerBound.length !== channelInfo.count || upperBound.length !== channelInfo.count) {
        message.warning("颜色边界通道数与当前颜色模式不匹配");
        return;
      }

      setIsComputing(true);

      requestAnimationFrame(() => {
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setIsComputing(false);
          return;
        }

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const { data, width, height } = imageData;

        // 初始化 overlay canvas
        const overlay = overlayCanvasRef.current;
        if (!overlay) {
          setIsComputing(false);
          return;
        }
        overlay.width = width;
        overlay.height = height;
        const overlayCtx = overlay.getContext("2d");
        if (!overlayCtx) {
          setIsComputing(false);
          return;
        }

        const overlayImageData = overlayCtx.createImageData(width, height);
        const overlayData = overlayImageData.data;

        let count = 0;
        const totalPixels = width * height;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          let channels: number[];
          switch (colorMode) {
            case "RGB":
              channels = [r, g, b];
              break;
            case "HSV":
              channels = [...rgbToHsv(r, g, b)];
              break;
            case "GRAY":
              channels = [rgbToGray(r, g, b)];
              break;
          }

          let matched = true;
          for (let c = 0; c < channels.length; c++) {
            if (channels[c] < lowerBound[c] || channels[c] > upperBound[c]) {
              matched = false;
              break;
            }
          }

          if (matched) {
            // 命中像素: 半透明绿色高亮
            overlayData[i] = 0;
            overlayData[i + 1] = 255;
            overlayData[i + 2] = 0;
            overlayData[i + 3] = 100;
            count++;
          } else {
            // 非命中像素: 半透明黑色遮罩
            overlayData[i] = 0;
            overlayData[i + 1] = 0;
            overlayData[i + 2] = 0;
            overlayData[i + 3] = 120;
          }
        }

        overlayCtx.putImageData(overlayImageData, 0, 0);
        setMatchedPixelCount(count);
        setPreviewActive(true);
        setIsComputing(false);

        const percentage = ((count / totalPixels) * 100).toFixed(2);
        message.success(
          `匹配到 ${count.toLocaleString()} 个像素（${percentage}%）`
        );
      });
    }, [lowerBound, upperBound, colorMode, rgbToHsv, rgbToGray, getChannelInfo]);

    // 清除预览
    const clearPreview = useCallback(() => {
      setPreviewActive(false);
      setMatchedPixelCount(null);
      const overlay = overlayCanvasRef.current;
      if (overlay) {
        const ctx = overlay.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, overlay.width, overlay.height);
        }
      }
    }, []);

    // 点击取色
    const handleCanvasClick = useCallback(
      (
        e: React.MouseEvent<HTMLCanvasElement>,
        scale: number,
        canvasRef: React.RefObject<HTMLCanvasElement | null>
      ) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / scale);
        const y = Math.floor((e.clientY - rect.top) / scale);

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const imageData = ctx.getImageData(x, y, 1, 1);
        const pixel = imageData.data;
        const r = pixel[0];
        const g = pixel[1];
        const b = pixel[2];

        let color: ColorValue;
        let displayText: string;

        switch (colorMode) {
          case "RGB":
            color = [r, g, b];
            displayText = `RGB(${r}, ${g}, ${b})`;
            break;
          case "HSV": {
            const hsv = rgbToHsv(r, g, b);
            color = hsv;
            displayText = `HSV(${hsv[0]}, ${hsv[1]}, ${hsv[2]})`;
            break;
          }
          case "GRAY":
            const gray = rgbToGray(r, g, b);
            color = [gray];
            displayText = `GRAY(${gray})`;
            break;
        }

        setPickedColor(color);
        message.success(`取色成功: ${displayText}`);
      },
      [colorMode, rgbToHsv, rgbToGray]
    );

    // 确定回填
    const handleConfirm = useCallback(() => {
      if (!pickedColor) {
        message.warning("请先在截图上点击取色");
        return;
      }

      onConfirm(pickedColor);
      onClose();
    }, [pickedColor, onConfirm, onClose]);

    // 重置状态
    const handleReset = useCallback(() => {
      setScreenshot(null);
      setPickedColor(null);
      setColorMode(getInitialColorMode());
      imageRef.current = null;
      canvasRef.current = null;
      initializeImageRef.current = null;
      // 重置范围预览
      setPreviewActive(false);
      setMatchedPixelCount(null);
      setIsComputing(false);
      const overlay = overlayCanvasRef.current;
      if (overlay) {
        const ctx = overlay.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, overlay.width, overlay.height);
      }
    }, [getInitialColorMode]);

    // 切换颜色模式时转换已选颜色
    const handleColorModeChange = useCallback(
      (mode: ColorMode) => {
        if (!pickedColor) {
          setColorMode(mode);
          return;
        }
        let newColor: ColorValue;

        // 统一转换到 RGB
        let r: number, g: number, b: number;

        if (colorMode === "RGB" && pickedColor.length === 3) {
          [r, g, b] = pickedColor;
        } else if (colorMode === "HSV" && pickedColor.length === 3) {
          [r, g, b] = hsvToRgb(pickedColor[0], pickedColor[1], pickedColor[2]);
        } else if (colorMode === "GRAY" && pickedColor.length === 1) {
          // 灰度转 RGB
          r = g = b = pickedColor[0];
        } else {
          // 异常情况重置
          setColorMode(mode);
          setPickedColor(null);
          return;
        }

        // 从 RGB 转换到目标模式
        switch (mode) {
          case "RGB":
            newColor = [r, g, b];
            break;
          case "HSV":
            newColor = rgbToHsv(r, g, b);
            break;
          case "GRAY":
            newColor = [rgbToGray(r, g, b)];
            break;
        }

        setColorMode(mode);
        setPickedColor(newColor);

        // 切换颜色模式时重置边界和预览
        const channelCount = mode === "GRAY" ? 1 : 3;
        setLowerBound(channelCount === 1 ? [0] : [0, 0, 0]);
        setUpperBound(channelCount === 1 ? [255] : [255, 255, 255]);
        clearPreview();
      },
      [pickedColor, colorMode, hsvToRgb, rgbToHsv, rgbToGray, clearPreview]
    );

    // 渲染 Canvas
    const renderCanvas = useCallback(
      (props: CanvasRenderProps) => {
        const {
          scale,
          panOffset,
          getBaseCursorStyle,
          isPanning,
          isSpacePressed,
          startPan,
          updatePan,
          endPan,
          imageElement,
        } = props;

        // 存储最新的 props
        viewportPropsRef.current = props;

        // 存储图片到 ref
        if (imageElement) {
          imageRef.current = imageElement;
        }

        const baseCursor = getBaseCursorStyle();
        const cursorStyle = baseCursor || "crosshair";

        const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
          // 中键拖动
          if (e.button === 1) {
            e.preventDefault();
            startPan(e.clientX, e.clientY, true);
            return;
          }
          // 空格拖动
          if (isSpacePressed) {
            startPan(e.clientX, e.clientY);
            return;
          }
          // 取色
          const tempCanvasRef = { current: canvasRef.current };
          handleCanvasClick(e, scale, tempCanvasRef);
        };

        const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
          if (isPanning) {
            updatePan(e.clientX, e.clientY);
          }
        };

        const handleMouseUp = () => {
          if (isPanning) {
            endPan();
          }
        };

        const handleMouseLeave = () => {
          if (isPanning) {
            endPan();
          }
        };

        // 滚轮缩放事件处理
        const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
          e.preventDefault();
          e.stopPropagation();
        };

        return (
          <>
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              onWheel={handleWheel}
              style={{
                cursor: cursorStyle,
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${scale})`,
                transformOrigin: "top left",
                position: "absolute",
              }}
            />
            <canvas
              ref={overlayCanvasRef}
              style={{
                pointerEvents: "none",
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${scale})`,
                transformOrigin: "top left",
                position: "absolute",
                display: previewActive ? "block" : "none",
              }}
            />
          </>
        );
      },
      [handleCanvasClick, previewActive]
    );

    // 图片加载完成后初始化
    const handleCanvasInit = useCallback((img: HTMLImageElement) => {
      imageRef.current = img;
      const canvas = canvasRef.current;
      const props = viewportPropsRef.current;
      if (!canvas) return;

      canvas.width = img.width;
      canvas.height = img.height;
      props?.initializeImage?.(img);

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
      }
    }, []);

    // 根据 targetKey 生成标题
    const title =
      targetKey === "lower"
        ? "颜色取点工具 - 下界颜色"
        : targetKey === "upper"
        ? "颜色取点工具 - 上界颜色"
        : "颜色取点工具";

    // 格式化颜色显示文本
    const formatColorText = useCallback(
      (color: ColorValue) => {
        if (colorMode === "GRAY") {
          return `GRAY(${color[0]})`;
        }
        return `${colorMode}(${color[0]}, ${color[1]}, ${color[2]})`;
      },
      [colorMode]
    );

    // 获取颜色预览背景色
    const getColorPreviewStyle = useCallback(
      (color: ColorValue) => {
        if (colorMode === "GRAY") {
          const gray = color[0];
          return `rgb(${gray}, ${gray}, ${gray})`;
        }
        // 显示原始颜色
        if (colorMode === "HSV" && color.length === 3) {
          const [r, g, b] = hsvToRgb(color[0], color[1], color[2]);
          return `rgb(${r}, ${g}, ${b})`;
        }
        return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
      },
      [colorMode, hsvToRgb]
    );

    return (
      <ScreenshotModalBase
        open={open}
        onClose={onClose}
        title={title}
        width={900}
        confirmDisabled={!pickedColor}
        onConfirm={handleConfirm}
        renderCanvas={renderCanvas}
        onScreenshotChange={setScreenshot}
        onImageLoaded={handleCanvasInit}
        onReset={handleReset}
      >
        {/* 颜色模式选择 */}
        <div
          style={{
            padding: 12,
            backgroundColor: "#fafafa",
            borderRadius: 8,
            marginBottom: 12,
            border: "1px solid #e8e8e8",
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
              颜色模式
            </span>
          </div>
          <Radio.Group
            value={colorMode}
            onChange={(e) => handleColorModeChange(e.target.value)}
            size="small"
          >
            <Space orientation="vertical">
              <Radio value="RGB">RGB（3通道）</Radio>
              <Radio value="HSV">HSV（3通道）</Radio>
              <Radio value="GRAY">灰度（1通道）</Radio>
            </Space>
          </Radio.Group>
        </div>

        {/* 颜色预览 */}
        <div
          style={{
            padding: 12,
            backgroundColor: "#fff",
            borderRadius: 8,
            border: `1px solid ${pickedColor ? "#b7eb8f" : "#e8e8e8"}`,
            transition: "border-color 0.3s ease",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: pickedColor ? 10 : 0,
            }}
          >
            <div
              style={{
                width: 3,
                height: 16,
                backgroundColor: "#52c41a",
                borderRadius: 2,
              }}
            />
            <span style={{ fontSize: 14, fontWeight: 500, color: "#262626" }}>
              已选颜色
            </span>
          </div>
          {pickedColor ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  backgroundColor: getColorPreviewStyle(pickedColor),
                  border: "1px solid #d9d9d9",
                  borderRadius: 4,
                }}
              />
              <span style={{ fontSize: 12, color: "#262626" }}>
                {formatColorText(pickedColor)}
              </span>
            </div>
          ) : (
            <span style={{ fontSize: 12, color: "#8c8c8c" }}>
              请在截图上点击取色
            </span>
          )}
        </div>

        {/* 颜色范围预览 */}
        <div
          style={{
            padding: 12,
            backgroundColor: "#fff",
            borderRadius: 8,
            border: `1px solid ${previewActive ? "#91caff" : "#e8e8e8"}`,
            transition: "border-color 0.3s ease",
            marginTop: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
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
              颜色范围预览
            </span>
          </div>

          {/* Lower 边界输入 */}
          <div style={{ marginBottom: 8 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  color: "#595959",
                  fontWeight: 500,
                  width: 42,
                }}
              >
                下界
              </span>
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 2,
                  backgroundColor: (() => {
                    if (colorMode === "GRAY")
                      return `rgb(${lowerBound[0]},${lowerBound[0]},${lowerBound[0]})`;
                    if (colorMode === "HSV" && lowerBound.length === 3) {
                      const [r, g, b] = hsvToRgb(
                        lowerBound[0],
                        lowerBound[1],
                        lowerBound[2]
                      );
                      return `rgb(${r},${g},${b})`;
                    }
                    return `rgb(${lowerBound[0] ?? 0},${lowerBound[1] ?? 0},${lowerBound[2] ?? 0})`;
                  })(),
                  border: "1px solid #d9d9d9",
                  flexShrink: 0,
                }}
              />
            </div>
            <Space size={4}>
              {getChannelInfo().labels.map((label, idx) => (
                <div key={`lower-${idx}`} style={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <span style={{ fontSize: 11, color: "#8c8c8c", width: 12, textAlign: "right" }}>
                    {label}
                  </span>
                  <InputNumber
                    value={lowerBound[idx] ?? 0}
                    onChange={(v) => handleBoundChange("lower", idx, v)}
                    min={0}
                    max={getChannelInfo().max[idx]}
                    precision={0}
                    size="small"
                    style={{ width: 58 }}
                  />
                </div>
              ))}
            </Space>
          </div>

          {/* Upper 边界输入 */}
          <div style={{ marginBottom: 12 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  color: "#595959",
                  fontWeight: 500,
                  width: 42,
                }}
              >
                上界
              </span>
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 2,
                  backgroundColor: (() => {
                    if (colorMode === "GRAY")
                      return `rgb(${upperBound[0]},${upperBound[0]},${upperBound[0]})`;
                    if (colorMode === "HSV" && upperBound.length === 3) {
                      const [r, g, b] = hsvToRgb(
                        upperBound[0],
                        upperBound[1],
                        upperBound[2]
                      );
                      return `rgb(${r},${g},${b})`;
                    }
                    return `rgb(${upperBound[0] ?? 255},${upperBound[1] ?? 255},${upperBound[2] ?? 255})`;
                  })(),
                  border: "1px solid #d9d9d9",
                  flexShrink: 0,
                }}
              />
            </div>
            <Space size={4}>
              {getChannelInfo().labels.map((label, idx) => (
                <div key={`upper-${idx}`} style={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <span style={{ fontSize: 11, color: "#8c8c8c", width: 12, textAlign: "right" }}>
                    {label}
                  </span>
                  <InputNumber
                    value={upperBound[idx] ?? 255}
                    onChange={(v) => handleBoundChange("upper", idx, v)}
                    min={0}
                    max={getChannelInfo().max[idx]}
                    precision={0}
                    size="small"
                    style={{ width: 58 }}
                  />
                </div>
              ))}
            </Space>
          </div>

          {/* 预览操作 */}
          <Space size={8}>
            <Button
              type="primary"
              size="small"
              icon={<EyeOutlined />}
              onClick={computePreview}
              loading={isComputing}
              disabled={!screenshot}
            >
              预览
            </Button>
            {previewActive && (
              <Button
                size="small"
                icon={<StopOutlined />}
                onClick={clearPreview}
              >
                清除
              </Button>
            )}
          </Space>

          {/* 像素计数结果 */}
          {matchedPixelCount !== null && (
            <div
              style={{
                marginTop: 10,
                padding: "8px 10px",
                backgroundColor: "#f6ffed",
                borderRadius: 6,
                border: "1px solid #b7eb8f",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ fontSize: 12, color: "#52c41a", fontWeight: 500 }}>
                  匹配像素
                </span>
                <span style={{ fontSize: 14, color: "#262626", fontWeight: 600 }}>
                  {matchedPixelCount.toLocaleString()}
                </span>
              </div>
              {imageRef.current && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginTop: 4,
                  }}
                >
                  <span style={{ fontSize: 11, color: "#8c8c8c" }}>
                    占比
                  </span>
                  <span style={{ fontSize: 12, color: "#595959" }}>
                    {(
                      (matchedPixelCount /
                        (imageRef.current.width * imageRef.current.height)) *
                      100
                    ).toFixed(2)}
                    %
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </ScreenshotModalBase>
    );
  }
);
