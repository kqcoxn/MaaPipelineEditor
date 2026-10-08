import { expect, it } from "vitest";
import { parseListPaste } from "./listPaste";
import { recoFieldSchema as reco } from "./recognition/schema";
import { actionFieldSchema as action } from "./action/schema";

it("解析完整数组与二维数组，按复合单项的形状补一层", () => {
  expect(parseListPaste("[0.7,0.8]", reco.templateMatchThreshold)).toEqual({ value: [0.7, 0.8] });
  expect(parseListPaste("[[0,0,0],[100,100,100]]", reco.lower)).toEqual({ value: [[0, 0, 0], [100, 100, 100]] });
  expect(parseListPaste("[0,128,255]", reco.lower)).toEqual({ value: [[0, 128, 255]] });
  expect(parseListPaste("[100,200,30,40]", action.endOffset)).toEqual({ value: [[100, 200, 30, 40]] });
  expect(parseListPaste("[100,200]", action.end)).toEqual({ value: [[100, 200]] });
  expect(parseListPaste('["1.5s","200ms"]', action.swipeDuration)).toEqual({ value: [1500, 200] });
  expect(parseListPaste("[]", reco.lower)).toEqual({ value: [] });
});

it("字符串与正则内容原样保留，不猜测分隔符或转义", () => {
  const strings = ['a,b，c', ' [x y] “中文” ', String.raw`\d+`, '"引号"', '[1,2]'];
  expect(parseListPaste(JSON.stringify(strings), reco.ocrExpected)).toEqual({ value: strings });
  expect(parseListPaste(JSON.stringify(strings.slice(0, 2)), reco.replace)).toEqual({ value: [strings.slice(0, 2)] });
  expect(parseListPaste('["1","2"]', action.end)).toEqual({ value: ["1", "2"] });
});

it("拒绝非法结构中的任意一项，不输出部分结果", () => {
  for (const [source, field] of [
    ['[0.7,"0.8"]', reco.templateMatchThreshold],
    ['[1e999]', reco.templateMatchThreshold],
    ['["a",1]', reco.ocrExpected],
    ['[[1,2,3],[4,5]]', reco.lower],
    ['[true,2,3,4]', action.endOffset],
    ['[["a","b"],"c,d"]', reco.replace],
    ['["1s","0.1ms"]', action.swipeDuration],
    ['["abc",]', reco.ocrExpected],
    ['{"x":1}', reco.lower],
  ] as const) {
    const result = parseListPaste(source, field);
    expect(result.value).toBeUndefined();
    expect(result.error).toMatch(/数组|时间/);
  }
});
