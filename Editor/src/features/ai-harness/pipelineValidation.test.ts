import { describe, expect, it } from "vitest";
import { validatePipelineDefinition } from "./pipelineValidation";

describe("validatePipelineDefinition", () => {
  it("支持合法的 Pipeline v1、v2 和混合格式", () => {
    expect(
      validatePipelineDefinition({
        recognition: "TemplateMatch",
        template: ["button.png"],
        action: { type: "Click", param: { target: [100, 200] } },
      }),
    ).toEqual([]);
  });

  it("拒绝未知类型、缺失必填参数和错误字段类型", () => {
    expect(
      validatePipelineDefinition({
        recognition: { type: "TemplateMatch", param: { template: 123 } },
        action: { type: "UnknownAction", param: {} },
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("recognition.param.template"),
        expect.stringContaining("未知动作类型"),
      ]),
    );

    expect(
      validatePipelineDefinition({ recognition: "ColorMatch" }),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("lower"),
        expect.stringContaining("upper"),
      ]),
    );
  });

  it("校验节点名和锚点引用", () => {
    expect(
      validatePipelineDefinition(
        {
          recognition: { type: "OCR", param: { roi: "不存在" } },
          action: { type: "Click", param: { target: "[Anchor]未定义" } },
        },
        { nodeNames: new Set(["开始"]), anchorNames: new Set(["已定义"]) },
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("不存在"),
        expect.stringContaining("未定义"),
      ]),
    );
  });
});
