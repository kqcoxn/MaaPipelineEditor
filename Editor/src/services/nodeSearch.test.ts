import { describe, expect, it } from "vitest";
import {
  collectSearchableFieldValues,
  findMatchingFieldValue,
} from "./nodeSearch";

describe("collectSearchableFieldValues", () => {
  it("递归收集字段中的字符串、数字和布尔值", () => {
    const values = collectSearchableFieldValues({
      recognition: {
        type: "TemplateMatch",
        param: { template: ["button.png"], threshold: 0.8 },
      },
      enabled: true,
      empty: null,
    });

    expect(values).toEqual([
      "TemplateMatch",
      "button.png",
      "0.8",
      "true",
    ]);
  });

  it("去除重复值并忽略空字符串", () => {
    expect(collectSearchableFieldValues(["same", "", "same"])).toEqual([
      "same",
    ]);
  });
});

describe("findMatchingFieldValue", () => {
  it("忽略大小写并返回首个匹配字段值", () => {
    expect(
      findMatchingFieldValue(["TemplateMatch", "button.png"], "template"),
    ).toBe("TemplateMatch");
  });
});
