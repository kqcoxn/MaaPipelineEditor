import type { TFunction } from "i18next";

type RoiModalName = "roiModal" | "ocrModal" | "templateModal";

/** Shared ROI coordinate UI strings for screenshot-based modals. */
export function getRoiModalStrings(t: TFunction, modal: RoiModalName) {
  const prefix = `ui.modals.${modal}`;

  return {
    roiCoords: t(`${prefix}.roiCoords`, "ROI 坐标"),
    negativeCoordTitle: t(`${prefix}.negativeCoordTitle`, "负数坐标说明 (v5.6+)"),
    negativeX: t(`${prefix}.negativeX`, "• x 负数：从右边缘计算"),
    negativeY: t(`${prefix}.negativeY`, "• y 负数：从下边缘计算"),
    zeroExtend: t(`${prefix}.zeroExtend`, "• w/h 为 0：延伸至边缘"),
    negativeAbs: t(`${prefix}.negativeAbs`, "• w/h 负数：取绝对值， 作为右下角"),
    tooltipNegativeX: t(`${prefix}.tooltipNegativeX`, "负数从右边缘计算"),
    tooltipNegativeY: t(`${prefix}.tooltipNegativeY`, "负数从下边缘计算"),
    tooltipZeroExtendW: t(
      `${prefix}.tooltipZeroExtendW`,
      "0 表示延伸至右边缘，负数取绝对值并将 作为右下角",
    ),
    tooltipZeroExtendH: t(
      `${prefix}.tooltipZeroExtendH`,
      "0 表示延伸至下边缘，负数取绝对值并将 作为右下角",
    ),
    indicatorFromRight: t(`${prefix}.indicatorFromRight`, "←右"),
    indicatorFromBottom: t(`${prefix}.indicatorFromBottom`, "↑下"),
    indicatorToEdge: t(`${prefix}.indicatorToEdge`, "→边"),
    indicatorBothH: t(`${prefix}.indicatorBothH`, "←→"),
    indicatorToBottomEdge: t(`${prefix}.indicatorToBottomEdge`, "↓边"),
    indicatorBothV: t(`${prefix}.indicatorBothV`, "↑↓"),
    splitTopLeft: t(`${prefix}.splitTopLeft`, "左上: "),
    splitBottomRight: t(`${prefix}.splitBottomRight`, "右下: "),
  };
}

export type RoiModalStrings = ReturnType<typeof getRoiModalStrings>;
