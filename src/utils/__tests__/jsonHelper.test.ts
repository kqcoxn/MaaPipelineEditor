import { describe, it, expect } from "vitest";
import { JsonHelper } from "../jsonHelper";

describe("JsonHelper", () => {
  describe("isObj", () => {
    it("应该识别对象", () => {
      expect(JsonHelper.isObj({})).toBe(true);
      expect(JsonHelper.isObj({ key: "value" })).toBe(true);
      expect(JsonHelper.isObj([])).toBe(true);
      expect(JsonHelper.isObj([1, 2, 3])).toBe(true);
    });

    it("应该排除非对象值", () => {
      expect(JsonHelper.isObj(null)).toBe(false);
      expect(JsonHelper.isObj(undefined)).toBe(false);
      expect(JsonHelper.isObj("string")).toBe(false);
      expect(JsonHelper.isObj(123)).toBe(false);
      expect(JsonHelper.isObj(true)).toBe(false);
    });
  });

  describe("isStringObj", () => {
    it("应该识别 JSON 字符串对象", () => {
      expect(JsonHelper.isStringObj('{"key":"value"}')).toBe(true);
      expect(JsonHelper.isStringObj('{"nested":{"key":"value"}}')).toBe(true);
      expect(JsonHelper.isStringObj("[1,2,3]")).toBe(true);
      expect(JsonHelper.isStringObj('{"empty":{}}')).toBe(true);
    });

    it("应该排除非 JSON 字符串", () => {
      expect(JsonHelper.isStringObj("not json")).toBe(false);
      expect(JsonHelper.isStringObj("123")).toBe(false);
      expect(JsonHelper.isStringObj('"string"')).toBe(false);
      expect(JsonHelper.isStringObj("null")).toBe(false);
      expect(JsonHelper.isStringObj("true")).toBe(false);
    });

    it("应该处理无效的 JSON 字符串", () => {
      expect(JsonHelper.isStringObj("{invalid}")).toBe(false);
      expect(JsonHelper.isStringObj('{"key":}')).toBe(false);
      expect(JsonHelper.isStringObj("[1,2,")).toBe(false);
    });
  });

  describe("objToString", () => {
    it("应该将对象转换为 JSON 字符串", () => {
      expect(JsonHelper.objToString({ key: "value" })).toBe('{"key":"value"}');
      expect(JsonHelper.objToString([1, 2, 3])).toBe("[1,2,3]");
      expect(JsonHelper.objToString({})).toBe("{}");
    });

    it("应该处理嵌套对象", () => {
      const nested = { outer: { inner: "value" } };
      expect(JsonHelper.objToString(nested)).toBe(
        '{"outer":{"inner":"value"}}'
      );
    });

    it("应该为非对象返回 null", () => {
      expect(JsonHelper.objToString(null)).toBe(null);
      expect(JsonHelper.objToString(undefined)).toBe(null);
      expect(JsonHelper.objToString("string")).toBe(null);
      expect(JsonHelper.objToString(123)).toBe(null);
    });

    it("应该处理循环引用", () => {
      const circular: any = { key: "value" };
      circular.self = circular;
      expect(JsonHelper.objToString(circular)).toBe(null);
    });
  });

  describe("stringObjToJson", () => {
    it("应该将 JSON 字符串转换为对象", () => {
      expect(JsonHelper.stringObjToJson('{"key":"value"}')).toEqual({
        key: "value",
      });
      expect(JsonHelper.stringObjToJson("[1,2,3]")).toEqual([1, 2, 3]);
      expect(JsonHelper.stringObjToJson("{}")).toEqual({});
    });

    it("应该处理嵌套结构", () => {
      const jsonStr = '{"outer":{"inner":"value"}}';
      expect(JsonHelper.stringObjToJson(jsonStr)).toEqual({
        outer: { inner: "value" },
      });
    });

    it("应该为非 JSON 字符串对象返回 null", () => {
      expect(JsonHelper.stringObjToJson("not json")).toBe(null);
      expect(JsonHelper.stringObjToJson("123")).toBe(null);
      expect(JsonHelper.stringObjToJson('"string"')).toBe(null);
      expect(JsonHelper.stringObjToJson("null")).toBe(null);
    });

    it("应该为无效 JSON 返回 null", () => {
      expect(JsonHelper.stringObjToJson("{invalid}")).toBe(null);
      expect(JsonHelper.stringObjToJson('{"key":}')).toBe(null);
    });
  });

  describe("完整工作流测试", () => {
    it("应该正确地进行对象 -> 字符串 -> 对象的转换", () => {
      const original = { name: "test", value: 123, nested: { key: "value" } };
      const jsonString = JsonHelper.objToString(original);
      const parsed = JsonHelper.stringObjToJson(jsonString!);
      expect(parsed).toEqual(original);
    });

    it("应该正确地进行字符串 -> 对象 -> 字符串的转换", () => {
      const original = '{"name":"test","value":123}';
      const obj = JsonHelper.stringObjToJson(original);
      const jsonString = JsonHelper.objToString(obj);
      const parsed = JSON.parse(jsonString!);
      expect(parsed).toEqual(JSON.parse(original));
    });
  });
});
