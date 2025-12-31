import { memo, useState, useCallback, useRef, useEffect } from "react";
import { message, Radio, Space } from "antd";
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
}

export const ColorModal = memo(
  ({ open, onClose, onConfirm, targetKey, initialMethod }: ColorModalProps) => {
    const [screenshot, setScreenshot] = useState<string | null>(null);

    // 检测初始颜色模式
    const getInitialColorMode = useCallback((): ColorMode => {
      if (initialMethod === 40) return "HSV";
      if (initialMethod === 6) return "GRAY";
      return "RGB";
    }, [initialMethod]);

    const [colorMode, setColorMode] = useState<ColorMode>(getInitialColorMode);
    const [pickedColor, setPickedColor] = useState<ColorValue | null>(null);

    // 重置颜色模式
    useEffect(() => {
      if (open) {
        const mode = getInitialColorMode();
        setColorMode(mode);
        setPickedColor(null);
      }
    }, [open, getInitialColorMode]);

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
      },
      [pickedColor, colorMode, hsvToRgb, rgbToHsv, rgbToGray]
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
        );
      },
      [handleCanvasClick]
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
      </ScreenshotModalBase>
    );
  }
);
