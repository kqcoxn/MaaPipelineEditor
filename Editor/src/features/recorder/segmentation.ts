import type { Rect } from "./types";

const NEIGHBOURS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const;

/** Bounded, local foreground components. This proposes geometry, not semantic recognition. */
export function segmentElements(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
): Rect[] {
  if (pixels.length !== width * height * 4 || width * height > 320 * 240)
    return [];
  // Median perimeter colour tolerates small neighbouring controls at the edge.
  const border: number[][] = [[], [], []];
  for (let py = 0; py < height; py++)
    for (let px = 0; px < width; px++) {
      if (px !== 0 && py !== 0 && px !== width - 1 && py !== height - 1)
        continue;
      for (let c = 0; c < 3; c++)
        border[c].push(pixels[(py * width + px) * 4 + c]);
    }
  const background = border.map(
    (v) => v.sort((a, b) => a - b)[Math.floor(v.length / 2)],
  );
  const contrast = new Uint8Array(width * height);
  for (let i = 0; i < contrast.length; i++) {
    contrast[i] = Math.max(
      Math.abs(pixels[i * 4] - background[0]),
      Math.abs(pixels[i * 4 + 1] - background[1]),
      Math.abs(pixels[i * 4 + 2] - background[2]),
    );
  }
  const proposals: { rect: Rect; score: number }[] = [];
  const queue = new Int32Array(width * height);
  for (const threshold of [6, 16, 32]) {
    const small: Rect[] = [];
    const visited = new Uint8Array(width * height);
    for (let i = 0; i < contrast.length; i++) {
      if (visited[i] || contrast[i] < threshold) continue;
      let head = 0,
        tail = 1;
      queue[0] = i;
      visited[i] = 1;
      let left = width,
        right = 0,
        top = height,
        bottom = 0;
      while (head < tail) {
        const pos = queue[head++],
          px = pos % width,
          py = Math.floor(pos / width);
        left = Math.min(left, px);
        right = Math.max(right, px);
        top = Math.min(top, py);
        bottom = Math.max(bottom, py);
        for (const [dx, dy] of NEIGHBOURS) {
          const nx = px + dx,
            ny = py + dy,
            next = ny * width + nx;
          if (
            nx < 0 ||
            nx >= width ||
            ny < 0 ||
            ny >= height ||
            visited[next] ||
            contrast[next] < threshold
          )
            continue;
          visited[next] = 1;
          queue[tail++] = next;
        }
      }
      const w = right - left + 1,
        h = bottom - top + 1;
      // Ignore noise, separators, and components truncated by the search window.
      if (
        w < 2 ||
        h < 2 ||
        tail < 3 ||
        left === 0 ||
        top === 0 ||
        right === width - 1 ||
        bottom === height - 1 ||
        w / h > 12 ||
        h / w > 12
      )
        continue;
      if (w <= 12 && h <= 12) {
        small.push([left, top, w, h]);
        continue;
      }
      if (w < 8 || h < 8 || tail < 20) continue;
      const distance = Math.hypot(
        Math.max(left - x, 0, x - right),
        Math.max(top - y, 0, y - bottom),
      );
      if (distance > 24) continue;
      const l = Math.max(0, left - 2),
        t = Math.max(0, top - 2);
      const rect: Rect = [
        l,
        t,
        Math.min(width, right + 3) - l,
        Math.min(height, bottom + 3) - t,
      ];
      if (
        proposals.some((p) =>
          p.rect.every((v, j) => Math.abs(v - rect[j]) <= 4),
        )
      )
        continue;
      proposals.push({ rect, score: distance * 1000 + w * h });
    }
    // Punctuation icons consist of several disconnected tiny components. Join
    // similarly sized neighbours on one line, never long card borders/separators.
    for (const group of groupSmallElements(small)) {
      const [left, top, w, h] = group;
      const distance = Math.hypot(
        Math.max(left - x, 0, x - left - w),
        Math.max(top - y, 0, y - top - h),
      );
      if (distance > 16) continue;
      const rect: Rect = [
        Math.max(0, left - 3),
        Math.max(0, top - 3),
        Math.min(width, left + w + 3) - Math.max(0, left - 3),
        Math.min(height, top + h + 3) - Math.max(0, top - 3),
      ];
      if (
        !proposals.some((p) =>
          p.rect.every((v, j) => Math.abs(v - rect[j]) <= 4),
        )
      )
        proposals.push({ rect, score: distance * 1000 + w * h });
    }
  }
  return proposals
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((p) => p.rect);
}

function groupSmallElements(rects: Rect[]): Rect[] {
  const used = new Set<number>();
  const groups: Rect[] = [];
  const sorted = [...rects].sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < sorted.length; i++) {
    if (used.has(i)) continue;
    const x = sorted[i][0];
    let [, y, w, h] = sorted[i];
    let count = 1;
    used.add(i);
    for (let j = i + 1; j < sorted.length; j++) {
      if (used.has(j)) continue;
      const [nx, ny, nw, nh] = sorted[j];
      const gap = nx - (x + w);
      if (
        gap < 0 ||
        gap > Math.max(12, h * 2) ||
        Math.abs(ny + nh / 2 - y - h / 2) > Math.max(3, h / 2) ||
        Math.max(nh, h) > Math.min(nh, h) * 2
      )
        continue;
      const bottom = Math.max(y + h, ny + nh);
      y = Math.min(y, ny);
      h = bottom - y;
      w = nx + nw - x;
      used.add(j);
      count++;
      if (count === 4) break;
    }
    if ((count >= 2 || (w >= 5 && h >= 5)) && w <= 80)
      groups.push([x, y, w, h]);
  }
  return groups;
}

export function findElementRects(
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
): Rect[] {
  const w = Math.min(320, width),
    h = Math.min(240, height);
  const left = Math.max(0, Math.min(width - w, x - Math.floor(w / 2)));
  const top = Math.max(0, Math.min(height - h, y - Math.floor(h / 2)));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return [];
  context.drawImage(image, left, top, w, h, 0, 0, w, h);
  const pixels = context.getImageData(0, 0, w, h).data;
  return segmentElements(pixels, w, h, x - left, y - top).map(
    ([rx, ry, rw, rh]) => [rx + left, ry + top, rw, rh],
  );
}
