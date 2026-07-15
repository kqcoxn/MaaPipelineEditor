import { memo, useState, useCallback, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Modal, Button, Space, Spin, Tooltip, message } from "antd";
import {
  ReloadOutlined,
  CheckOutlined,
  CloseOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  FullscreenOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { useMFWStore } from "../../stores/mfwStore";
import {
  useConfigStore,
  getScreenshotResolutionParams,
} from "../../stores/configStore";
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
  imageLoaded: boolean;
  imageElement: HTMLImageElement | null;
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

  // 额外按钮（渲染在确认按钮之前）
  extraButtons?: ReactNode;

  // 工具栏渲染
  renderToolbar?: (props: ViewportProps) => ReactNode;

  // Canvas 渲染
  renderCanvas: (props: CanvasRenderProps) => ReactNode;

  // Canvas 下方额外内容
  children?: ReactNode;

  // 截图变化回调
  onScreenshotChange?: (screenshot: string | null) => void;

  // 图片加载完成回调
  onImageLoaded?: (img: HTMLImageElement) => void;

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
    extraButtons,
    renderToolbar,
    renderCanvas,
    children,
    onScreenshotChange,
    onImageLoaded,
    onReset,
  }: ScreenshotModalBaseProps) => {
    const { connectionStatus, controllerId } = useMFWStore();
    const resolutionMode = useConfigStore(
      (state) => state.configs.screenshotResolutionMode,
    );
    const resolutionValue = useConfigStore(
      (state) => state.configs.screenshotResolutionValue,
    );
    const [screenshot, setScreenshot] = useState<string | null>(null);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const loadedImageRef = useRef<HTMLImageElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const requestAbortControllerRef = useRef<AbortController | null>(null);

    const isConnected = connectionStatus === "connected" && !!controllerId;

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

    // 存储回调
    const onScreenshotChangeRef = useRef(onScreenshotChange);
    const onImageLoadedRef = useRef(onImageLoaded);
    const onResetRef = useRef(onReset);
    useEffect(() => {
      onScreenshotChangeRef.current = onScreenshotChange;
      onImageLoadedRef.current = onImageLoaded;
      onResetRef.current = onReset;
    }, [onScreenshotChange, onImageLoaded, onReset]);

    // 请求截图
    const requestScreenshot = useCallback(async () => {
      if (connectionStatus !== "connected" || !controllerId) {
        return;
      }

      requestAbortControllerRef.current?.abort();
      const abortController = new AbortController();
      requestAbortControllerRef.current = abortController;
      setIsLoading(true);
      try {
        const result = await mfwProtocol.requestScreencap(
          {
            controller_id: controllerId,
            ...getScreenshotResolutionParams({
              screenshotResolutionMode: resolutionMode,
              screenshotResolutionValue: resolutionValue,
            }),
          },
          abortController.signal,
        );
        if (abortController.signal.aborted) return;

        if (result.success && result.image) {
          setScreenshot(result.image);
          setImageLoaded(false);
          onScreenshotChangeRef.current?.(result.image);
        } else {
          message.error(result.error || "截图失败");
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          message.error(error instanceof Error ? error.message : "截图失败");
        }
      } finally {
        if (requestAbortControllerRef.current === abortController) {
          requestAbortControllerRef.current = null;
          setIsLoading(false);
        }
      }
    }, [connectionStatus, controllerId, resolutionMode, resolutionValue]);

    // 上传本地图片作为底图
    const handleUploadClick = useCallback(() => {
      fileInputRef.current?.click();
    }, []);

    const handleFileChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        // 清空 input 值，确保同一文件可重复选择
        e.target.value = "";
        if (!file) return;

        if (!file.type.startsWith("image/")) {
          message.warning("请选择图片文件");
          return;
        }

        requestAbortControllerRef.current?.abort();
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          setScreenshot(dataUrl);
          setImageLoaded(false);
          onScreenshotChangeRef.current?.(dataUrl);
        };
        reader.onerror = () => {
          message.error("图片读取失败");
        };
        reader.readAsDataURL(file);
      },
      [],
    );

    // 每次打开时重新截图（已连接设备时自动截一张；未连接则等待上传）
    useEffect(() => {
      if (!open) return;

      // 清除旧截图
      setScreenshot(null);
      setImageLoaded(false);
      onScreenshotChangeRef.current?.(null);
      resetViewport();
      onResetRef.current?.();
      if (connectionStatus === "connected" && controllerId) {
        requestScreenshot();
      }
      return () => {
        requestAbortControllerRef.current?.abort();
      };
    }, [open, requestScreenshot, resetViewport, connectionStatus, controllerId]);

    // 加载图片
    useEffect(() => {
      if (!screenshot) {
        setImageLoaded(false);
        loadedImageRef.current = null;
        return;
      }

      const img = new Image();
      img.onload = () => {
        // 存储到 ref 并触发重渲染
        loadedImageRef.current = img;
        setImageLoaded(true);
        // 通知子组件图片
        onImageLoadedRef.current?.(img);
      };
      img.src = screenshot;
    }, [screenshot]);

    // 关闭时重置状态
    const handleClose = useCallback(() => {
      requestAbortControllerRef.current?.abort();
      requestAbortControllerRef.current = null;
      setScreenshot(null);
      setIsLoading(false);
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
          imageLoaded,
          imageElement: loadedImageRef.current,
        }
      : null;

    return (
      <Modal
        title={title}
        open={open}
        onCancel={handleClose}
        width={1300}
        footer={null}
        centered
        styles={{
          body: {
            maxHeight: "calc(100vh - 120px)",
            overflowY: "auto",
            padding: 16,
          },
        }}
      >
        <Spin spinning={isLoading} tip="截图中...">
          {/* 左右分栏布局 */}
          <div style={{ display: "flex", gap: 16, minHeight: 500 }}>
            {/* 截图显示区（左侧） */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              {/* 截图预览标题 */}
              <div
                style={{
                  marginBottom: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Space size={8} align="center">
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: "#262626",
                    }}
                  >
                    截图预览
                  </span>
                  <Button
                    icon={<UploadOutlined />}
                    onClick={handleUploadClick}
                    size="small"
                  >
                    上传图片
                  </Button>
                </Space>

                {/* 视图控制 */}
                {screenshot && (
                  <Space size={4}>
                    <Tooltip title="缩小 (滚轮向下)">
                      <Button
                        size="small"
                        icon={<ZoomOutOutlined />}
                        onClick={handleZoomOut}
                      />
                    </Tooltip>
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
                    <span
                      style={{
                        marginLeft: 4,
                        fontSize: 12,
                        color: "#8c8c8c",
                        minWidth: 42,
                        textAlign: "center",
                      }}
                    >
                      {Math.round(scale * 100)}%
                    </span>
                  </Space>
                )}
              </div>

              {/* 截图显示区 */}
              <div
                ref={containerRef}
                style={{
                  width: "100%",
                  paddingBottom: "56.25%",
                  backgroundColor: "#fafafa",
                  borderRadius: 8,
                  overflow: "hidden",
                  position: "relative",
                  border: "1px solid #e8e8e8",
                }}
              >
                {canvasRenderProps ? (
                  renderCanvas(canvasRenderProps)
                ) : (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 16,
                      textAlign: "center",
                    }}
                  >
                    <span style={{ color: "#999" }}>
                      {isConnected
                        ? "等待截图..."
                        : "未连接设备，请点击上方“上传图片”选择本地图片作为底图"}
                    </span>
                  </div>
                )}
              </div>

              {/* 提示 */}
              {screenshot && (
                <div style={{ marginTop: 8, textAlign: "center" }}>
                  <span style={{ color: "#8c8c8c", fontSize: 12 }}>
                    💡 滚轮缩放 | 按住空格或中键拖动
                  </span>
                </div>
              )}
            </div>

            {/* 参数配置区（右侧） */}
            <div
              style={{
                width: 340,
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* 调节参数标题 */}
              <div
                style={{
                  marginBottom: 12,
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#262626",
                }}
              >
                调节参数
              </div>

              {/* 自定义工具栏 */}
              {screenshot && renderToolbar && (
                <div style={{ marginBottom: 16 }}>
                  {renderToolbar(viewportProps)}
                </div>
              )}

              {/* 参数配置区域 */}
              <div style={{ flex: 1, overflowY: "auto" }}>{children}</div>

              {/* 分割线 */}
              <div
                style={{
                  marginTop: 16,
                  marginBottom: 12,
                  borderTop: "1px solid #f0f0f0",
                }}
              />

              {/* 操作按钮 */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <Space size="small">
                  <Tooltip title={isConnected ? "" : "未连接设备"}>
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={requestScreenshot}
                      disabled={isLoading || !isConnected}
                      size="small"
                    >
                      重新截图
                    </Button>
                  </Tooltip>
                  <Button
                    icon={<CloseOutlined />}
                    onClick={handleClose}
                    size="small"
                  >
                    取消
                  </Button>
                </Space>
                <Space size="small">
                  {extraButtons}
                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    onClick={onConfirm}
                    disabled={confirmDisabled}
                    size="small"
                  >
                    {confirmText}
                  </Button>
                </Space>
              </div>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
        </Spin>
      </Modal>
    );
  }
);
