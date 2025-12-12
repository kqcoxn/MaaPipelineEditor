import { memo, useState, useCallback, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Modal, Button, Space, Spin, Tooltip } from "antd";
import {
  ReloadOutlined,
  CheckOutlined,
  CloseOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  FullscreenOutlined,
} from "@ant-design/icons";
import { useMFWStore } from "../../stores/mfwStore";
import { mfwProtocol } from "../../services/server";
import { useCanvasViewport } from "../../hooks/useCanvasViewport";

// 视口控制 Props
export interface ViewportProps {
  scale: number;
  panOffset: { x: number; y: number };
  isPanning: boolean;
  isSpacePressed: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
  imageRef: React.RefObject<HTMLImageElement | null>;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleZoomReset: () => void;
  startPan: (
    clientX: number,
    clientY: number,
    isMiddleButton?: boolean
  ) => void;
  updatePan: (clientX: number, clientY: number) => void;
  endPan: () => void;
  initializeImage: (img: HTMLImageElement) => void;
  getBaseCursorStyle: () => "grab" | "grabbing" | undefined;
}

// Canvas 渲染 Props
export interface CanvasRenderProps extends ViewportProps {
  screenshot: string;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

// 基础组件 Props
interface ScreenshotModalBaseProps {
  // 基础属性
  open: boolean;
  onClose: () => void;
  title: string;
  width?: number;

  // 确认按钮
  confirmText?: string;
  confirmDisabled?: boolean;
  onConfirm: () => void;

  // 工具栏渲染
  renderToolbar?: (props: ViewportProps) => ReactNode;

  // Canvas 渲染
  renderCanvas: (props: CanvasRenderProps) => ReactNode;

  // Canvas 下方额外内容
  children?: ReactNode;

  // 截图变化回调
  onScreenshotChange?: (screenshot: string | null) => void;

  // 关闭时的额外重置逻辑
  onReset?: () => void;
}

export const ScreenshotModalBase = memo(
  ({
    open,
    onClose,
    title,
    width = 900,
    confirmText = "确定",
    confirmDisabled = false,
    onConfirm,
    renderToolbar,
    renderCanvas,
    children,
    onScreenshotChange,
    onReset,
  }: ScreenshotModalBaseProps) => {
    const { connectionStatus, controllerId } = useMFWStore();
    const [screenshot, setScreenshot] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const canvasRef = useRef<HTMLCanvasElement>(null);

    // 使用视口控制 Hook
    const viewportProps = useCanvasViewport({ open, screenshot });
    const {
      scale,
      panOffset,
      containerRef,
      resetViewport,
      handleZoomIn,
      handleZoomOut,
      handleZoomReset,
    } = viewportProps;

    // 请求截图
    const requestScreenshot = useCallback(() => {
      if (connectionStatus !== "connected" || !controllerId) {
        return;
      }

      setIsLoading(true);
      mfwProtocol.requestScreencap({ controller_id: controllerId });
    }, [connectionStatus, controllerId]);

    // 每次打开时重新截图
    useEffect(() => {
      if (!open) return;

      // 清除旧截图并请求新截图
      setScreenshot(null);
      onScreenshotChange?.(null);
      resetViewport();
      onReset?.();
      requestScreenshot();
    }, [open]);

    // 监听截图结果
    useEffect(() => {
      if (!open) return;

      const handleScreencap = (data: {
        success: boolean;
        image?: string;
        error?: string;
      }) => {
        setIsLoading(false);
        if (data.success && data.image) {
          setScreenshot(data.image);
          onScreenshotChange?.(data.image);
        }
      };

      const unregister = mfwProtocol.onScreencapResult(handleScreencap);

      return () => {
        unregister();
      };
    }, [open, onScreenshotChange]);

    // 关闭时重置状态
    const handleClose = useCallback(() => {
      setScreenshot(null);
      resetViewport();
      onReset?.();
      onClose();
    }, [onClose, resetViewport, onReset]);

    // Canvas 渲染 Props
    const canvasRenderProps: CanvasRenderProps | null = screenshot
      ? {
          ...viewportProps,
          screenshot,
          canvasRef,
        }
      : null;

    return (
      <Modal
        title={title}
        open={open}
        onCancel={handleClose}
        width={width}
        footer={null}
        styles={{
          body: { maxHeight: "calc(100vh - 200px)", overflowY: "auto" },
        }}
      >
        <Spin spinning={isLoading} tip="截图中...">
          {/* 工具栏与缩放控制栏 */}
          {screenshot && (
            <div
              style={{
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              {/* 自定义工具栏 */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {renderToolbar?.(viewportProps)}
              </div>

              {/* 缩放控制 */}
              <Space>
                <Tooltip title="缩小 (滚轮向下)">
                  <Button
                    size="small"
                    icon={<ZoomOutOutlined />}
                    onClick={handleZoomOut}
                  />
                </Tooltip>
                <span style={{ minWidth: 50, textAlign: "center" }}>
                  {Math.round(scale * 100)}%
                </span>
                <Tooltip title="放大 (滚轮向上)">
                  <Button
                    size="small"
                    icon={<ZoomInOutlined />}
                    onClick={handleZoomIn}
                  />
                </Tooltip>
                <Tooltip title="适应窗口">
                  <Button
                    size="small"
                    icon={<FullscreenOutlined />}
                    onClick={handleZoomReset}
                  />
                </Tooltip>
              </Space>
            </div>
          )}

          {/* 截图显示区 */}
          <div
            ref={containerRef}
            style={{
              marginBottom: 16,
              backgroundColor: "#f0f0f0",
              borderRadius: 4,
              height: 450,
              overflow: "hidden",
              position: "relative",
            }}
          >
            {canvasRenderProps ? (
              renderCanvas(canvasRenderProps)
            ) : (
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ color: "#666" }}>等待截图...</span>
              </div>
            )}
          </div>

          {/* 提示 */}
          {screenshot && (
            <div style={{ marginBottom: 8, textAlign: "right" }}>
              <span style={{ color: "#999", fontSize: 12 }}>
                提示：滚轮缩放 | 按住空格或中键拖动
              </span>
            </div>
          )}

          {/* 子内容区（ROI坐标、OCR结果等） */}
          {children}

          {/* 操作按钮 */}
          <Space style={{ width: "100%", justifyContent: "flex-end" }}>
            <Button
              icon={<ReloadOutlined />}
              onClick={requestScreenshot}
              disabled={isLoading}
            >
              重新截图
            </Button>
            <Button icon={<CloseOutlined />} onClick={handleClose}>
              取消
            </Button>
            <Button
              type="primary"
              icon={<CheckOutlined />}
              onClick={onConfirm}
              disabled={confirmDisabled}
            >
              {confirmText}
            </Button>
          </Space>
        </Spin>
      </Modal>
    );
  }
);
