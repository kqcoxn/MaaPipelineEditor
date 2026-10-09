import { useEffect, useRef, useState } from "react";
import { Button, Select, theme } from "antd";
import { useCanvasViewport } from "@/hooks/useCanvasViewport";
import { resolveNegativeROI } from "@/utils/data/roiNegativeCoord";
import { useRecorderStore } from "./store";
import { cropTemplate, imagePoint, selectionRect } from "./geometry";
import type { Rect, RecorderFrame } from "./types";
import styles from "./Recorder.module.less";

type Tool = "roi" | "template" | "target";
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
  const edit = useRecorderStore((s) => s.edit);
  const { token } = theme.useToken();
  const [tool, setTool] = useState<Tool>("roi");
  const [lastClick, setLastClick] = useState<{ x: number; y: number }>();
  const [selection, setSelection] = useState<Rect>();
  const activeTool =
    tool === "template" && current.config.recognition !== "TemplateMatch"
      ? "roi"
      : tool;
  const start = useRef<{ x: number; y: number } | null>(null);
  const { config, result } = current;
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
    setSelection(undefined);
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
  const boxes = result?.image === frame?.image ? (result?.boxes ?? []) : [];
  return (
    <section className={styles.picture} aria-label="设备画面">
      <div className={styles.pictureTools}>
        {operating ? (
          <span className={styles.hint}>
            点击画面操作设备 · 拖动不会发送滑动
          </span>
        ) : (
          <Select
            aria-label="画面交互工具"
            value={activeTool}
            disabled={busy}
            onChange={(value) => {
              cancel();
              setTool(value);
            }}
            options={[
              { value: "roi", label: "框选 ROI" },
              {
                value: "template",
                label: "裁剪模板",
                disabled: config.recognition !== "TemplateMatch",
              },
              { value: "target", label: "选择固定点击位置" },
            ]}
          />
        )}
        <Button onClick={viewport.handleZoomOut} aria-label="缩小画面">
          −
        </Button>
        <Button onClick={viewport.handleZoomReset}>
          {Math.round(viewport.scale * 100)}%
        </Button>
        <Button onClick={viewport.handleZoomIn} aria-label="放大画面">
          +
        </Button>
      </div>
      <div ref={viewport.containerRef} className={styles.viewport}>
        {!frame ? (
          <div className={styles.empty}>
            连接设备后点击“获取截图”
            <br />
            {operating
              ? "画面加载后即可直接点击设备"
              : "在画面中框选和选点不会操作设备"}
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
              aria-label="框选区域和点击位置"
              style={{
                cursor:
                  viewport.getBaseCursorStyle() ??
                  (operating ? "pointer" : "crosshair"),
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
                if (event.button !== 0) return;
                if (!viewport.imageRef.current?.complete) return;
                setHeldFrame(frame);
                start.current = toPoint(event);
                setSelection(undefined);
              }}
              onPointerMove={(event) => {
                if (viewport.isPanning) {
                  viewport.updatePan(event.clientX, event.clientY);
                  return;
                }
                if (!operating && start.current && activeTool !== "target")
                  setSelection(selectionRect(start.current, toPoint(event)));
              }}
              onPointerUp={(event) => {
                if (start.current && !busy && !viewport.isPanning) {
                  const point = toPoint(event);
                  const area = selectionRect(start.current, point);
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
                  } else if (activeTool === "target")
                    edit({
                      targetMode: "fixed",
                      target: [point.x, point.y, 1, 1],
                    });
                  else if (
                    tool === "template" &&
                    config.recognition === "TemplateMatch" &&
                    viewport.imageRef.current
                  ) {
                    edit({
                      templateRect: area,
                      templateImage: cropTemplate(
                        viewport.imageRef.current,
                        area,
                      ),
                    });
                  } else if (activeTool === "roi") edit({ roi: area });
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
              {!operating &&
                boxes.map((box, index) => (
                  <g key={index}>
                    {rect(
                      [box.x, box.y, box.width, box.height],
                      token.colorWarning,
                      `${index + 1} ${box.text || box.score.toFixed(2)}`,
                    )}
                  </g>
                ))}
              {!operating &&
                result?.hit &&
                result.best &&
                result.image === frame?.image &&
                rect(
                  [
                    result.best.x,
                    result.best.y,
                    result.best.width,
                    result.best.height,
                  ],
                  token.colorSuccess,
                  "命中",
                )}
              {selection && rect(selection, token.colorTextLightSolid, "选区")}
            </svg>
          </div>
        )}
      </div>
      <div className={styles.hint}>
        {frame ? `${frame.width} × ${frame.height} · ` : ""}滚轮缩放 ·
        空格或中键拖动画面 ·{" "}
        {operating
          ? "画面自动刷新；点击立即发送到设备"
          : "修正步骤时底图保持固定"}
      </div>
    </section>
  );
}
