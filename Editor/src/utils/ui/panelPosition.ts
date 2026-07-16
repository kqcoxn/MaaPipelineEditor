/**
 * 面板位置计算工具函数
 * 用于处理面板的坐标转换、边界限制和嵌入位置计算
 */

import type { Viewport } from "@xyflow/react";

/**
 * 画布坐标转换为屏幕坐标
 * @param canvasX 画布X坐标
 * @param canvasY 画布Y坐标
 * @param viewport 视口状态
 * @returns 屏幕坐标 {x, y}
 */
export function canvasToScreen(
  canvasX: number,
  canvasY: number,
  viewport: Viewport
): { x: number; y: number } {
  return {
    x: canvasX * viewport.zoom + viewport.x,
    y: canvasY * viewport.zoom + viewport.y,
  };
}

/**
 * 屏幕坐标转换为画布坐标
 * @param screenX 屏幕X坐标
 * @param screenY 屏幕Y坐标
 * @param viewport 视口状态
 * @returns 画布坐标 {x, y}
 */
export function screenToCanvas(
  screenX: number,
  screenY: number,
  viewport: Viewport
): { x: number; y: number } {
  return {
    x: (screenX - viewport.x) / viewport.zoom,
    y: (screenY - viewport.y) / viewport.zoom,
  };
}

/**
 * 限制位置在视口范围内
 * @param x 目标X坐标
 * @param y 目标Y坐标
 * @param panelWidth 面板宽度
 * @param panelHeight 面板高度
 * @param viewportWidth 视口宽度
 * @param viewportHeight 视口高度
 * @param minVisibleWidth 最小可见宽度（默认80px）
 * @param minVisibleHeight 最小可见高度（默认40px）
 * @returns 修正后的坐标 {x, y}
 */
export function constrainPosition(
  x: number,
  y: number,
  panelWidth: number,
  panelHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  minVisibleWidth: number = 80,
  minVisibleHeight: number = 40
): { x: number; y: number } {
  // 上边界：不小于 0
  const minY = 0;
  // 左边界：不小于 -面板宽度 + 最小可见宽度
  const minX = -panelWidth + minVisibleWidth;
  // 右边界：不大于视口宽度 - 最小可见宽度
  const maxX = viewportWidth - minVisibleWidth;
  // 下边界：不大于视口高度 - 最小可见高度
  const maxY = viewportHeight - minVisibleHeight;

  return {
    x: Math.max(minX, Math.min(maxX, x)),
    y: Math.max(minY, Math.min(maxY, y)),
  };
}

/**
 * 计算嵌入跟随模式下的面板位置
 * @param targetX 目标元素X坐标（画布坐标）
 * @param targetY 目标元素Y坐标（画布坐标）
 * @param targetWidth 目标元素宽度
 * @param targetHeight 目标元素高度
 * @param panelWidth 面板宽度
 * @param panelHeight 面板高度
 * @param viewport 视口状态
 * @param spacing 间距（默认20px）
 * @returns 面板位置（相对于 .workspace 的坐标） {x, y}
 */
