import { useState, useCallback, useEffect, useRef } from "react";
import type { RefObject } from "react";

// 缩放限制
const MIN_SCALE = 0.1;
const MAX_SCALE = 5;
const ZOOM_STEP = 0.1;

interface ViewportState {
  scale: number;
  panOffset: { x: number; y: number };
  isPanning: boolean;
  isSpacePressed: boolean;
  isMiddleMouseDown: boolean;
}

interface UseCanvasViewportOptions {
  /** Modal 是否打开 */
  open: boolean;
  /** 截图数据 */
  screenshot: string | null;
  /** 容器内边距，用于计算初始缩放（默认 32） */
  containerPadding?: number;
}

interface UseCanvasViewportReturn {
  // 状态
  scale: number;
  panOffset: { x: number; y: number };
  isPanning: boolean;
  isSpacePressed: boolean;
  isMiddleMouseDown: boolean;
  initialScale: number;

  // Refs
  containerRef: RefObject<HTMLDivElement>;
  imageRef: RefObject<HTMLImageElement | null>;

  // 缩放控制
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleZoomReset: () => void;
  setScale: React.Dispatch<React.SetStateAction<number>>;
  setPanOffset: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;

  // 拖动处理
  startPan: (
    clientX: number,
    clientY: number,
    isMiddleButton?: boolean
  ) => void;
  updatePan: (clientX: number, clientY: number) => void;
  endPan: () => void;

  // 初始化图片
  initializeImage: (img: HTMLImageElement) => void;

  // 重置状态
  resetViewport: () => void;

  // 光标样式辅助
  getBaseCursorStyle: () => "grab" | "grabbing" | undefined;
}

/**
 * Canvas 视口控制 Hook
 * 封装缩放、拖动、空格键监听等视口控制逻辑
 */
export function useCanvasViewport({
  open,
  screenshot,
  containerPadding = 32,
}: UseCanvasViewportOptions): UseCanvasViewportReturn {
  // 缩放状态
  const [scale, setScale] = useState(1);
  const [initialScale, setInitialScale] = useState(1);

  // 平移状态
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isMiddleMouseDown, setIsMiddleMouseDown] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(
    null
  );

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // 监听空格键
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        setIsSpacePressed(false);
        // 只有在非中键拖动时才结束拖动
        if (!isMiddleMouseDown) {
          setIsPanning(false);
          setPanStart(null);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [open]);

  // 滚轮缩放
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !screenshot) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!imageRef.current) return;

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // 计算鼠标相对于图片的位置
      const imgX = (mouseX - panOffset.x) / scale;
      const imgY = (mouseY - panOffset.y) / scale;

      // 计算新缩放
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale + delta));

      // 以鼠标位置为中心缩放
      const newPanX = mouseX - imgX * newScale;
      const newPanY = mouseY - imgY * newScale;

      setScale(newScale);
      setPanOffset({ x: newPanX, y: newPanY });
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [screenshot, scale, panOffset]);

  // 缩放控制按钮
  const handleZoomIn = useCallback(() => {
    setScale((s) => Math.min(MAX_SCALE, s + ZOOM_STEP));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((s) => Math.max(MIN_SCALE, s - ZOOM_STEP));
  }, []);

  const handleZoomReset = useCallback(() => {
    if (!containerRef.current || !imageRef.current) return;
    const container = containerRef.current;
    const img = imageRef.current;

    const containerWidth = container.clientWidth - containerPadding;
    const containerHeight = container.clientHeight - containerPadding;
    const scaleX = containerWidth / img.width;
    const scaleY = containerHeight / img.height;
    const fitScale = Math.min(scaleX, scaleY, 1);

    setScale(fitScale);
    const scaledWidth = img.width * fitScale;
    const scaledHeight = img.height * fitScale;
    setPanOffset({
      x: (containerWidth - scaledWidth) / 2,
      y: (containerHeight - scaledHeight) / 2,
    });
  }, [containerPadding]);

  // 初始化图片
  const initializeImage = useCallback(
    (img: HTMLImageElement) => {
      if (!containerRef.current) return;

      imageRef.current = img;
      const container = containerRef.current;

      const containerWidth = container.clientWidth - containerPadding;
      const containerHeight = container.clientHeight - containerPadding;
      const scaleX = containerWidth / img.width;
      const scaleY = containerHeight / img.height;
      const fitScale = Math.min(scaleX, scaleY, 1);

      setScale(fitScale);
      setInitialScale(fitScale);

      // 居中显示
      const scaledWidth = img.width * fitScale;
      const scaledHeight = img.height * fitScale;
      setPanOffset({
        x: (containerWidth - scaledWidth) / 2,
        y: (containerHeight - scaledHeight) / 2,
      });
    },
    [containerPadding]
  );

  // 开始拖动
  const startPan = useCallback(
    (clientX: number, clientY: number, isMiddleButton: boolean = false) => {
      setIsPanning(true);
      if (isMiddleButton) {
        setIsMiddleMouseDown(true);
      }
      setPanStart({
        x: clientX - panOffset.x,
        y: clientY - panOffset.y,
      });
    },
    [panOffset]
  );

  // 更新拖动
  const updatePan = useCallback(
    (clientX: number, clientY: number) => {
      if (!isPanning || !panStart) return;
      setPanOffset({
        x: clientX - panStart.x,
        y: clientY - panStart.y,
      });
    },
    [isPanning, panStart]
  );

  // 结束拖动
  const endPan = useCallback(() => {
    setIsPanning(false);
    setIsMiddleMouseDown(false);
    setPanStart(null);
  }, []);

  // 重置视口状态
  const resetViewport = useCallback(() => {
    setScale(1);
    setPanOffset({ x: 0, y: 0 });
    setIsPanning(false);
    setIsSpacePressed(false);
    setIsMiddleMouseDown(false);
    setPanStart(null);
    imageRef.current = null;
  }, []);

  // 获取基础光标样式
  const getBaseCursorStyle = useCallback(():
    | "grab"
    | "grabbing"
    | undefined => {
    if (isPanning) return "grabbing";
    if (isSpacePressed || isMiddleMouseDown) return "grab";
    return undefined;
  }, [isSpacePressed, isPanning, isMiddleMouseDown]);

  return {
    // 状态
    scale,
    panOffset,
    isPanning,
    isSpacePressed,
    isMiddleMouseDown,
    initialScale,

    // Refs
    containerRef: containerRef as RefObject<HTMLDivElement>,
    imageRef,

    // 缩放控制
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    setScale,
    setPanOffset,

    // 拖动处理
    startPan,
    updatePan,
    endPan,

    // 初始化
    initializeImage,

    // 重置
    resetViewport,

    // 光标
    getBaseCursorStyle,
  };
}
