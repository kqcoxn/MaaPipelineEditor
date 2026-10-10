import { useEffect, useRef, useState } from "react";
import { Button, theme } from "antd";
import { useCanvasViewport } from "@/hooks/useCanvasViewport";
import { resolveNegativeROI } from "@/utils/data/roiNegativeCoord";
import { useRecorderStore } from "./store";
import { imagePoint } from "./geometry";
import type { Rect, RecorderFrame } from "./types";
import styles from "./Recorder.module.less";

export function RecorderCanvas({
  onClick,
}: {
  onClick?: (
    frame: RecorderFrame,
    image: HTMLImageElement,
    x: number,
    y: number,
  ) => void;
}) {
  const open = useRecorderStore((s) => s.open);
  const current = useRecorderStore((s) => s.current);
  const detailsOpen = useRecorderStore((s) => s.detailsOpen);
  const liveFrame = useRecorderStore((s) => s.liveFrame);
  const [heldFrame, setHeldFrame] = useState<RecorderFrame>();
  const busy = useRecorderStore((s) => s.busy);
  const { token } = theme.useToken();
  const [lastClick, setLastClick] = useState<{ x: number; y: number }>();
  const start = useRef<{ x: number; y: number } | null>(null);
  const { config } = current;
  const frame = heldFrame ?? (detailsOpen ? current.frame : liveFrame);
  const operating = !detailsOpen;
  const viewport = useCanvasViewport({
    open,
    screenshot: frame?.image ?? null,
  });
  const { containerRef, imageRef, initializeImage } = viewport;
  const fittedSize = useRef("");
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      if (
        imageRef.current?.complete &&
        container.clientWidth > 32 &&
        container.clientHeight > 32
      )
        initializeImage(imageRef.current);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef, imageRef, initializeImage]);
  const toPoint = (event: React.PointerEvent<SVGSVGElement>) =>
    imagePoint(
      event.clientX,
      event.clientY,
      event.currentTarget.getBoundingClientRect(),
      frame!.width,
      frame!.height,
    );
  const cancel = () => {
    start.current = null;
    setHeldFrame(undefined);
    viewport.endPan();
  };
  const rect = (r: Rect, color: string, label: string) => (
    <g>
      <rect
        x={r[0]}
        y={r[1]}
        width={r[2]}
        height={r[3]}
        fill="none"
        stroke={color}
        strokeWidth={2 / viewport.scale}
      />
      <text
        x={r[0]}
        y={Math.max(16 / viewport.scale, r[1] - 4 / viewport.scale)}
        fill={color}
        fontSize={12 / viewport.scale}
      >
        {label}
      </text>
    </g>
  );
  const roi = frame
    ? resolveNegativeROI(config.roi, frame.width, frame.height).actual
    : null;
  return (
    <section className={styles.picture} aria-label="设备画面">
      <div className={styles.pictureTools}>
        <h3>{operating ? "设备画面" : "步骤截图"}</h3>
        <span className={styles.hint}>{operating ? "点击操作设备" : "只读回看 · 不操作设备"}</span>
        <span className={styles.grow} />
        <div className={styles.zoomControls}>
          <Button type="text" onClick={viewport.handleZoomOut} aria-label="缩小画面">
            −
          </Button>
          <Button type="text" onClick={viewport.handleZoomReset} aria-label="适应画面">
            {Math.round(viewport.scale * 100)}%
          </Button>
          <Button type="text" onClick={viewport.handleZoomIn} aria-label="放大画面">
            +
          </Button>
        </div>
      </div>
      <div ref={viewport.containerRef} className={styles.viewport}>
        {!frame ? (
          <div className={styles.empty}>
            连接设备后自动显示画面
            <br />
            {operating
              ? "画面加载后即可直接点击设备"
              : "该步骤没有可用截图"}
          </div>
        ) : (
          <div
            style={{
              position: "absolute",
              width: frame.width,
              height: frame.height,
              transformOrigin: "0 0",
              transform: `translate(${viewport.panOffset.x}px, ${viewport.panOffset.y}px) scale(${viewport.scale})`,
            }}
          >
            <img
              src={frame.image}
              alt="当前步骤底图"
              draggable={false}
              width={frame.width}
              height={frame.height}
              ref={viewport.imageRef}
              onLoad={(event) => {
                const size = `${frame.width}x${frame.height}`;
                if (fittedSize.current !== size) {
                  fittedSize.current = size;
                  viewport.initializeImage(event.currentTarget);
                }
              }}
              style={{ display: "block" }}
            />
            <svg
              width={frame.width}
              height={frame.height}
              className={styles.overlay}
              aria-label="设备操作与步骤回看"
              style={{
                cursor:
                  viewport.getBaseCursorStyle() ??
                  (operating ? "pointer" : "default"),
              }}
              onPointerDown={(event) => {
                if (busy) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                if (event.button === 1 || viewport.isSpacePressed) {
                  event.preventDefault();
                  viewport.startPan(
                    event.clientX,
                    event.clientY,
                    event.button === 1,
                  );
                  return;
                }
                if (!operating || event.button !== 0) return;
                if (!viewport.imageRef.current?.complete) return;
                setHeldFrame(frame);
                start.current = toPoint(event);
              }}
              onPointerMove={(event) => {
                if (viewport.isPanning) {
                  viewport.updatePan(event.clientX, event.clientY);
                  return;
                }
              }}
              onPointerUp={(event) => {
                if (start.current && !busy && !viewport.isPanning) {
                  const point = toPoint(event);
                  if (operating && viewport.imageRef.current) {
                    if (
                      Math.hypot(
                        point.x - start.current.x,
                        point.y - start.current.y,
                      ) *
                      viewport.scale <=
                      6
                    ) {
                      setLastClick(point);
                      onClick?.(
                        frame,
                        viewport.imageRef.current,
                        point.x,
                        point.y,
                      );
                    }
                  }
                }
                if (event.currentTarget.hasPointerCapture?.(event.pointerId))
                  event.currentTarget.releasePointerCapture(event.pointerId);
                cancel();
              }}
              onPointerCancel={cancel}
              onLostPointerCapture={cancel}
            >
              {operating && lastClick && (
                <circle
                  cx={lastClick.x}
                  cy={lastClick.y}
                  r={10 / viewport.scale}
                  stroke={token.colorPrimary}
                  strokeWidth={2 / viewport.scale}
                  fill="none"
                />
              )}
              {!operating &&
                roi &&
                config.recognition !== "DirectHit" &&
                rect(
                  [roi.x, roi.y, roi.width, roi.height],
                  token.colorPrimary,
                  "ROI",
                )}
              {!operating &&
                config.templateRect &&
                config.recognition === "TemplateMatch" &&
                rect(config.templateRect, token.colorWarning, "模板")}
              {!operating && config.target && config.targetMode === "fixed" && (
                <g stroke={token.colorError} strokeWidth={2 / viewport.scale}>
                  <circle
                    cx={config.target[0]}
                    cy={config.target[1]}
                    r={7 / viewport.scale}
                    fill="none"
                  />
                  <path
                    d={`M${config.target[0] - 12 / viewport.scale},${config.target[1]}h${24 / viewport.scale} M${config.target[0]},${config.target[1] - 12 / viewport.scale}v${24 / viewport.scale}`}
                  />
                </g>
              )}
              {!operating && current.capturePoint && (
                <circle cx={current.capturePoint.x} cy={current.capturePoint.y}
                  r={10 / viewport.scale} stroke={token.colorPrimary}
                  strokeWidth={2 / viewport.scale} fill="none" />
              )}
            </svg>
          </div>
        )}
      </div>
      <div className={styles.pictureHint}>
        {frame ? `${frame.width} × ${frame.height} · ` : ""}滚轮缩放 ·
        空格或中键拖动画面 ·{" "}
        {operating
          ? "画面自动刷新；点击立即发送到设备"
          : "操作前截图 · 参数在草稿中调整"}
      </div>
    </section>
  );
}
