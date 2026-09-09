import { renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { subscribeAchievementEvents } from "./bus";
import { recordUploadedMaterial, useMaterialSource } from "./useMaterialSource";

it("上传不解锁，完成取材才解锁，换回设备底图或重开后不沿用上传来源", () => {
  const event = vi.fn();
  const dispose = subscribeAchievementEvents(event);
  try {
    const { result } = renderHook(() => useMaterialSource(vi.fn()));
    result.current.onScreenshotChange("image", "upload");
    expect(event).not.toHaveBeenCalled();
    recordUploadedMaterial(result.current.uploaded.current);
    expect(event).toHaveBeenCalledTimes(1);
    result.current.onScreenshotChange("device", "device");
    recordUploadedMaterial(result.current.uploaded.current);
    result.current.onScreenshotChange("image", "upload");
    result.current.onScreenshotChange(null);
    recordUploadedMaterial(result.current.uploaded.current);
    expect(event).toHaveBeenCalledTimes(1);
  } finally { dispose(); }
});
