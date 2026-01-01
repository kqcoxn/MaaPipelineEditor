import {
  memo,
  useCallback,
  useRef,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { create } from "zustand";

// 面板位置存储
interface PanelPositionState {
  // 字段/连接面板共享位置
  panelPosition: { x: number; y: number } | null;
  setPanelPosition: (pos: { x: number; y: number } | null) => void;
}

export const usePanelPositionStore = create<PanelPositionState>()((set) => ({
  panelPosition: null,
  setPanelPosition: (pos) => set({ panelPosition: pos }),
}));

interface DraggablePanelProps {
  children: ReactNode;
  panelType: "field" | "edge";
  isVisible: boolean;
  className?: string;
  defaultRight?: number;
  defaultTop?: number;
}

/**
 * 可拖动面板包装组件
 * 通过标题栏拖动，切换选中时保持位置
 */
export const DraggablePanel = memo(
  ({
    children,
    panelType,
    isVisible,
    className = "",
    defaultRight = 10,
    defaultTop = 70,
  }: DraggablePanelProps) => {
    const panelRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0 });
    const positionStartRef = useRef({ x: 0, y: 0 });

    // 从 store 获取位置（字段和连接面板共享）
    const position = usePanelPositionStore((s) => s.panelPosition);
    const setPosition = usePanelPositionStore((s) => s.setPanelPosition);

    // 计算默认位置（右上角）
    const getDefaultPosition = useCallback(() => {
      if (typeof window === "undefined") return { x: 0, y: defaultTop };
      const panel = panelRef.current;
      if (!panel) return { x: window.innerWidth - 400, y: defaultTop };
      const rect = panel.getBoundingClientRect();
      return {
        x: window.innerWidth - rect.width - defaultRight,
        y: defaultTop,
      };
    }, [defaultRight, defaultTop]);

    // 初始化位置
    useEffect(() => {
      if (isVisible && !position && panelRef.current) {
        // 延迟初始化以确保面板已渲染
        requestAnimationFrame(() => {
          setPosition(getDefaultPosition());
        });
      }
    }, [isVisible, position, setPosition, getDefaultPosition]);

    // 拖动开始
    const handleMouseDown = useCallback(
      (e: React.MouseEvent) => {
        // 只有点击 header 区域才能拖动
        const target = e.target as HTMLElement;
        const header = target.closest(".header");
        if (!header) return;

        // 不拦截按钮点击
        if (target.closest(".icon-interactive")) return;

        e.preventDefault();
        setIsDragging(true);
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        positionStartRef.current = position || getDefaultPosition();
      },
      [position, getDefaultPosition]
    );

    // 拖动中
    useEffect(() => {
      if (!isDragging) return;

      const handleMouseMove = (e: MouseEvent) => {
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;

        const newX = positionStartRef.current.x + dx;
        const newY = positionStartRef.current.y + dy;

        // 边界限制
        const panel = panelRef.current;
        if (panel) {
          const rect = panel.getBoundingClientRect();
          const maxX = window.innerWidth - rect.width;
          const maxY = window.innerHeight - rect.height;

          setPosition({
            x: Math.max(0, Math.min(newX, maxX)),
            y: Math.max(0, Math.min(newY, maxY)),
          });
        } else {
          setPosition({ x: newX, y: newY });
        }
      };

      const handleMouseUp = () => {
        setIsDragging(false);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }, [isDragging, setPosition]);

    // 位置样式
    const positionStyle: React.CSSProperties = position
      ? {
          left: position.x,
          top: position.y,
          right: "auto",
        }
      : {
          right: defaultRight,
          top: defaultTop,
        };

    return (
      <div
        ref={panelRef}
        className={`${className} ${isDragging ? "dragging" : ""}`}
        style={{
          ...positionStyle,
          cursor: isDragging ? "grabbing" : undefined,
        }}
        onMouseDown={handleMouseDown}
      >
        {children}
      </div>
    );
  }
);

DraggablePanel.displayName = "DraggablePanel";
