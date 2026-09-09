import { describe, expect, it } from "vitest";
import { recoFields } from "../fields/recognition/fields";
import { matchParamType } from "./typeMatchers";

describe.each(["NeuralNetworkClassify", "NeuralNetworkDetect"])("%s expected", (algorithm) => {
  it.each([0, "猫", "123", [0, "猫", "123"], []])("preserves indices and labels: %j", (expected) => {
    const fields = recoFields[algorithm].params;
    const first = matchParamType({ expected }, fields);
    expect(first.expected).toEqual(expected);
    expect(matchParamType(JSON.parse(JSON.stringify(first)), fields).expected).toEqual(expected);
  });
});
