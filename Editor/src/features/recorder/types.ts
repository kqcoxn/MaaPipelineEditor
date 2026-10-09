import type { RecognitionBox } from "@/components/modals/recognition/RecognitionCanvas";

export type Rect = [number, number, number, number];
export interface RecorderConfig {
  name: string;
  recognition: "OCR" | "TemplateMatch" | "DirectHit";
  action: "Click" | "DoNothing";
  roi: Rect;
  expected: string;
  threshold: number;
  templateImage?: string;
  templateRect?: Rect;
  target?: Rect;
  targetMode: "recognition" | "fixed";
  offset: Rect;
}
export interface RecorderFrame {
  image: string;
  width: number;
  height: number;
  controllerId: string;
}
export interface RecorderResult {
  request_id: string;
  success: boolean;
  error?: string;
  hit: boolean;
  action_success?: boolean;
  boxes: RecognitionBox[];
  best?: RecognitionBox;
  image?: string;
  width?: number;
  height?: number;
}
export interface RecorderStep {
  id: string;
  version: number;
  config: RecorderConfig;
  frame?: RecorderFrame;
  result?: RecorderResult;
  suggestion?: "pending" | "ocr" | "template" | "unavailable";
  suggestionError?: string;
  templateCandidates?: { rect: Rect; image: string; label: string }[];
  capturePoint?: { x: number; y: number };
  capture?: {
    status: "pending" | "success" | "failed" | "unknown";
    error?: string;
  };
}
export type RunMode = "preview" | "execute" | "extract" | "suggest";
export interface RunRequest {
  mode: RunMode;
  controller_id: string;
  resource_path?: string;
  base_image?: string;
  width?: number;
  height?: number;
  step: {
    recognition: RecorderConfig["recognition"];
    action: RecorderConfig["action"];
    roi: Rect;
    expected: string;
    threshold: number;
    template_image?: string;
    target?: Rect;
    target_offset: Rect;
  };
}
export interface AssetResult {
  request_id: string;
  success: boolean;
  error?: string;
  paths?: Record<string, string>;
}
export function newStep(): RecorderStep {
  return {
    id: crypto.randomUUID(),
    version: 0,
    config: {
      name: "",
      recognition: "OCR",
      action: "Click",
      roi: [0, 0, 0, 0],
      expected: "",
      threshold: 0.3,
      targetMode: "recognition",
      offset: [0, 0, 0, 0],
    },
  };
}
export function validateConfig(
  config: RecorderConfig,
  recognitionOnly = false,
): string | undefined {
  if (config.recognition === "OCR" && !config.expected.trim())
    return "请填写 OCR 文字";
  if (config.recognition === "TemplateMatch" && !config.templateImage)
    return "请框选并裁剪模板";
  if (
    !recognitionOnly &&
    config.action === "Click" &&
    (config.recognition === "DirectHit" || config.targetMode === "fixed") &&
    !config.target
  )
    return "请在画面上选择固定点击位置";
  if (
    !Number.isFinite(config.threshold) ||
    config.threshold < 0 ||
    config.threshold > 1
  )
    return "阈值必须在 0 到 1 之间";
  if (
    [config.roi, config.offset, config.target].some((rect) =>
      rect?.some((value) => !Number.isSafeInteger(value)),
    )
  )
    return "坐标必须是整数";
}
export function escapeOCRText(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
export function makeRunRequest(
  step: RecorderStep,
  mode: RunMode,
  controllerId: string,
  resourcePath: string,
): RunRequest {
  const c = step.config;
  return {
    mode,
    controller_id: controllerId,
    resource_path: resourcePath || undefined,
    base_image: mode === "execute" ? undefined : step.frame?.image,
    width: step.frame?.width,
    height: step.frame?.height,
    step: {
      recognition: c.recognition,
      action: c.action,
      roi: c.roi,
      expected: c.expected,
      threshold: c.threshold,
      template_image: c.templateImage,
      target: c.targetMode === "fixed" ? c.target : undefined,
      target_offset: c.offset,
    },
  };
}
