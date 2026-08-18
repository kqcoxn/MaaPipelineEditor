import { describe, expect, it } from "vitest";
import { readMfwPipelineReference } from "./definition";

const context = {
  runId: "run-1",
  sessionId: "session-1",
  fileName: "demo.json",
  expectedStateVersion: 7,
  signal: new AbortController().signal,
};

describe("MaaFramework Pipeline 内置 Skill", () => {
  it("读取 TypeScript 内置协议章节", () => {
    const index = readMfwPipelineReference({}, context);
    expect(index.ok).toBe(true);
    expect(index.stateVersion).toBe(7);
    expect(index.data).toMatchObject({
      source: "builtin:mfw-pipeline",
    });
    expect((index.data as { sections: string[] }).sections).toContain(
      "算法类型/OCR",
    );

    const section = readMfwPipelineReference(
      { section: "算法类型/OCR" },
      context,
    );
    expect(section.ok).toBe(true);
    expect((section.data as { content: string }).content).toContain(
      "expected: string | string[]",
    );
  });

  it("父章节只返回简介和子章节目录", () => {
    const result = readMfwPipelineReference(
      { section: "算法类型" },
      context,
    );
    const data = result.data as {
      content: string;
      childSections: string[];
    };

    expect(data.childSections).toContain("算法类型/TemplateMatch");
    expect(data.content).not.toContain("模板匹配阈值");
  });

  it("要求歧义章节使用完整路径", () => {
    const result = readMfwPipelineReference({ section: "Custom" }, context);

    expect(result.ok).toBe(false);
    expect(result.error?.message).toContain("算法类型/Custom");
    expect(result.error?.message).toContain("动作类型/Custom");
  });
});
