import { useMemo } from "react";
import { Button } from "antd";
import { BorderOutlined } from "@ant-design/icons";
import {
  DebugImageViewer,
  type DebugImageOverlay,
  type DebugImageOverlayGroup,
} from "@/features/debug/components/DebugImageViewer";
import type { OCRVerifyResult } from "./OCRVerificationResults";

export function OCROverlayPreview({ screenshot, result }: {
  screenshot: string;
  result: OCRVerifyResult;
}) {
  const { overlays, groups } = useMemo(() => {
    const overlays: DebugImageOverlay[] = [];
    const groups: DebugImageOverlayGroup[] = [];
    for (const group of [
      { key: "all", label: "原始结果", boxes: result.all ?? [] },
      { key: "filtered", label: "过滤后结果", boxes: result.filtered ?? [] },
      { key: "best", label: "最终命中", boxes: result.best ? [result.best] : [] },
    ]) {
      // 未命中时从原始候选框开始，避免默认选中空的 filtered 分组。
      if (group.boxes.length === 0) continue;
      groups.push({ key: group.key, label: group.label });
      group.boxes.forEach((box, index) => overlays.push({
        id: `${group.key}:${index}`,
        groupKey: group.key,
        kind: "box",
        box: { x: box.x, y: box.y, width: box.width, height: box.height },
        label: `${group.label} #${index + 1}`,
        text: box.text,
        score: box.score,
        status: group.key === "best" ? "selected" : "candidate",
      }));
    }
    return { overlays, groups };
  }, [result]);

  return <DebugImageViewer
    alt="文字识别验证辅助框"
    src={screenshot}
    overlays={overlays}
    overlayGroups={groups}
    renderTrigger={(openPreview) => <Button aria-label="辅助框" size="small" icon={<BorderOutlined aria-hidden />}
      onClick={openPreview}>辅助框</Button>}
  />;
}
