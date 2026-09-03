import { describe, expect, it } from "vitest";
import {
  getHarnessCommandQuery,
  parseHarnessCommand,
  searchHarnessCommands,
} from "./commands";

describe("Harness commands", () => {
  it("支持斜杠命令的模糊搜索", () => {
    expect(getHarnessCommandQuery("/cmp")).toBe("cmp");
    expect(searchHarnessCommands("cmp").map((command) => command.name)).toEqual([
      "compact",
    ]);
    expect(getHarnessCommandQuery("/compact ")).toBeNull();
  });

  it("解析命令后的压缩补充说明", () => {
    expect(parseHarnessCommand("/compact 关注当前修改")).toMatchObject({
      command: { name: "compact" },
      instructions: "关注当前修改",
    });
    expect(parseHarnessCommand("/unknown")).toBeNull();
  });
});
