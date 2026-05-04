import { describe, expect, it } from "vitest";
import { useConfigStore } from "../../stores/configStore";
import {
  formatDebugPipelineOverrideDraft,
  hasDebugPipelineOverrideDraftContent,
  parseDebugPipelineOverrideDraft,
} from "./pipelineOverride";

describe("parseDebugPipelineOverrideDraft", () => {
  it("normalizes v1 override nodes into current v2 runtime shape", () => {
    useConfigStore.getState().setConfig("pipelineProtocolVersion", "v2");

    const result = parseDebugPipelineOverrideDraft(`{
      "ShopEntry": {
        "recognition": "OCR",
        "expected": "text",
        "action": "Click",
        "target": [10, 20, 30, 40]
      }
    }`);

    expect(result.error).toBeUndefined();
    expect(result.overrides).toEqual([
      {
        runtimeName: "ShopEntry",
        pipeline: {
          recognition: {
            type: "OCR",
            param: {
              expected: "text",
            },
          },
          action: {
            type: "Click",
            param: {
              target: [10, 20, 30, 40],
            },
          },
        },
      },
    ]);
  });

  it("normalizes v2 override nodes into current v1 runtime shape", () => {
    useConfigStore.getState().setConfig("pipelineProtocolVersion", "v1");

    const result = parseDebugPipelineOverrideDraft(`{
      "ShopEntry": {
        "recognition": {
          "type": "OCR",
          "param": {
            "expected": "text"
          }
        },
        "action": {
          "type": "Click",
          "param": {
            "target": [10, 20, 30, 40]
          }
        }
      }
    }`);

    expect(result.error).toBeUndefined();
    expect(result.overrides).toEqual([
      {
        runtimeName: "ShopEntry",
        pipeline: {
          recognition: "OCR",
          expected: "text",
          action: "Click",
          target: [10, 20, 30, 40],
        },
      },
    ]);
  });

  it("parses MaaFW-compatible override objects into request entries", () => {
    useConfigStore.getState().setConfig("pipelineProtocolVersion", "v2");

    const result = parseDebugPipelineOverrideDraft(`{
      "ShopEntry": {
        "next": ["NextEntry"],
        "recognition": {
          "param": {
            "threshold": 0.95
          }
        }
      }
    }`);

    expect(result.error).toBeUndefined();
    expect(result.overrides).toEqual([
      {
        runtimeName: "ShopEntry",
        pipeline: {
          next: ["NextEntry"],
          recognition: {
            param: {
              threshold: 0.95,
            },
          },
        },
      },
    ]);
  });

  it("rejects non-object roots", () => {
    const result = parseDebugPipelineOverrideDraft("[]");

    expect(result.overrides).toBeUndefined();
    expect(result.error).toContain("Override 必须是 JSON 对象");
  });

  it("rejects non-object node payloads", () => {
    const result = parseDebugPipelineOverrideDraft(`{
      "ShopEntry": 1
    }`);

    expect(result.overrides).toBeUndefined();
    expect(result.error).toContain("ShopEntry");
  });
});

describe("formatDebugPipelineOverrideDraft", () => {
  it("formats override JSON with the requested indent", () => {
    const formatted = formatDebugPipelineOverrideDraft(
      '{"ShopEntry":{"next":["NextEntry"]}}',
      2,
    );

    expect(formatted).toBe(`{
  "ShopEntry": {
    "next": [
      "NextEntry"
    ]
  }
}`);
  });
});

describe("hasDebugPipelineOverrideDraftContent", () => {
  it("treats empty objects as empty drafts", () => {
    expect(hasDebugPipelineOverrideDraftContent("{}")).toBe(false);
    expect(hasDebugPipelineOverrideDraftContent("  {  }  ")).toBe(false);
  });

  it("treats invalid or non-empty drafts as existing content", () => {
    expect(hasDebugPipelineOverrideDraftContent('{"ShopEntry":{}}')).toBe(true);
    expect(hasDebugPipelineOverrideDraftContent("{")).toBe(true);
  });
});
