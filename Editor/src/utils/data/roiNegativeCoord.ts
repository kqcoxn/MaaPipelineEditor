/**
 * ROI 负数坐标处理工具
 *
 * MaaFramework v5.6+ 支持负数坐标：
 * - x 负数：从右边缘计算
 * - y 负数：从下边缘计算
 * - w 为 0：延伸至右边缘；w 为负数：取绝对值，(x,y) 视为右下角
 * - h 为 0：延伸至下边缘；h 为负数：取绝对值，(x,y) 视为右下角
 */

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SplitROI {
  /** 左上角区域的矩形 */
  topLeft: Rectangle | null;
  /** 右下角区域的矩形 */
  bottomRight: Rectangle | null;
  /** 是否被分割 */
  isSplit: boolean;
}

export interface ResolvedROI {
  /** 解析后的实际坐标 */
  actual: Rectangle;
  /** 是否有负数坐标 */
  hasNegative: boolean;
  /** 是否需要扩展边距 */
  needsPadding: boolean;
  /** 扩展边距大小 */
  padding: { left: number; top: number; right: number; bottom: number };
  /** 原始坐标是否超出屏幕范围 */
  outOfBounds: {
    left: boolean;
    top: boolean;
    right: boolean;
    bottom: boolean;
  };
  /** 分割后的 ROI 区域 */
  split: SplitROI;
}

/**
 * 解析 ROI 负数坐标为实际坐标
 *
 * @param roi 原始 ROI [x, y, w, h]
 * @param imageWidth 图像宽度
 * @param imageHeight 图像高度
 * @returns 解析结果
 */
export function resolveNegativeROI(
  roi: [number, number, number, number],
  imageWidth: number,
  imageHeight: number
): ResolvedROI {
  const [rawX, rawY, rawW, rawH] = roi;

  // 检测是否有负数
  const hasNegative = rawX < 0 || rawY < 0 || rawW < 0 || rawH < 0;

  // 解析实际坐标
  let actualX = rawX;
  let actualY = rawY;
  let actualW = rawW;
  let actualH = rawH;

  // 处理负数 x
  if (rawX < 0) {
    actualX = imageWidth + rawX;
  }

  // 处理负数 y
  if (rawY < 0) {
    actualY = imageHeight + rawY;
  }

  // 处理负数 w
  if (rawW < 0) {
    // w 为负数时，取绝对值，(x,y) 视为右下角
    actualW = Math.abs(rawW);
    actualX = actualX - actualW;
  } else if (rawW === 0) {
    // w 为 0 时延伸至右边缘
    actualW = imageWidth - actualX;
  }

  // 处理负数 h
  if (rawH < 0) {
    actualH = Math.abs(rawH);
    actualY = actualY - actualH;
  } else if (rawH === 0) {
    actualH = imageHeight - actualY;
  }

  // 计算是否超出边界
  const outOfBounds = {
    left: actualX < 0,
    top: actualY < 0,
    right: actualX + actualW > imageWidth,
    bottom: actualY + actualH > imageHeight,
  };

  // 计算需要的扩展边距
  const padding = {
    left: hasNegative && rawX < 0 ? Math.abs(rawX) : 0,
    top: hasNegative && rawY < 0 ? Math.abs(rawY) : 0,
    right: 0,
    bottom: 0,
  };

  // 实际坐标超出边界
  if (outOfBounds.left) {
    padding.left = Math.max(padding.left, Math.abs(actualX));
  }
  if (outOfBounds.top) {
    padding.top = Math.max(padding.top, Math.abs(actualY));
  }

  const needsPadding = padding.left > 0 || padding.top > 0;

  // 计算分割后的 ROI 区域
  const split: SplitROI = { topLeft: null, bottomRight: null, isSplit: false };

  const rightOverflow = Math.max(0, actualX + actualW - imageWidth);
  const bottomOverflow = Math.max(0, actualY + actualH - imageHeight);

  if (rightOverflow > 0 || bottomOverflow > 0) {
    // 右下角区域
    const brW = actualW - rightOverflow;
    const brH = actualH - bottomOverflow;
    if (brW > 0 && brH > 0) {
      split.bottomRight = {
        x: Math.round(actualX),
        y: Math.round(actualY),
        width: Math.round(brW),
        height: Math.round(brH),
      };
    }

    // 左上角区域
    if (rightOverflow > 0 && bottomOverflow > 0) {
      split.topLeft = {
        x: 0,
        y: 0,
        width: Math.round(rightOverflow),
        height: Math.round(bottomOverflow),
      };
    }

    split.isSplit = split.topLeft !== null || split.bottomRight !== null;
  } else {
    // 没有超出
    split.bottomRight = {
      x: Math.round(actualX),
      y: Math.round(actualY),
      width: Math.round(actualW),
      height: Math.round(actualH),
    };
  }

  return {
    actual: {
      x: Math.round(actualX),
      y: Math.round(actualY),
      width: Math.round(actualW),
      height: Math.round(actualH),
    },
    hasNegative,
    needsPadding,
    padding,
    outOfBounds,
    split,
  };
}

