import type { DebugPipelineOverride } from "./types";
import { configMark } from "../../core/parser/types";
import { useConfigStore } from "../../stores/configStore";
import {
  actionFieldSchemaKeyList,
  recoFieldSchemaKeyList,
} from "../../core/fields";
import {
  detectActionVersion,
  detectRecognitionVersion,
  normalizeActionType,
  normalizeRecoType,
} from "../../core/parser/versionDetector";
import { formatNodeJson } from "../../utils/node/nodeJsonValidator";

const INVALID_JSON_ERROR_CODE = "debug.override.invalid_json";

export interface DebugPipelineOverrideParseResult {
  error?: string;
  overrides?: DebugPipelineOverride[];
}

export const DEFAULT_DEBUG_PIPELINE_OVERRIDE_DRAFT = "{}";
export const DEBUG_PIPELINE_OVERRIDE_ERROR_CODE = INVALID_JSON_ERROR_CODE;

export function parseDebugPipelineOverrideDraft(
  draft: string,
): DebugPipelineOverrideParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(draft);
  } catch (error) {
    return {
      error: `Override JSON 语法错误: ${
        error instanceof Error ? error.message : "无法解析"
      }`,
    };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      error:
        "Override 必须是 JSON 对象，格式示例：{ \"RuntimeName\": { ...partial pipeline... } }",
    };
  }

  const overrides: DebugPipelineOverride[] = [];
  for (const [runtimeName, pipeline] of Object.entries(parsed)) {
    const normalizedRuntimeName = runtimeName.trim();
    if (!normalizedRuntimeName) {
      return {
        error: "Override 中存在空的运行时节点名（RuntimeName）。",
      };
    }
    if (!pipeline || typeof pipeline !== "object" || Array.isArray(pipeline)) {
      return {
        error: `Override 节点 ${normalizedRuntimeName} 的值必须是对象。`,
      };
    }

    let normalizedPipeline: Record<string, unknown>;
    try {
      normalizedPipeline = normalizeDebugPipelineOverrideNode(
        normalizedRuntimeName,
        pipeline as Record<string, unknown>,
      );
    } catch (error) {
      return {
        error: `Override 节点 ${normalizedRuntimeName} 版本归一化失败: ${
          error instanceof Error ? error.message : "无法转换"
        }`,
      };
    }

    overrides.push({
      runtimeName: normalizedRuntimeName,
      pipeline: normalizedPipeline,
    });
  }

  return { overrides };
}

export function formatDebugPipelineOverrideDraft(
  draft: string,
  indent = 2,
): string {
  return formatNodeJson(draft, indent);
}

export function hasDebugPipelineOverrideDraftContent(draft: string): boolean {
  const trimmed = draft.trim();
  if (!trimmed) {
    return false;
  }

  try {
    const parsed = JSON.parse(trimmed);
    return (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed) ||
      Object.keys(parsed).length > 0
    );
  } catch {
    return true;
  }
}

function normalizeDebugPipelineOverrideNode(
  runtimeName: string,
  pipeline: Record<string, unknown>,
): Record<string, unknown> {
  const targetVersion =
    useConfigStore.getState().configs.pipelineProtocolVersion ?? "v2";
  return targetVersion === "v1"
    ? normalizeOverrideNodeToV1(runtimeName, pipeline)
    : normalizeOverrideNodeToV2(runtimeName, pipeline);
}

function normalizeDebugRecoParamValue(key: string, value: unknown): unknown {
  if (key === "method" && value === 1) {
    return 10001;
  }
  return value;
}

function normalizeOverrideNodeToV2(
  runtimeName: string,
  pipeline: Record<string, unknown>,
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  const recognition = normalizeRecognitionForV2(runtimeName, pipeline);
  const action = normalizeActionForV2(runtimeName, pipeline);

  if (recognition) {
    normalized.recognition = recognition;
  }
  if (action) {
    normalized.action = action;
  }

  for (const [key, value] of Object.entries(pipeline)) {
    if (
      key === configMark ||
      key === "recognition" ||
      key === "action" ||
      recoFieldSchemaKeyList.includes(key) ||
      actionFieldSchemaKeyList.includes(key)
    ) {
      continue;
    }
    normalized[key] = value;
  }

  return normalized;
}

function normalizeOverrideNodeToV1(
  runtimeName: string,
  pipeline: Record<string, unknown>,
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  const recognition = normalizeRecognitionForV1(runtimeName, pipeline);
  const action = normalizeActionForV1(runtimeName, pipeline);

  if (recognition.type !== undefined) {
    normalized.recognition = recognition.type;
  }
  Object.assign(normalized, recognition.param);

  if (action.type !== undefined) {
    normalized.action = action.type;
  }
  Object.assign(normalized, action.param);

  for (const [key, value] of Object.entries(pipeline)) {
    if (
      key === configMark ||
      key === "recognition" ||
      key === "action" ||
      recoFieldSchemaKeyList.includes(key) ||
      actionFieldSchemaKeyList.includes(key)
    ) {
      continue;
    }
    normalized[key] = value;
  }

  return normalized;
}

