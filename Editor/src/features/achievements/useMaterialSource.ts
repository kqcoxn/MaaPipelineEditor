import { useCallback, useRef } from "react";
import { emitAchievementEvent } from "./bus";

/**底图来源随每次替换更新，上传本身不触发成就。 */
export function useMaterialSource(setScreenshot: (image: string | null) => void) {
  const uploaded = useRef(false);
  const onScreenshotChange = useCallback((image: string | null, source?: "device" | "upload") => {
    uploaded.current = source === "upload";
    setScreenshot(image);
  }, [setScreenshot]);
  return { uploaded, onScreenshotChange };
}

export function recordUploadedMaterial(uploaded: boolean) {
  if (uploaded) emitAchievementEvent("achievement:uploaded_material_used");
}
