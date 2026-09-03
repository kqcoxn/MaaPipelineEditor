import { describe, expect, it } from "vitest";
import type { UnifiedMessage } from "@/utils/ai/providers";
import {
  CONTEXT_SUMMARY_MARKER,
  buildCompactedMessages,
  estimateContextTokens,
  prepareContextCompaction,
  serializeConversation,
} from "./contextCompaction";

const messages: UnifiedMessage[] = [
  { role: "system", content: "规则" },
  { role: "user", content: "第一个目标" },
  { role: "assistant", content: "第一次回复" },
  { role: "user", content: "第二个目标" },
  {
    role: "assistant",
    content: "",
    toolCalls: [{ id: "call-1", name: "read_node", arguments: { nodeId: "1" } }],
  },
  {
    role: "tool",
    name: "read_node",
    toolCallId: "call-1",
    content: "节点详情",
  },
  { role: "assistant", content: "完成" },
];

describe("contextCompaction", () => {
  it("在用户消息边界切分并保留完整工具回合", () => {
    const preparation = prepareContextCompaction(messages, 20);

    expect(preparation?.messagesToSummarize).toEqual([
      { role: "user", content: "第一个目标" },
      { role: "assistant", content: "第一次回复" },
    ]);
    expect(preparation?.messagesToKeep[0]?.role).toBe("user");
  });

  it("重建摘要消息并移除旧摘要", () => {
    const withSummary: UnifiedMessage[] = [
      { role: "system", content: "规则" },
      { role: "system", content: `${CONTEXT_SUMMARY_MARKER}\n旧摘要` },
      { role: "user", content: "旧目标" },
      { role: "assistant", content: "旧回复" },
      { role: "user", content: "新目标" },
      { role: "assistant", content: "回复" },
    ];
    const preparation = prepareContextCompaction(withSummary, 1);

    expect(preparation?.previousSummary).toBe("旧摘要");
    expect(
      buildCompactedMessages(preparation!, "新摘要").filter(
        (message) => message.content.startsWith(CONTEXT_SUMMARY_MARKER),
      ),
    ).toEqual([
      { role: "system", content: `${CONTEXT_SUMMARY_MARKER}\n新摘要` },
    ]);
  });

  it("能估算并序列化工具调用上下文", () => {
    expect(estimateContextTokens(messages)).toBeGreaterThan(0);
    expect(serializeConversation(messages)).toContain("[Assistant tool calls]");
    expect(serializeConversation(messages)).toContain("[Tool result: read_node]");
  });

  it("即使最后的画布快照超过保留量也保留当前请求", () => {
    const withLargeSnapshot: UnifiedMessage[] = [
      { role: "user", content: "旧目标" },
      { role: "assistant", content: "旧回复" },
      { role: "user", content: "当前目标" },
      {
        role: "user",
        content: `[UNTRUSTED_CANVAS_SNAPSHOT]\n${"节点 ".repeat(2_000)}`,
      },
    ];

    const preparation = prepareContextCompaction(withLargeSnapshot, 1_000);

    expect(preparation?.messagesToSummarize).toEqual(withLargeSnapshot.slice(0, 2));
    expect(preparation?.messagesToKeep).toEqual(withLargeSnapshot.slice(2));
  });
});
