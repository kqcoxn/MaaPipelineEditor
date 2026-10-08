import { expect, it, vi } from "vitest";
import { parseMilliseconds } from "./duration";
import { matchParamType } from "./typeMatchers";
import { otherFieldSchema } from "../fields/other/schema";
import { actionFieldSchema } from "../fields/action/schema";
import { recoFieldSchema } from "../fields/recognition/schema";
vi.mock("@/utils/ui/antdAppApi", () => ({ notification: { error: vi.fn() } }));

const match = (params: Record<string, unknown>, fields: Parameters<typeof matchParamType>[1], skipValidation = false) => matchParamType(params, fields, skipValidation);

it("时间单位精确换算，保留零值与超时哨兵", () => {
  for (const [input, output] of [["1.5s", 1500], ["1.001s", 1001], ["0.001s", 1], ["200ms", 200], [" 2 s ", 2000], ["0", 0], [0, 0], ["1.0000ms", 1]] as const) {
    expect(parseMilliseconds(input)).toBe(output);
  }
  expect(parseMilliseconds("-1", true)).toBe(-1);
  expect(parseMilliseconds("-1ms", true)).toBe(-1);
  for (const input of ["", " ", "1.1ms", "0.0001s", "2*1000", "1，5s", "Infinity", "9007199254740992ms", "-1s", "-2", null, true, [], Infinity]) {
    expect(parseMilliseconds(input, true)).toBeNull();
  }
  expect(parseMilliseconds(-1)).toBeNull();
});

it("导出仅转换标注为毫秒的字段及时间列表", () => {
  expect(match({ pre_delay: "1.5s", timeout: "-1" }, [otherFieldSchema.preDelay, otherFieldSchema.timeout])).toEqual({ pre_delay: 1500, timeout: -1 });
  expect(match({ duration: ["1.001s", "200ms"], end_hold: "0.1s" }, [actionFieldSchema.swipeDuration, actionFieldSchema.endHold])).toEqual({ duration: [1001, 200], end_hold: 100 });
  expect(match({ expected: ["1.5s"] }, [recoFieldSchema.ocrExpected])).toEqual({ expected: ["1.5s"] });
  const invalid = { duration: ["1s", "0.0001s"] };
  expect(match(invalid, [actionFieldSchema.swipeDuration])).toEqual({});
  expect(match(invalid, [actionFieldSchema.swipeDuration], true)).toEqual(invalid);
});

it("等待画面静止对象只转换已知时间，保留其他参数", () => {
  const input = { pre_wait_freezes: { time: "1s", rate_limit: "200ms", threshold: 0.9, custom: "2s" } };
  expect(match(input, [otherFieldSchema.preWaitFreezes])).toEqual({ pre_wait_freezes: { time: 1000, rate_limit: 200, threshold: 0.9, custom: "2s" } });
  expect(input.pre_wait_freezes.time).toBe("1s");
});