export function calculateEmbeddedPosition(
  targetX: number,
  targetY: number,
  targetWidth: number,
  targetHeight: number,
  panelWidth: number,
  panelHeight: number,
  viewport: Viewport,
  spacing: number = 20
): { x: number; y: number } {
  // 将目标元素坐标转换为屏幕坐标
  const targetScreenPos = canvasToScreen(targetX, targetY, viewport);

  // 计算目标元素在屏幕上的尺寸
  const scaledTargetWidth = targetWidth * viewport.zoom;
  const scaledTargetHeight = targetHeight * viewport.zoom;

  // 获取 .workspace 元素
  const workspace = document.querySelector(".workspace") as HTMLElement;
  if (!workspace) {
    console.warn("无法找到 .workspace 元素");
    return {
      x: targetScreenPos.x + scaledTargetWidth + spacing,
      y: targetScreenPos.y,
    };
  }

  // 获取 .workspace 相对于视口的偏移
  const workspaceRect = workspace.getBoundingClientRect();
  const workspaceOffsetX = workspaceRect.left;
  const workspaceOffsetY = workspaceRect.top;
  const workspaceWidth = workspaceRect.width;
  const workspaceHeight = workspaceRect.height;

  // 将屏幕坐标转换为相对于 .workspace 的坐标
  const relativeX = targetScreenPos.x - workspaceOffsetX;
  const relativeY = targetScreenPos.y - workspaceOffsetY;

  // 默认位置：目标右侧
  let x = relativeX + scaledTargetWidth + spacing;
  let y = relativeY;

  // 检查是否超出右侧边界
  if (x + panelWidth > workspaceWidth) {
    // 尝试显示在左侧
    x = relativeX - panelWidth - spacing;
    // 如果左侧也放不下，强制显示在右侧但调整到容器内
    if (x < 0) {
      x = workspaceWidth - panelWidth - 10; // 留10px边距
    }
  }

  // 检查是否超出下侧边界
  if (y + panelHeight > workspaceHeight) {
    // 向上调整
    y = workspaceHeight - panelHeight - 10; // 留10px边距
  }

  // 确保不超出上边界
  if (y < 0) {
    y = 10; // 留10px边距
  }

  return { x, y };
}

/**
 * 计算连接中点的嵌入位置
 * @param sourceX 起始节点X坐标（画布坐标）
 * @param sourceY 起始节点Y坐标（画布坐标）
 * @param targetX 目标节点X坐标（画布坐标）
 * @param targetY 目标节点Y坐标（画布坐标）
 * @param panelWidth 面板宽度
 * @param panelHeight 面板高度
 * @param viewport 视口状态
 * @param spacing 间距（默认20px）
 * @returns 面板位置（相对于 .workspace 的坐标） {x, y}
 */
export function calculateEdgeEmbeddedPosition(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  panelWidth: number,
  panelHeight: number,
  viewport: Viewport,
  spacing: number = 20
): { x: number; y: number } {
  // 计算连接中点（画布坐标）
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;

  // 将中点转换为屏幕坐标
  const midScreenPos = canvasToScreen(midX, midY, viewport);

  // 获取 .workspace 元素
  const workspace = document.querySelector(".workspace") as HTMLElement;
  if (!workspace) {
    console.warn("无法找到 .workspace 元素");
    return { x: midScreenPos.x + spacing, y: midScreenPos.y - panelHeight / 2 };
  }

  // 获取 .workspace 相对于视口的偏移
  const workspaceRect = workspace.getBoundingClientRect();
  const workspaceOffsetX = workspaceRect.left;
  const workspaceOffsetY = workspaceRect.top;
  const workspaceWidth = workspaceRect.width;
  const workspaceHeight = workspaceRect.height;

  // 将屏幕坐标转换为相对于 .workspace 的坐标
  const relativeX = midScreenPos.x - workspaceOffsetX;
  const relativeY = midScreenPos.y - workspaceOffsetY;

  // 默认位置：中点右侧
  let x = relativeX + spacing;
  let y = relativeY - panelHeight / 2; // 垂直居中

  // 检查是否超出右侧边界
  if (x + panelWidth > workspaceWidth) {
    // 尝试显示在左侧
    x = relativeX - panelWidth - spacing;
    // 如果左侧也放不下，强制显示在右侧但调整到容器内
    if (x < 0) {
      x = workspaceWidth - panelWidth - 10;
    }
  }

  // 检查是否超出下侧边界
  if (y + panelHeight > workspaceHeight) {
    y = workspaceHeight - panelHeight - 10;
  }

  // 确保不超出上边界
  if (y < 0) {
    y = 10;
  }

  return { x, y };
}

/**
 * 节流函数
 * @param func 要节流的函数
 * @param delay 延迟时间（毫秒）
 * @returns 节流后的函数
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: NodeJS.Timeout | null = null;

  return function (...args: Parameters<T>) {
    const now = Date.now();

    if (now - lastCall >= delay) {
      lastCall = now;
      func(...args);
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        func(...args);
      }, delay - (now - lastCall));
    }
  };
}
