import { describe, expect, it } from "vitest";
import { cropBetween } from "./imageEditing";

describe("template crop coordinates", () => {
  it("normalizes reverse dragging to integer pixel bounds", () => {
    expect(cropBetween({ x: 24.3, y: 18.7 }, { x: 3.8, y: 5.2 }, 40, 30))
      .toEqual({ x: 3, y: 5, width: 22, height: 14 });
  });
  it("keeps edge selections inside the image with nonzero dimensions", () => {
    expect(cropBetween({ x: -8, y: -3 }, { x: 60, y: 50 }, 43, 47))
      .toEqual({ x: 0, y: 0, width: 43, height: 47 });
    expect(cropBetween({ x: 43, y: 47 }, { x: 43, y: 47 }, 43, 47))
      .toEqual({ x: 42, y: 46, width: 1, height: 1 });
  });
});
