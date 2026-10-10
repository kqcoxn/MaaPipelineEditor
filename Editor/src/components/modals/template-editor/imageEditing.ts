export interface Point { x: number; y: number }
export interface Crop { x: number; y: number; width: number; height: number }
export interface Stroke { tool: "brush" | "eraser"; size: number; points: Point[] }
export interface TemplateEdit { crop: Crop; strokes: Stroke[] }

export function cropBetween(a: Point, b: Point, width: number, height: number): Crop {
  const x = Math.max(0, Math.min(width - 1, Math.floor(Math.min(a.x, b.x))));
  const y = Math.max(0, Math.min(height - 1, Math.floor(Math.min(a.y, b.y))));
  return { x, y, width: Math.max(1, Math.min(width, Math.ceil(Math.max(a.x, b.x))) - x),
    height: Math.max(1, Math.min(height, Math.ceil(Math.max(a.y, b.y))) - y) };
}

/** Keep mask pixels pure green; antialiased edges would become recognition content. */
export function renderTemplate(image: HTMLImageElement, strokes: Stroke[]): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d")!;
  context.drawImage(image, 0, 0);
  if (!strokes.length) return canvas;
  const mask = document.createElement("canvas");
  mask.width = canvas.width;
  mask.height = canvas.height;
  const ctx = mask.getContext("2d")!;
  for (const stroke of strokes) {
    if (!stroke.points.length) continue;
    ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = ctx.fillStyle = "#00ff00";
    ctx.lineWidth = stroke.size;
    ctx.lineCap = ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.arc(stroke.points[0].x, stroke.points[0].y, stroke.size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    stroke.points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    ctx.stroke();
  }
  const pixels = ctx.getImageData(0, 0, mask.width, mask.height);
  for (let i = 0; i < pixels.data.length; i += 4) {
    if (pixels.data[i + 3] > 0) {
      pixels.data[i] = pixels.data[i + 2] = 0;
      pixels.data[i + 1] = pixels.data[i + 3] = 255;
    }
  }
  ctx.putImageData(pixels, 0, 0);
  context.drawImage(mask, 0, 0);
  return canvas;
}

export function exportTemplate(image: HTMLImageElement, edit: TemplateEdit): string {
  const source = renderTemplate(image, edit.strokes);
  const result = document.createElement("canvas");
  const { x, y, width, height } = edit.crop;
  result.width = width;
  result.height = height;
  result.getContext("2d")!.drawImage(source, x, y, width, height, 0, 0, width, height);
  return result.toDataURL("image/png");
}
