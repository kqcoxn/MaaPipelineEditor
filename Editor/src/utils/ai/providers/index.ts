/**
 * AI Provider 注册表
 * 统一管理和分发所有 AI 厂商 Provider
 */

export type {
  AIProviderType,
  AIProviderConfig,
  AIProvider,
  UnifiedMessage,
  VisionImage,
  UnifiedResponse,
  TokenUsage,
  ProviderRequest,
  RequestOptions,
} from "./types";

import type { AIProviderType, AIProvider } from "./types";
import { openaiProvider } from "./openai";
import { anthropicProvider } from "./anthropic";
import { geminiProvider } from "./gemini";

/**
 * Custom Provider：与 OpenAI 格式完全一致
 * 用于支持任意 OpenAI 兼容的第三方服务
 */
const customProvider: AIProvider = {
  ...openaiProvider,
  type: "custom",
  displayName: "自定义 (OpenAI 兼容)",
  defaultBaseUrl: "",
  models: [],
  visionModels: [],
};

/** 所有已注册的 Provider */
const providerRegistry: Record<AIProviderType, AIProvider> = {
  openai: openaiProvider,
  anthropic: anthropicProvider,
  gemini: geminiProvider,
  custom: customProvider,
};

/**
 * 获取指定类型的 Provider
 */
export function getProvider(type: AIProviderType): AIProvider {
  return providerRegistry[type] || providerRegistry.openai;
}

/**
 * 获取所有可用的 Provider 列表
 */
export function getAllProviders(): AIProvider[] {
  return Object.values(providerRegistry);
}

/**
 * 从 URL 自动检测 Provider 类型
 */
export function detectProviderFromUrl(url: string): AIProviderType {
  const lower = url.toLowerCase();
  if (lower.includes("anthropic.com") || lower.includes("claude")) {
    return "anthropic";
  }
  if (
    lower.includes("googleapis.com") ||
    lower.includes("generativelanguage") ||
    lower.includes("gemini")
  ) {
    return "gemini";
  }
  if (lower.includes("openai.com") || lower.includes("api.openai")) {
    return "openai";
  }
  return "custom";
}

/**
 * 获取 Provider 类型的显示选项（用于 UI 下拉框）
 */
export function getProviderOptions(): Array<{
  value: AIProviderType;
  label: string;
}> {
  return [
    { value: "openai", label: "OpenAI" },
    { value: "anthropic", label: "Claude (Anthropic)" },
    { value: "gemini", label: "Gemini (Google)" },
    { value: "custom", label: "自定义 (OpenAI 兼容)" },
  ];
}
