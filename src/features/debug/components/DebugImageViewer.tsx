import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent,
} from "react";
import {
  Button,
  Modal,
  Space,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  AimOutlined,
  BorderOutlined,
  ColumnWidthOutlined,
  FullscreenOutlined,
  ReloadOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from "@ant-design/icons";
import type { DebugArtifactBox } from "../artifactDetailSummary";
import { DebugImageRoiPanel } from "./DebugImageRoiPanel";

const { Text } = Typography;

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;
const ZOOM_STEP = 1.2;
const MODAL_MAX_IMAGE_HEIGHT = "min(720px, calc(100vh - 260px))";

export interface DebugImageOverlay {
  id: string;
  groupKey?: string;
  kind: "box" | "point" | "path";
  box?: DebugArtifactBox;
  point?: DebugImagePoint;
  points?: DebugImagePoint[];
  label?: string;
  status?: "hit" | "miss" | "selected" | "candidate";
}

export interface DebugImagePoint {
  x: number;
  y: number;
}

export interface DebugImageViewerMetadata {
  artifactId?: string;
  artifactType?: string;
  mime?: string;
  eventSeq?: number;
  naturalWidth?: number;
  naturalHeight?: number;
}

export interface DebugImageViewerProps {
  alt: string;
  src: string;
  maxImageHeight?: number;
  metadata?: DebugImageViewerMetadata;
  overlays?: DebugImageOverlay[];
  overlayGroups?: DebugImageOverlayGroup[];
}

export interface DebugImageOverlayGroup {
  key: string;
  label: string;
}

export function DebugImageViewer({
  alt,
  maxImageHeight = 360,
  metadata,
  overlayGroups = [],
  overlays = [],
  src,
}: DebugImageViewerProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [naturalSize, setNaturalSize] = useState<{
    width: number;
    height: number;
  }>();
  const [visibleOverlayIds, setVisibleOverlayIds] = useState<Set<string>>(
    () => defaultVisibleOverlayIds(overlays, overlayGroups),
  );
  const [focusedOverlayId, setFocusedOverlayId] = useState<string>();
  const [hoveredOverlayId, setHoveredOverlayId] = useState<string>();
  const [overlaySearchText, setOverlaySearchText] = useState("");

  useEffect(() => {
    setVisibleOverlayIds(defaultVisibleOverlayIds(overlays, overlayGroups));
    setFocusedOverlayId(undefined);
    setHoveredOverlayId(undefined);
  }, [overlayGroups, overlays, src]);

  const visibleOverlays = overlays.filter((overlay) =>
    visibleOverlayIds.has(overlay.id),
  );

  return (
    <>
      <button
        type="button"
        aria-label="打开图片预览"
        style={thumbnailButtonStyle}
        onClick={() => setModalOpen(true)}
      >
        <span style={thumbnailImageWrapStyle}>
          <img
            alt={alt}
            draggable={false}
            src={src}
            style={{
              display: "block",
              maxHeight: maxImageHeight,
              maxWidth: "100%",
              objectFit: "contain",
            }}
            onLoad={(event) => {
              setNaturalSize({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              });
            }}
          />
        </span>
        <span style={thumbnailMetaStyle}>
          <Tag icon={<FullscreenOutlined />}>点击预览</Tag>
          {naturalSize && (
            <Tag icon={<BorderOutlined />}>
              {naturalSize.width} x {naturalSize.height}
            </Tag>
          )}
          {overlays.length > 0 && <Tag>ROI {overlays.length}</Tag>}
        </span>
      </button>
      <Modal
        destroyOnClose
        footer={null}
        open={modalOpen}
        styles={{
          body: imageModalBodyStyle,
        }}
        style={imageModalStyle}
        title={metadata?.artifactId ?? alt}
        width="min(1320px, calc(100vw - 48px))"
        onCancel={() => setModalOpen(false)}
      >
        <div style={modalLayoutStyle}>
          <DebugImageRoiPanel
            focusedOverlayId={focusedOverlayId}
            hoveredOverlayId={hoveredOverlayId}
            overlays={overlays}
            overlayGroups={overlayGroups}
            searchText={overlaySearchText}
            visibleOverlayIds={visibleOverlayIds}
            onFocus={setFocusedOverlayId}
            onHover={setHoveredOverlayId}
            onSearchChange={setOverlaySearchText}
            onVisibleChange={setVisibleOverlayIds}
          />
          <Space direction="vertical" size={8} style={{ minWidth: 0, width: "100%" }}>
            <ImageCanvas
              alt={alt}
              focusedOverlayId={focusedOverlayId}
              hoveredOverlayId={hoveredOverlayId}
              maxImageHeight={MODAL_MAX_IMAGE_HEIGHT}
              metadata={metadata}
              overlays={visibleOverlays}
              src={src}
              onNaturalSizeChange={setNaturalSize}
              onOverlayFocus={setFocusedOverlayId}
              onOverlayHover={setHoveredOverlayId}
            />
            <ImageMetadata metadata={{ ...metadata, ...naturalSize }} />
          </Space>
        </div>
      </Modal>
    </>
  );
}

function ImageCanvas({
  alt,
  focusedOverlayId,
  hoveredOverlayId,
  maxImageHeight,
  metadata,
  onNaturalSizeChange,
  onOverlayFocus,
  onOverlayHover,
  overlays,
  src,
}: {
  alt: string;
  focusedOverlayId?: string;
  hoveredOverlayId?: string;
  maxImageHeight: number | string;
  metadata?: DebugImageViewerMetadata;
  onNaturalSizeChange: (size: { width: number; height: number }) => void;
  onOverlayFocus: (overlayId?: string) => void;
  onOverlayHover: (overlayId?: string) => void;
  overlays: DebugImageOverlay[];
  src: string;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | undefined>(undefined);
  const [naturalSize, setNaturalSize] = useState<{
    width: number;
    height: number;
  }>();
  const [fitToViewport, setFitToViewport] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const canPan = zoom > 1;
  const displayedMetadata = useMemo(
    () => ({
      ...metadata,
      naturalWidth: naturalSize?.width ?? metadata?.naturalWidth,
      naturalHeight: naturalSize?.height ?? metadata?.naturalHeight,
    }),
    [metadata, naturalSize],
  );

  useEffect(() => {
    setFitToViewport(true);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [src]);

  const updateZoom = (nextZoom: number, anchor?: { x: number; y: number }) => {
    const clampedZoom = clampZoom(nextZoom);
    if (!anchor || !viewportRef.current || zoom <= 0) {
      if (clampedZoom <= 1) setPan({ x: 0, y: 0 });
      setZoom(clampedZoom);
      return;
    }

    const rect = viewportRef.current.getBoundingClientRect();
    const localX = anchor.x - rect.left - rect.width / 2;
    const localY = anchor.y - rect.top - rect.height / 2;
    const ratio = clampedZoom / zoom;
    setPan((currentPan) =>
      clampedZoom <= 1
        ? { x: 0, y: 0 }
        : {
            x: localX - (localX - currentPan.x) * ratio,
            y: localY - (localY - currentPan.y) * ratio,
          },
    );
    setZoom(clampedZoom);
  };

  const reset = () => {
    setFitToViewport(true);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const showActualSize = () => {
    setFitToViewport(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const direction = event.deltaY > 0 ? 1 / ZOOM_STEP : ZOOM_STEP;
    updateZoom(zoom * direction, {
      x: event.clientX,
      y: event.clientY,
    });
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!canPan) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: pan.x,
      originY: pan.y,
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setPan({
      x: drag.originX + event.clientX - drag.startX,
      y: drag.originY + event.clientY - drag.startY,
    });
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = undefined;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <Space direction="vertical" size={8} style={{ width: "100%" }}>
      <Space wrap size={6}>
        <Tooltip title="放大">
          <Button
            aria-label="放大图片"
            icon={<ZoomInOutlined />}
            size="small"
            onClick={() => updateZoom(zoom * ZOOM_STEP)}
          />
        </Tooltip>
        <Tooltip title="缩小">
          <Button
            aria-label="缩小图片"
            icon={<ZoomOutOutlined />}
            size="small"
            onClick={() => updateZoom(zoom / ZOOM_STEP)}
          />
        </Tooltip>
        <Tooltip title="适配">
          <Button
            aria-label="适配窗口"
            icon={<ColumnWidthOutlined />}
            size="small"
            onClick={reset}
          />
        </Tooltip>
        <Tooltip title="原始尺寸">
          <Button
            aria-label="原始尺寸"
            icon={<AimOutlined />}
            size="small"
            onClick={showActualSize}
          />
        </Tooltip>
        <Tooltip title="重置">
          <Button
            aria-label="重置图片视图"
            icon={<ReloadOutlined />}
            size="small"
            onClick={reset}
          />
        </Tooltip>
        <Tag>{Math.round(zoom * 100)}%</Tag>
        {displayedMetadata.naturalWidth && displayedMetadata.naturalHeight && (
          <Tag icon={<BorderOutlined />}>
            {displayedMetadata.naturalWidth} x {displayedMetadata.naturalHeight}
          </Tag>
        )}
      </Space>
      <div
        ref={viewportRef}
        role="img"
        aria-label={alt}
        style={{
          alignItems: "center",
          background: "#141414",
          border: "1px solid #d9d9d9",
          borderRadius: 6,
          cursor: canPan ? "grab" : "default",
          display: "flex",
          justifyContent: "center",
          maxHeight: maxImageHeight,
          minHeight: "min(360px, calc(100vh - 320px))",
          overflow: "hidden",
          position: "relative",
          touchAction: "none",
          width: "100%",
        }}
        onPointerCancel={handlePointerUp}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      >
        <div
          style={{
            display: "inline-block",
            position: "relative",
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
          }}
        >
          <img
            alt={alt}
            draggable={false}
            src={src}
            style={{
              display: "block",
              maxHeight: fitToViewport ? maxImageHeight : undefined,
              maxWidth: fitToViewport ? "100%" : undefined,
              userSelect: "none",
            }}
            onLoad={(event) => {
              const size = {
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              };
              setNaturalSize(size);
              onNaturalSizeChange(size);
            }}
          />
          {naturalSize &&
            overlays.map((overlay, index) => (
              <ImageOverlay
                key={overlay.id}
                dimmed={Boolean(
                  (hoveredOverlayId || focusedOverlayId) &&
                    overlay.id !== hoveredOverlayId &&
                    overlay.id !== focusedOverlayId,
                )}
                focused={
                  overlay.id === hoveredOverlayId ||
                  overlay.id === focusedOverlayId
                }
                index={index}
                naturalHeight={naturalSize.height}
                naturalWidth={naturalSize.width}
                overlay={overlay}
                onFocus={onOverlayFocus}
                onHover={onOverlayHover}
              />
            ))}
        </div>
      </div>
    </Space>
  );
}

function ImageOverlay({
  dimmed,
  focused,
  index,
  naturalHeight,
  naturalWidth,
  onFocus,
  onHover,
  overlay,
}: {
  dimmed: boolean;
  focused: boolean;
  index: number;
  naturalHeight: number;
  naturalWidth: number;
  onFocus: (overlayId?: string) => void;
  onHover: (overlayId?: string) => void;
  overlay: DebugImageOverlay;
}) {
  const color = overlayColor(overlay.status, index);
  const opacity = dimmed ? 0.34 : 1;
  const commonHandlers = {
    onClick: () => onFocus(overlay.id),
    onMouseEnter: () => onHover(overlay.id),
    onMouseLeave: () => onHover(undefined),
  };

  if (overlay.kind === "point") {
    if (!overlay.point) return null;
    const pointStyle = normalizePointStyle(
      overlay.point,
      naturalWidth,
      naturalHeight,
    );
    if (!pointStyle) return null;
    return (
      <span
        aria-hidden
        {...commonHandlers}
        style={{
          ...pointStyle,
          background: color,
          border: "2px solid #fff",
          borderRadius: "50%",
          boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.42)",
          boxSizing: "border-box",
          cursor: "pointer",
          height: focused ? 16 : 12,
          opacity,
          pointerEvents: "auto",
          position: "absolute",
          transform: "translate(-50%, -50%)",
          width: focused ? 16 : 12,
        }}
      >
        {(overlay.label || focused) && (
          <OverlayLabel color={color} label={overlay.label ?? `ROI ${index + 1}`} />
        )}
      </span>
    );
  }

  if (overlay.kind === "path") {
    if (!overlay.points || overlay.points.length === 0) return null;
    return (
      <>
        {overlay.points.map((point, pointIndex) => {
          const pointStyle = normalizePointStyle(
            point,
            naturalWidth,
            naturalHeight,
          );
          if (!pointStyle) return null;
          const endpoint =
            pointIndex === 0 || pointIndex === overlay.points!.length - 1;
          return (
            <span
              key={`${overlay.id}:${pointIndex}`}
              aria-hidden
              {...commonHandlers}
              style={{
                ...pointStyle,
                background: color,
                border: "2px solid #fff",
                borderRadius: "50%",
                boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.42)",
                boxSizing: "border-box",
                cursor: "pointer",
                height: endpoint || focused ? 14 : 8,
                opacity: endpoint ? opacity : opacity * 0.72,
                pointerEvents: "auto",
                position: "absolute",
                transform: "translate(-50%, -50%)",
                width: endpoint || focused ? 14 : 8,
              }}
            >
              {pointIndex === 0 && (overlay.label || focused) && (
                <OverlayLabel
                  color={color}
                  label={overlay.label ?? `ROI ${index + 1}`}
                />
              )}
            </span>
          );
        })}
      </>
    );
  }

  if (!overlay.box) return null;
  const style = normalizeBoxStyle(overlay.box, naturalWidth, naturalHeight);
  if (!style) return null;

  return (
    <span
      aria-hidden
      {...commonHandlers}
      style={{
        ...style,
        background: focused ? `${color}26` : `${color}14`,
        border: `${focused ? 3 : 2}px solid ${color}`,
        boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.42)",
        boxSizing: "border-box",
        cursor: "pointer",
        opacity,
        pointerEvents: "auto",
        position: "absolute",
      }}
    >
      {(overlay.label || focused) && (
        <OverlayLabel color={color} label={overlay.label ?? `ROI ${index + 1}`} />
      )}
    </span>
  );
}

function OverlayLabel({ color, label }: { color: string; label: string }) {
  return (
    <span
      style={{
        background: color,
        color: "#fff",
        fontSize: 11,
        left: 0,
        lineHeight: "16px",
        maxWidth: 180,
        overflow: "hidden",
        padding: "0 4px",
        position: "absolute",
        textOverflow: "ellipsis",
        top: -18,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function ImageMetadata({
  metadata,
}: {
  metadata?: DebugImageViewerMetadata;
}) {
  if (!metadata) return null;
  return (
    <Space wrap size={6}>
      {metadata.artifactId && (
        <Text code style={{ fontSize: 12 }}>
          {metadata.artifactId}
        </Text>
      )}
      {metadata.artifactType && <Tag>{metadata.artifactType}</Tag>}
      {metadata.mime && <Tag>{metadata.mime}</Tag>}
      {metadata.eventSeq !== undefined && <Tag>seq {metadata.eventSeq}</Tag>}
      {metadata.naturalWidth && metadata.naturalHeight && (
        <Tag>
          {metadata.naturalWidth} x {metadata.naturalHeight}
        </Tag>
      )}
    </Space>
  );
}

function normalizeBoxStyle(
  box: DebugArtifactBox,
  naturalWidth: number,
  naturalHeight: number,
): CSSProperties | undefined {
  if (naturalWidth <= 0 || naturalHeight <= 0) return undefined;
  const left = clampPercent((box.x / naturalWidth) * 100);
  const top = clampPercent((box.y / naturalHeight) * 100);
  const right = clampPercent(((box.x + box.width) / naturalWidth) * 100);
  const bottom = clampPercent(((box.y + box.height) / naturalHeight) * 100);
  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);
  if (width <= 0 || height <= 0) return undefined;
  return {
    height: `${height}%`,
    left: `${left}%`,
    top: `${top}%`,
    width: `${width}%`,
  };
}

function normalizePointStyle(
  point: DebugImagePoint,
  naturalWidth: number,
  naturalHeight: number,
): CSSProperties | undefined {
  if (naturalWidth <= 0 || naturalHeight <= 0) return undefined;
  return {
    left: `${clampPercent((point.x / naturalWidth) * 100)}%`,
    top: `${clampPercent((point.y / naturalHeight) * 100)}%`,
  };
}

function overlayColor(
  status: DebugImageOverlay["status"],
  index = 0,
): string {
  if (status === "miss") return "#ff4d4f";
  if (status === "selected") return "#1677ff";
  if (status === "candidate") return palette[index % palette.length] ?? "#faad14";
  return palette[index % palette.length] ?? "#13c2c2";
}

function clampZoom(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function defaultVisibleOverlayIds(
  overlays: DebugImageOverlay[],
  groups: DebugImageOverlayGroup[],
): Set<string> {
  const preferredGroup =
    groups.find((group) => group.key === "filtered") ??
    groups.find((group) => group.key === "best");
  const filtered = preferredGroup
    ? overlays.filter((overlay) => overlay.groupKey === preferredGroup.key)
    : overlays;
  return new Set(filtered.map((overlay) => overlay.id));
}

const palette = [
  "#22c55e",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
];

const thumbnailButtonStyle: CSSProperties = {
  alignItems: "center",
  background: "transparent",
  border: 0,
  cursor: "zoom-in",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  maxWidth: "100%",
  padding: 0,
  textAlign: "left",
  width: "100%",
};

const thumbnailImageWrapStyle: CSSProperties = {
  alignItems: "center",
  background: "#141414",
  border: "1px solid #d9d9d9",
  borderRadius: 6,
  display: "flex",
  justifyContent: "center",
  minHeight: 120,
  overflow: "hidden",
  width: "100%",
};

const thumbnailMetaStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 4,
  width: "100%",
};

const imageModalStyle: CSSProperties = {
  maxWidth: "calc(100vw - 48px)",
  top: 24,
};

const imageModalBodyStyle: CSSProperties = {
  maxHeight: "calc(100vh - 120px)",
  overflow: "hidden",
};

const modalLayoutStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "280px minmax(0, 1fr)",
  maxHeight: "calc(100vh - 120px)",
  overflow: "hidden",
};
