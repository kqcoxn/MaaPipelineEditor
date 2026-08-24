import { describe, expect, it } from "vitest";
import {
  getConfigFileName,
  getPipelineFileNameFromConfig,
} from "./configSplitter";

describe("配置文件名工具", () => {
  it("为 Pipeline 文件生成带前缀点号的分离配置文件名", () => {
    expect(getConfigFileName("search.json")).toBe(".search.mpe.json");
    expect(getConfigFileName("search.jsonc")).toBe(".search.mpe.json");
  });

  it("从分离配置文件名还原 Pipeline 文件名", () => {
    expect(getPipelineFileNameFromConfig(".search.mpe.json")).toBe("search");
  });
});
