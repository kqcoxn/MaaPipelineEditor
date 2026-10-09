import { expect, it } from "vitest";
import { segmentElements } from "./segmentation";

it("separates a low-contrast control from neighbours and ignores a page separator", () => {
  const w = 192,
    h = 128;
  const pixels = new Uint8ClampedArray(w * h * 4).fill(255);
  const paint = (
    x: number,
    y: number,
    width: number,
    height: number,
    value: number,
  ) => {
    for (let py = y; py < y + height; py++)
      for (let px = x; px < x + width; px++)
        for (let c = 0; c < 3; c++) pixels[(py * w + px) * 4 + c] = value;
  };
  paint(0, 6, 192, 2, 235);
  paint(64, 46, 62, 36, 239);
  paint(70, 52, 24, 24, 255); // white thumb; click still belongs to the enclosing control
  paint(151, 60, 8, 8, 80);
  const candidates = segmentElements(pixels, w, h, 80, 64);
  expect(candidates[0]).toEqual([62, 44, 66, 40]);
  expect(candidates.every(([x, , width]) => x + width < 150)).toBe(true);
});
it("does not invent an element on a blank or clipped image", () => {
  const pixels = new Uint8ClampedArray(100 * 80 * 4).fill(255);
  expect(segmentElements(pixels, 100, 80, 50, 40)).toEqual([]);
  for (let y = 0; y < 80; y++)
    for (let x = 0; x < 100; x++) {
      if (x < 30)
        for (let c = 0; c < 3; c++) pixels[(y * 100 + x) * 4 + c] = 20;
    }
  expect(segmentElements(pixels, 100, 80, 20, 40)).toEqual([]);
});

it("groups ellipsis dots tightly without absorbing the neighbouring card border", () => {
  const w = 192,
    h = 128;
  const pixels = new Uint8ClampedArray(w * h * 4).fill(255);
  const paint = (
    x: number,
    y: number,
    width: number,
    height: number,
    value: number,
  ) => {
    for (let py = y; py < y + height; py++)
      for (let px = x; px < x + width; px++)
        for (let c = 0; c < 3; c++) pixels[(py * w + px) * 4 + c] = value;
  };
  for (const x of [84, 94, 104]) paint(x, 62, 4, 4, 100);
  paint(145, 0, 3, 110, 240);
  paint(170, 0, 3, 128, 240);
  expect(segmentElements(pixels, w, h, 96, 64)[0]).toEqual([81, 59, 30, 10]);
});
