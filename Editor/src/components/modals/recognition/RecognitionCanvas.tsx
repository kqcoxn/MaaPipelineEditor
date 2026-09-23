import { useEffect, useRef } from "react";
import type { CanvasRenderProps } from "../ScreenshotModalBase";
import { resolveNegativeROI } from "@/utils/data/roiNegativeCoord";

export type ROI = [number, number, number, number];
export interface RecognitionBox {
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
  text: string;
}

export function RecognitionCanvas({
  viewport, roi, roiOffset, boxes, best, onROIChange,
}: {
  viewport: CanvasRenderProps;
  roi: ROI;
  roiOffset?: ROI;
  boxes: RecognitionBox[];
  best?: RecognitionBox | null;
  onROIChange: (roi: ROI) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const { imageElement, scale, panOffset } = viewport;
  const { initializeImage, containerRef } = viewport;

  useEffect(() => {
    const container = containerRef.current;
    if (!imageElement || !container) return;
    let frame = requestAnimationFrame(() => initializeImage(imageElement));
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => initializeImage(imageElement));
    });
    observer.observe(container);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [imageElement, initializeImage, containerRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !imageElement) return;
    canvas.width = imageElement.width;
    canvas.height = imageElement.height;
    ctx.drawImage(imageElement, 0, 0);
    const effectiveROI = roi.map((value, i) => value + (roiOffset?.[i] ?? 0)) as ROI;
    const area = resolveNegativeROI(effectiveROI, canvas.width, canvas.height).actual;
    ctx.strokeStyle = "#1677ff";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(area.x, area.y, area.width, area.height);
    ctx.setLineDash([]);
    boxes.forEach((box, index) => {
      const selected = best && box.x === best.x && box.y === best.y &&
        box.width === best.width && box.height === best.height;
      ctx.strokeStyle = selected ? "#52c41a" : "#faad14";
      ctx.lineWidth = selected ? 3 : 1;
      ctx.strokeRect(box.x, box.y, box.width, box.height);
      ctx.font = "bold 16px sans-serif";
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fillText(`${index + 1}: ${box.score.toFixed(3)}`, box.x, Math.max(16, box.y - 4));
    });
  }, [imageElement, roi, roiOffset, boxes, best]);

  const position = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.round(Math.max(0, Math.min(canvas.width - 1, (event.clientX - rect.left) / scale))),
      y: Math.round(Math.max(0, Math.min(canvas.height - 1, (event.clientY - rect.top) / scale))),
    };
  };
  const stop = () => { start.current = null; viewport.endPan(); };
  return <canvas
    ref={canvasRef}
    aria-label="OCR 底图与识别框；可拖动框选 ROI，也可在下方输入坐标"
    onMouseDown={(event) => {
      if (event.button === 1 || viewport.isSpacePressed) {
        event.preventDefault();
        viewport.startPan(event.clientX, event.clientY, event.button === 1);
      } else if (event.button === 0) {
        start.current = position(event);
      }
    }}
    onMouseMove={(event) => {
      if (viewport.isPanning) { viewport.updatePan(event.clientX, event.clientY); return; }
      if (!start.current) return;
      const end = position(event);
      onROIChange([
        Math.min(start.current.x, end.x), Math.min(start.current.y, end.y),
        Math.max(1, Math.abs(end.x - start.current.x)), Math.max(1, Math.abs(end.y - start.current.y)),
      ]);
    }}
    onMouseUp={stop}
    onMouseLeave={stop}
    style={{
      position: "absolute", top: 0, left: 0, transformOrigin: "top left",
      transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${scale})`,
      cursor: viewport.getBaseCursorStyle() || "crosshair",
    }}
  />;
}
