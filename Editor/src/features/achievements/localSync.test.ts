import { describe, expect, it } from "vitest";
import { createPipelineNode } from "@/stores/flow";
import { localFileContentSignature } from "./localSync";

describe("本地重载内容比较", () => {
  it("忽略重建 ID、位置、选择状态和字段顺序，识别实际字段变化", () => {
    const node = createPipelineNode("entry", { label: "Entry" });
    const reloaded = { ...node, id: "new-id", position: { x: 999, y: 999 }, selected: true,
      data: Object.fromEntries(Object.entries(node.data).reverse()) as typeof node.data };
    expect(localFileContentSignature([node], [])).toBe(localFileContentSignature([reloaded], []));
    reloaded.data = { ...reloaded.data, label: "Changed" };
    expect(localFileContentSignature([node], [])).not.toBe(localFileContentSignature([reloaded], []));
  });
});