function normalizeRecognitionForV2(
  _runtimeName: string,
  pipeline: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const recognitionVersion = detectRecognitionVersion(pipeline);
  const param: Record<string, unknown> = {};

  for (const key of recoFieldSchemaKeyList) {
    if (key in pipeline) {
      param[key] = normalizeDebugRecoParamValue(key, pipeline[key]);
    }
  }

  if (recognitionVersion === 1) {
    const type =
      typeof pipeline.recognition === "string"
        ? normalizeRecoType(pipeline.recognition)
        : undefined;
    if (type === undefined && Object.keys(param).length === 0) {
      return undefined;
    }
    return {
      ...(type !== undefined ? { type } : {}),
      ...(Object.keys(param).length > 0 ? { param } : {}),
    };
  }

  const rawRecognition = asRecord(pipeline.recognition);
  if (!rawRecognition) {
    return Object.keys(param).length > 0 ? { param } : undefined;
  }
  const normalized = { ...rawRecognition };
  if (typeof rawRecognition.type === "string") {
    normalized.type = normalizeRecoType(rawRecognition.type);
  }
  if (Object.keys(param).length > 0) {
    normalized.param = {
      ...asRecord(rawRecognition.param),
      ...param,
    };
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeActionForV2(
  _runtimeName: string,
  pipeline: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const actionVersion = detectActionVersion(pipeline);
  const param: Record<string, unknown> = {};

  for (const key of actionFieldSchemaKeyList) {
    if (key in pipeline) {
      param[key] = pipeline[key];
    }
  }

  if (actionVersion === 1) {
    const type =
      typeof pipeline.action === "string"
        ? normalizeActionType(pipeline.action)
        : undefined;
    if (type === undefined && Object.keys(param).length === 0) {
      return undefined;
    }
    return {
      ...(type !== undefined ? { type } : {}),
      ...(Object.keys(param).length > 0 ? { param } : {}),
    };
  }

  const rawAction = asRecord(pipeline.action);
  if (!rawAction) {
    return Object.keys(param).length > 0 ? { param } : undefined;
  }
  const normalized = { ...rawAction };
  if (typeof rawAction.type === "string") {
    normalized.type = normalizeActionType(rawAction.type);
  }
  if (Object.keys(param).length > 0) {
    normalized.param = {
      ...asRecord(rawAction.param),
      ...param,
    };
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeRecognitionForV1(
  _runtimeName: string,
  pipeline: Record<string, unknown>,
): { type?: string; param: Record<string, unknown> } {
  const recognitionVersion = detectRecognitionVersion(pipeline);
  const param: Record<string, unknown> = {};

  for (const key of recoFieldSchemaKeyList) {
    if (key in pipeline) {
      param[key] = normalizeDebugRecoParamValue(key, pipeline[key]);
    }
  }

  if (recognitionVersion === 1) {
    return {
      type:
        typeof pipeline.recognition === "string"
          ? normalizeRecoType(pipeline.recognition)
          : undefined,
      param,
    };
  }

  const rawRecognition = asRecord(pipeline.recognition);
  if (!rawRecognition) {
    return { param };
  }
  Object.assign(param, normalizeParamRecord(rawRecognition.param, true));
  return {
    type:
      typeof rawRecognition.type === "string"
        ? normalizeRecoType(rawRecognition.type)
        : undefined,
    param,
  };
}

function normalizeActionForV1(
  _runtimeName: string,
  pipeline: Record<string, unknown>,
): { type?: string; param: Record<string, unknown> } {
  const actionVersion = detectActionVersion(pipeline);
  const param: Record<string, unknown> = {};

  for (const key of actionFieldSchemaKeyList) {
    if (key in pipeline) {
      param[key] = pipeline[key];
    }
  }

  if (actionVersion === 1) {
    return {
      type:
        typeof pipeline.action === "string"
          ? normalizeActionType(pipeline.action)
          : undefined,
      param,
    };
  }

  const rawAction = asRecord(pipeline.action);
  if (!rawAction) {
    return { param };
  }
  Object.assign(param, normalizeParamRecord(rawAction.param));
  return {
    type:
      typeof rawAction.type === "string"
        ? normalizeActionType(rawAction.type)
        : undefined,
    param,
  };
}

function normalizeParamRecord(
  value: unknown,
  isRecognition = false,
): Record<string, unknown> {
  const record = asRecord(value);
  if (!record) {
    return {};
  }
  if (!isRecognition) {
    return { ...record };
  }
  return Object.fromEntries(
    Object.entries(record).map(([key, item]) => [
      key,
      normalizeDebugRecoParamValue(key, item),
    ]),
  );
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}
