import type { UnifiedMessage } from "@/utils/ai/providers";

export const CONTEXT_SUMMARY_MARKER = "[MPE_CONTEXT_SUMMARY]";

export interface ContextCompactionPreparation {
  systemMessages: UnifiedMessage[];
  messagesToSummarize: UnifiedMessage[];
  messagesToKeep: UnifiedMessage[];
  previousSummary?: string;
  tokensBefore: number;
}

export function estimateContextTokens(messages: UnifiedMessage[]): number {
  const serialized = messages
    .map((message) => `${message.role}:${message.content}`)
    .join("\n");
  return Math.ceil(serialized.length / 1.3);
}

export function serializeConversation(messages: UnifiedMessage[]): string {
  return messages
    .map((message) => {
      if (message.role === "assistant" && message.toolCalls?.length) {
        const calls = message.toolCalls
          .map(
            (call) =>
              `${call.name}(${JSON.stringify(call.arguments)})`,
          )
          .join("; ");
        return `[Assistant tool calls]\n${calls}`;
      }
      if (message.role === "tool") {
        return `[Tool result: ${message.name || "unknown"}]\n${truncate(
          message.content,
          4_000,
        )}`;
      }
      return `[${capitalize(message.role)}]\n${truncate(message.content, 4_000)}`;
    })
    .join("\n\n");
}

export function prepareContextCompaction(
  messages: UnifiedMessage[],
  keepRecentTokens: number,
): ContextCompactionPreparation | null {
  const systemMessages = messages.filter((message) => message.role === "system");
  const conversationMessages = messages.filter(
    (message) => message.role !== "system",
  );
  const previousSummary = systemMessages
    .find((message) => message.content.startsWith(CONTEXT_SUMMARY_MARKER))
    ?.content.slice(CONTEXT_SUMMARY_MARKER.length)
    .trim();

  let recentTokens = 0;
  let cutIndex = conversationMessages.length;
  for (let index = conversationMessages.length - 1; index >= 0; index -= 1) {
    recentTokens += estimateContextTokens([conversationMessages[index]]);
    if (recentTokens > keepRecentTokens) {
      cutIndex = index + 1;
      break;
    }
    cutIndex = index;
  }

  // A large final user payload (for example the canvas snapshot) can fill the
  // keep budget by itself. Still retain the current request and snapshot so
  // compaction never removes the context needed for the next model call.
  if (cutIndex >= conversationMessages.length) {
    const lastMessageIsCanvasSnapshot = conversationMessages.at(-1)?.content
      .startsWith("[UNTRUSTED_CANVAS_SNAPSHOT]") ?? false;
    let userMessagesToKeep = lastMessageIsCanvasSnapshot ? 2 : 1;
    for (let index = conversationMessages.length - 1; index >= 0; index -= 1) {
      if (conversationMessages[index].role !== "user") continue;
      userMessagesToKeep -= 1;
      if (userMessagesToKeep === 0) {
        cutIndex = index;
        break;
      }
    }
  }

  // Keep complete user turns so an assistant tool call is never separated from
  // its preceding user request and tool results. A cut at the end already
  // starts at a valid boundary and should not walk all the way back to zero.
  while (
    cutIndex > 0 &&
    cutIndex < conversationMessages.length &&
    conversationMessages[cutIndex]?.role !== "user"
  ) {
    cutIndex -= 1;
  }
  if (cutIndex <= 0) return null;

  return {
    systemMessages: systemMessages.filter(
      (message) => !message.content.startsWith(CONTEXT_SUMMARY_MARKER),
    ),
    messagesToSummarize: conversationMessages.slice(0, cutIndex),
    messagesToKeep: conversationMessages.slice(cutIndex),
    previousSummary,
    tokensBefore: estimateContextTokens(messages),
  };
}

export function buildCompactedMessages(
  preparation: ContextCompactionPreparation,
  summary: string,
): UnifiedMessage[] {
  return [
    ...preparation.systemMessages,
    {
      role: "system",
      content: `${CONTEXT_SUMMARY_MARKER}\n${summary.trim()}`,
    },
    ...preparation.messagesToKeep,
  ];
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}\n[truncated ${text.length - maxLength} chars]`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