/**
 * 计算扩展画布的总尺寸
 */
export function calculateExpandedCanvasSize(
  imageWidth: number,
  imageHeight: number,
  padding: { left: number; top: number; right: number; bottom: number }
): { width: number; height: number } {
  return {
    width: imageWidth + padding.left + padding.right,
    height: imageHeight + padding.top + padding.bottom,
  };
}

/**
 * 将原始坐标转换为扩展画布上的坐标
 */
export function toExpandedCanvasCoord(
  x: number,
  y: number,
  padding: { left: number; top: number }
): { x: number; y: number } {
  return {
    x: x + padding.left,
    y: y + padding.top,
  };
}

/**
 * 在 Canvas 上绘制扩展边距区域
 */
export function drawExpandedPadding(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  imageWidth: number,
  imageHeight: number,
  padding: { left: number; top: number; right: number; bottom: number }
): void {
  const p = padding;

  // 绘制虚拟边距区域
  ctx.fillStyle = "rgba(200, 200, 200, 0.3)";

  // 左侧边距
  if (p.left > 0) {
    ctx.fillRect(0, 0, p.left, canvasHeight);
  }

  // 顶部边距
  if (p.top > 0) {
    ctx.fillRect(0, 0, canvasWidth, p.top);
  }

  // 右侧边距
  if (p.right > 0) {
    ctx.fillRect(canvasWidth - p.right, 0, p.right, canvasHeight);
  }

  // 底部边距
  if (p.bottom > 0) {
    ctx.fillRect(0, canvasHeight - p.bottom, canvasWidth, p.bottom);
  }

  // 绘制图像边界线
  ctx.strokeStyle = "#ff6b6b";
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);

  // 左边界
  if (p.left > 0) {
    ctx.beginPath();
    ctx.moveTo(p.left, 0);
    ctx.lineTo(p.left, canvasHeight);
    ctx.stroke();
  }

  // 上边界
  if (p.top > 0) {
    ctx.beginPath();
    ctx.moveTo(0, p.top);
    ctx.lineTo(canvasWidth, p.top);
    ctx.stroke();
  }

  // 右边界
  if (p.right > 0) {
    ctx.beginPath();
    ctx.moveTo(canvasWidth - p.right, 0);
    ctx.lineTo(canvasWidth - p.right, canvasHeight);
    ctx.stroke();
  }

  // 下边界
  if (p.bottom > 0) {
    ctx.beginPath();
    ctx.moveTo(0, canvasHeight - p.bottom);
    ctx.lineTo(canvasWidth, canvasHeight - p.bottom);
    ctx.stroke();
  }

  ctx.setLineDash([]);
}

/**
 * 在 Canvas 上绘制负坐标说明文字
 */
export function drawNegativeCoordLabels(
  ctx: CanvasRenderingContext2D,
  padding: { left: number; top: number; right: number; bottom: number },
  scale: number = 1
): void {
  ctx.font = `${12 * scale}px sans-serif`;
  ctx.fillStyle = "#666";

  // 左侧标签
  if (padding.left > 0) {
    ctx.save();
    ctx.translate(10 * scale, padding.top + 50 * scale);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`← 扩展区域 (${padding.left}px)`, 0, 0);
    ctx.restore();
  }

  // 顶部标签
  if (padding.top > 0) {
    ctx.fillText(
      `↑ 扩展区域 (${padding.top}px)`,
      padding.left + 10 * scale,
      20 * scale
    );
  }
}
